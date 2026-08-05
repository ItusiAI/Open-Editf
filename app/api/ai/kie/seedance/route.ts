import { NextRequest, NextResponse } from "next/server"
import { authOptions } from "@/lib/auth"
import { getServerSession } from "next-auth"
import { usePoints, getUserPointsDetail } from "@/lib/points-manager"
import { db } from "@/lib/db"
import { generationHistory } from "@/lib/schema"
import { saveVideosToR2Task } from "@/src/trigger/save-videos-to-r2"
import { v4 as uuidv4 } from "uuid"
import { eq } from "drizzle-orm"

// Kie.ai API 配置
const KIE_API_URL = "https://api.kie.ai/api/v1/jobs/createTask"
const KIE_QUERY_URL = "https://api.kie.ai/api/v1/jobs/recordInfo"
const KIE_API_KEY = process.env.KIE_API_KEY!
// Webhook URL - 视频专用 webhook
const VIDEO_WEBHOOK_URL = process.env.KIE_VIDEO_WEBHOOK_URL

// 视频编辑积分消耗规则
// Seedance 2.0: 有视频=20/40/100, 无视频=30/70/170 (480p/720p/1080p)
// Seedance 2.0 Fast: 有视频=15/35, 无视频=25/55 (480p/720p)
// Seedance 2.0 Mini: 有视频=10/20, 无视频=15/35 (480p/720p)
function calculateVideoPoints(model: string, resolution: string, duration: number, hasInputVideo: boolean): number {
  if (model === "seedance2fast") {
    // Seedance 2.0 Fast: 只支持 480p 和 720p
    const effectiveResolution = resolution === "1080p" ? "720p" : resolution
    const pointsPerSecond = hasInputVideo
      ? (effectiveResolution === "480p" ? 15 : 35)
      : (effectiveResolution === "480p" ? 25 : 55)
    return pointsPerSecond * duration
  } else if (model === "seedance2mini") {
    // Seedance 2.0 Mini: 只支持 480p 和 720p
    const effectiveResolution = resolution === "1080p" ? "720p" : resolution
    const pointsPerSecond = hasInputVideo
      ? (effectiveResolution === "480p" ? 10 : 20)
      : (effectiveResolution === "480p" ? 15 : 35)
    return pointsPerSecond * duration
  } else {
    // Seedance 2.0
    const pointsPerSecond = hasInputVideo
      ? (resolution === "480p" ? 20 : resolution === "720p" ? 40 : 100)
      : (resolution === "480p" ? 30 : resolution === "720p" ? 70 : 170)
    return pointsPerSecond * duration
  }
}

function appendRecordIdParam(baseUrl: string, recordId: string) {
  const hasQuery = baseUrl.includes("?")
  const separator = hasQuery ? "&" : "?"
  return `${baseUrl}${separator}recordId=${encodeURIComponent(recordId)}`
}

