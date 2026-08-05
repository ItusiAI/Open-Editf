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
const KIE_API_KEY = process.env.KIE_API_KEY!
// Webhook URL - 视频专用 webhook
const VIDEO_WEBHOOK_URL = process.env.KIE_VIDEO_WEBHOOK_URL

// Kling 3.0 积分消耗规则:
// Standard: 无音频=25积分/s, 有音频=35积分/s
// Pro: 无音频=30积分/s, 有音频=45积分/s
// 4K: 110积分/s
function calculateVideoPoints(mode: string, duration: number, hasAudio: boolean): number {
  if (mode === "4K") {
    return 110 * duration
  }
  if (mode === "pro") {
    return hasAudio ? 45 * duration : 30 * duration
  }
  // std 模式（默认）
  return hasAudio ? 35 * duration : 25 * duration
}

// 获取 Kling 3.0 模型的 API 名称
function getKling30ModelName(): string {
  return "kling-3.0/video"
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
      aspectRatio,
      mode,
      duration,
      videoGenerateMode,
      imageUrls,
      videoUrl,
      firstFrameUrl,
      lastFrameUrl,
      chatMessageId,
      negativePrompt,
      seed,
      promptExtend,
      audioSetting,
    } = body

    // 内部调用时必须提供 userId
    if (!sessionUserId) {
      console.error("Kling 3.0: 内部调用缺少 userId")
      return NextResponse.json({ error: "Invalid internal call: missing userId" }, { status: 400 })
    }

    // Kling 3.0 只支持单镜头模式 (multi_shots: false)
    // mode 映射: Standard -> std, Pro -> pro, 4K -> 4K
    const modeMap: Record<string, string> = {
      "Standard": "std",
      "Pro": "pro",
      "4K": "4K"
    }
    const klingMode = modeMap[mode || "Standard"] || "std"

    // 计算实际积分消耗
    const actualDuration = duration !== undefined ? duration : 5
    const hasAudio = audioSetting === "on" || audioSetting === true
    const actualPointsCost = calculateVideoPoints(klingMode, actualDuration, hasAudio)

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

    // 获取 API 模型名称
    const kieModel = getKling30ModelName()

    // 构建 Kie.ai API 请求体 - Kling 3.0 单镜头模式
    const kieRequestBody: any = {
      model: kieModel,
      input: {
        prompt: prompt || "Generate video",
        mode: klingMode,
        duration: String(actualDuration),
        aspect_ratio: aspectRatio || "16:9",
        multi_shots: false, // 只支持单镜头
        sound: hasAudio,
      },
    }

    // 设置图片参数
    if (videoGenerateMode === "image2video") {
      // 图生视频：使用第一张图片作为首帧
      if (imageUrls && imageUrls.length > 0) {
        kieRequestBody.input.image_urls = imageUrls.slice(0, 1)
      } else if (firstFrameUrl) {
        kieRequestBody.input.image_urls = [firstFrameUrl]
      }
    } else if (videoGenerateMode === "firstlast2video") {
      // 首尾帧视频：image_urls 长度为2时，索引0为首帧，索引1为尾帧
      // 收集所有图片URL
      const allUrls: string[] = []
      if (imageUrls && imageUrls.length > 0) {
        allUrls.push(...imageUrls)
      }
      if (firstFrameUrl && !allUrls.includes(firstFrameUrl)) {
        allUrls.push(firstFrameUrl)
      }
      if (lastFrameUrl && !allUrls.includes(lastFrameUrl)) {
        allUrls.push(lastFrameUrl)
      }
      
      // 设置 image_urls
      if (allUrls.length >= 2) {
        // 前两张作为首尾帧
        kieRequestBody.input.image_urls = [allUrls[0], allUrls[1]]
      } else if (allUrls.length === 1) {
        // 只有一张图片，作为首帧
        kieRequestBody.input.image_urls = [allUrls[0]]
      }
    }
    // Kling 3.0 单镜头模式不支持 reference2video 和 videoEdit

    // 可选参数
    if (seed !== undefined && seed !== null) {
      kieRequestBody.input.seed = seed
    }

    // 始终使用环境变量中的 webhook URL（公网可访问）
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
          prompt: prompt || "Video generation",
          imageUrls: "[]",
          model: kieModel,
          aspectRatio: aspectRatio,
          resolution: klingMode,
          pointsUsed: actualPointsCost,
          requestId: null,
          seed: seed ? String(seed) : null,
          description: JSON.stringify({ videoGenerateMode, duration: actualDuration, mode: klingMode, audio: hasAudio }),
          status: "queued",
          createdAt: new Date(),
          chatMessageId: chatMessageId || null,
        })
        console.log("Kling 3.0 记录创建成功（Webhook模式）:", { recordId })
      } else {
        console.log("复用已有 Kling 3.0 记录:", { recordId, chatMessageId })
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
          console.error("Kie.ai API error (Kling 3.0 webhook mode):", response.status, errorData)
          return NextResponse.json(
            { error: "Video generation failed", details: errorData },
            { status: 500 }
          )
        }

        const data = await response.json()

        if (data.code !== 200) {
          console.error("Kie.ai API returned error (Kling 3.0 webhook mode):", data)
          return NextResponse.json(
            { error: data.msg || "Video generation failed" },
            { status: 500 }
          )
        }

        const taskId = data.data?.taskId
        if (!taskId) {
          console.error("No taskId returned from Kie.ai (Kling 3.0 webhook mode):", data)
          return NextResponse.json({ error: "No task ID returned" }, { status: 500 })
        }

        // 同步更新数据库
        try {
          await db
            .update(generationHistory)
            .set({
              requestId: taskId,
            })
            .where(eq(generationHistory.id, recordId))

          console.log("Kling 3.0 记录已更新 taskId（Webhook模式）:", { taskId, recordId })
        } catch (updateError) {
          console.error("更新 Kling 3.0 记录 taskId 失败（Webhook模式）:", updateError)
        }

        // 立即返回结果
        return NextResponse.json({
          success: true,
          recordId,
          pointsCost: actualPointsCost,
          mode: "webhook",
          taskId,
          message: "视频生成任务已提交，结果将通过 webhook 回调返回",
        })
      } catch (error) {
        console.error("创建 Kie.ai Kling 3.0 任务失败（Webhook模式）:", error)
        return NextResponse.json({ error: "Failed to create task" }, { status: 500 })
      }
    }

    // 非 Webhook：轮询模式（暂不支持）
    return NextResponse.json({ error: "Polling mode not supported for Kling 3.0" }, { status: 501 })

  } catch (error) {
    console.error("Kie.ai Kling 3.0 API Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