export async function POST(request: NextRequest) {
  try {
    // 内部调用时跳过认证校验
    const isInternalCall = request.headers.get("x-internal-call") === "true"
    const body = await request.json()
    let sessionUserId: string | undefined

    if (isInternalCall) {
      sessionUserId = body.userId
    } else {
      const session = await getServerSession(authOptions)
      if (!session?.user) {
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 401 }
        )
      }
      sessionUserId = session.user.id
    }

    const {
      prompt,
      videoUrl,
      referenceImageUrl,
      referenceImageUrls,
      referenceVideoUrls,
      referenceAudioUrls,
      firstFrameUrl,
      lastFrameUrl,
      model,
      aspectRatio,
      resolution,
      duration,
      audioSetting,
      webhookUrl,
      chatMessageId,
      negativePrompt,
      watermark,
      seed,
      nsfwChecker,
      promptExtend,
      videoGenerateMode,
    } = body

    // 内部调用时必须提供 userId
    if (!sessionUserId) {
      console.error("视频编辑: 内部调用缺少 userId")
      return NextResponse.json({ error: "Invalid internal call: missing userId" }, { status: 400 })
    }

    // 判断是否有参考视频（用于积分计算）
    // 根据文档：只有输入参考视频才用低价，其他（图生视频、首尾帧、参考图）都是高价
    const hasReferenceVideo = referenceVideoUrls && referenceVideoUrls.length > 0

    // 计算实际积分消耗
    const actualPointsCost = calculateVideoPoints(model || "seedance2", resolution || "720p", duration !== undefined ? duration : 5, hasReferenceVideo)

    // 预检查积分是否足够
    try {
      const pointsDetail = await getUserPointsDetail(sessionUserId)
      if (pointsDetail.totalPoints < actualPointsCost) {
        return NextResponse.json(
          { error: "Insufficient points", requiredPoints: actualPointsCost },
          { status: 402 }
        )
      }
    } catch (error) {
      console.error("积分检查失败:", error)
      return NextResponse.json({ error: "Failed to check points balance" }, { status: 500 })
    }

    // 构建 Kie.ai API 请求体
    // Seedance 2.0 支持: 文生视频、图生视频(首帧)、首尾帧视频、多模态参考生视频
    const modelMap: Record<string, string> = {
      "seedance2fast": "bytedance/seedance-2-fast",
      "seedance2": "bytedance/seedance-2",
      "seedance2mini": "bytedance/seedance-2-mini",
    }
    const kieModel = modelMap[model] || "bytedance/seedance-2"

    // Seedance 2.0 Mini 仅支持 480p/720p
    const effectiveResolution =
      model === "seedance2mini" && resolution === "1080p" ? "720p" : (resolution || "720p")

    const kieRequestBody: any = {
      model: kieModel,
      input: {
        prompt: prompt || "Generate video",
        resolution: effectiveResolution,
        aspect_ratio: aspectRatio || "16:9",
        duration: duration !== undefined ? duration : 5,
        generate_audio: audioSetting === "auto" || audioSetting === undefined ? true : false,
      },
    }

    // 根据生成模式设置不同的参数
    if (videoGenerateMode === "image2video" && videoUrl) {
      // 图生视频：使用图片作为首帧
      kieRequestBody.input.first_frame_url = videoUrl
    } else if (videoGenerateMode === "firstlast2video") {
      // 首尾帧视频：使用前两张图片
      if (firstFrameUrl) {
        kieRequestBody.input.first_frame_url = firstFrameUrl
      }
      if (lastFrameUrl) {
        kieRequestBody.input.last_frame_url = lastFrameUrl
      }
    } else if (videoGenerateMode === "reference2video") {
      // 多模态参考生视频：可以混合使用图片、视频、音频
      if (referenceImageUrls && referenceImageUrls.length > 0) {
        kieRequestBody.input.reference_image_urls = referenceImageUrls.slice(0, 9)
      }
      if (referenceVideoUrls && referenceVideoUrls.length > 0) {
        kieRequestBody.input.reference_video_urls = referenceVideoUrls.slice(0, 3)
      }
      if (referenceAudioUrls && referenceAudioUrls.length > 0) {
        kieRequestBody.input.reference_audio_urls = referenceAudioUrls.slice(0, 3)
      }
    }

    // text2video 模式不需要额外参数
    if (negativePrompt) {
      kieRequestBody.input.negative_prompt = negativePrompt
    }
    if (seed !== undefined && seed !== null) {
      kieRequestBody.input.seed = seed
    }
    if (nsfwChecker === false) {
      kieRequestBody.input.nsfw_checker = false
    }
    if (promptExtend !== false) {
      kieRequestBody.input.web_search = true
    }

    // 始终使用环境变量中的 webhook URL（公网可访问）
    // 忽略前端传来的 webhookUrl，确保 Kie.ai 能回调到公网地址
    const finalWebhookUrl = VIDEO_WEBHOOK_URL
    const useWebhookMode = !!finalWebhookUrl

    // 复用已有记录
    let recordId: string | undefined = chatMessageId
      ? (await db.query.generationHistory.findFirst({
          where: eq(generationHistory.chatMessageId, chatMessageId),
        }))?.id
      : undefined

    if (useWebhookMode && finalWebhookUrl) {
      // Webhook 模式：同步调用 Kie.ai API
      if (!KIE_API_KEY) {
        return NextResponse.json({ error: "Kie.ai API key not configured" }, { status: 500 })
      }

        if (!recordId) {
        recordId = uuidv4()
        await db.insert(generationHistory).values({
          id: recordId,
          userId: sessionUserId,
          type: "video",
          prompt: prompt || "Edit video",
          imageUrls: "[]",
          model: kieModel,
          aspectRatio: aspectRatio,
          resolution: effectiveResolution,
          pointsUsed: actualPointsCost,
          requestId: null,
          seed: seed ? String(seed) : null,
          description: JSON.stringify({ videoGenerateMode, videoUrl, referenceImageUrl, referenceVideoUrls, firstFrameUrl, lastFrameUrl, audioSetting, duration }),
          status: "queued",
          createdAt: new Date(),
          chatMessageId: chatMessageId || null,
        })
        console.log("视频编辑记录创建成功（Webhook模式）:", { recordId })
      } else {
        console.log("复用已有视频编辑记录:", { recordId, chatMessageId })
      }

      // 为回调地址追加 recordId 参数
      const webhookWithRecordId = appendRecordIdParam(finalWebhookUrl, recordId)
      kieRequestBody.callBackUrl = webhookWithRecordId

      // 同步调用 Kie.ai API
      try {
        const response = await fetch(KIE_API_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${KIE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(kieRequestBody),
        })

        if (!response.ok) {
          const errorData = await response.text()
          console.error("Kie.ai API error (webhook mode - video edit):", response.status, errorData)
          return NextResponse.json(
            { error: "Video editing failed", details: errorData },
            { status: 500 }
          )
        }

        const data = await response.json()

        if (data.code !== 200) {
          console.error("Kie.ai API returned error (webhook mode - video edit):", data)
          return NextResponse.json(
            { error: data.msg || "Video editing failed" },
            { status: 500 }
          )
        }

        const taskId = data.data?.taskId
        if (!taskId) {
          console.error("No taskId returned from Kie.ai (webhook mode - video edit):", data)
          return NextResponse.json({ error: "No task ID returned" }, { status: 500 })
        }

        // 同步更新数据库（保持 queued 状态，等 Webhook 回调时再扣积分）
        try {
          await db
            .update(generationHistory)
            .set({
              requestId: taskId,
              // status 保持 queued，等 Webhook 回调时再改成 pending
            })
            .where(eq(generationHistory.id, recordId))

          console.log("视频编辑记录已更新 taskId（Webhook模式）:", { taskId, recordId })
        } catch (updateError) {
          console.error("更新视频编辑记录 taskId 失败（Webhook模式）:", updateError)
        }

        // 立即返回结果
        return NextResponse.json({
          success: true,
          recordId,
          pointsCost: actualPointsCost,
          mode: "webhook",
          taskId,
          message: "视频编辑任务已提交，结果将通过 webhook 回调返回",
        })
      } catch (error) {
        console.error("创建 Kie.ai 视频编辑任务失败（Webhook模式）:", error)
        return NextResponse.json({ error: "Failed to create task" }, { status: 500 })
      }
    }

    // 非 Webhook：轮询模式
    const response = await fetch(KIE_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${KIE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(kieRequestBody),
    })

    if (!response.ok) {
      const errorData = await response.text()
      console.error("Kie.ai API error (video edit):", response.status, errorData)
      return NextResponse.json({ error: "Video editing failed" }, { status: 500 })
    }

    const data = await response.json()

    if (data.code !== 200) {
      console.error("Kie.ai API returned error (video edit):", data)
      return NextResponse.json({ error: data.msg || "Video editing failed" }, { status: 500 })
    }

    const taskId = data.data?.taskId
    if (!taskId) {
      console.error("No taskId returned from Kie.ai (video edit):", data)
      return NextResponse.json({ error: "No task ID returned" }, { status: 500 })
    }

    // 轮询模式：等待结果
    const maxRetries = 60 // 60次 * 5秒 = 5分钟（视频生成可能需要更长时间）
    let retryCount = 0
    let taskResult: any = null

    while (retryCount < maxRetries) {
      try {
        const queryResponse = await fetch(`${KIE_QUERY_URL}?taskId=${taskId}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${KIE_API_KEY}`,
            'Content-Type': 'application/json'
          }
        })

        if (queryResponse.ok) {
          const queryData = await queryResponse.json()
          if (queryData.code === 200 && queryData.data) {
            const taskData = queryData.data

            if (taskData.state === 'success' && taskData.resultJson) {
              try {
                const resultData = JSON.parse(taskData.resultJson)
                taskResult = resultData
                break
              } catch (parseError) {
                console.error('Error parsing resultJson:', parseError)
                return NextResponse.json({ error: "Video editing failed - invalid result format" }, { status: 500 })
              }
            } else if (taskData.state === 'fail') {
              console.error('Kie.ai video task failed:', taskData.failMsg || taskData.failCode)
              return NextResponse.json({ error: taskData.failMsg || "Video editing failed" }, { status: 500 })
            }
          }
        }

        // 等待5秒后重试（视频生成时间较长）
        await new Promise(resolve => setTimeout(resolve, 5000))
        retryCount++
      } catch (queryError) {
        console.error('Error querying Kie.ai video task:', queryError)
        retryCount++
      }
    }

    if (!taskResult) {
      return NextResponse.json({ error: "Video editing timeout" }, { status: 500 })
    }

    // 解析视频结果
    const resultUrls = taskResult.resultUrls || []
    const resultVideoUrl = resultUrls[0]

    if (!resultVideoUrl) {
      return NextResponse.json({ error: "No video generated" }, { status: 500 })
    }

    // 保存记录到数据库
    if (!recordId) recordId = uuidv4()
    try {
      await db.insert(generationHistory).values({
        id: recordId,
        userId: sessionUserId,
        type: 'video-edit',
        prompt: prompt || "Edit video",
        imageUrls: JSON.stringify([resultVideoUrl]),
        model: kieModel,
        aspectRatio: aspectRatio,
        resolution: effectiveResolution,
        pointsUsed: actualPointsCost,
        requestId: taskId,
        seed: taskResult.seed ? String(taskResult.seed) : null,
        description: taskResult.description,
        status: 'pending',
        createdAt: new Date(),
      })
    } catch (dbError) {
      console.error('保存视频编辑记录失败:', dbError)
    }

    // 扣除积分
    try {
      await usePoints(sessionUserId, actualPointsCost, "AI视频", "ai_video")
    } catch (pointsError) {
      console.error('积分扣除失败，但视频已成功生成:', pointsError)
    }

    // 异步触发视频搬运任务
    try {
      console.log('触发视频搬运任务:', {
        resultVideoUrl,
        recordId,
        userId: sessionUserId
      })

      await saveVideosToR2Task.trigger({
        videoUrls: [resultVideoUrl],
        recordId: recordId,
        userId: sessionUserId,
      })

      console.log('视频搬运任务触发成功')
    } catch (error) {
      console.error('触发视频搬运任务失败:', error)
    }

    return NextResponse.json({
      success: true,
      videoUrl: resultVideoUrl,
      requestId: taskId,
      pointsCost: actualPointsCost,
    })
  } catch (error) {
    console.error("Kie.ai Video Edit API Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
