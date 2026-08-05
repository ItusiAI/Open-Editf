import { NextRequest, NextResponse } from "next/server"
import { authOptions } from "@/lib/auth"
import { getServerSession } from "next-auth"
import { usePoints, getUserPointsDetail } from "@/lib/points-manager"
import { db } from "@/lib/db"
import { generationHistory } from "@/lib/schema"
import { saveVideosToR2Task } from "@/src/trigger/save-videos-to-r2"
import { v4 as uuidv4 } from "uuid"
import { eq } from "drizzle-orm"

// Kie.ai Veo 3.1 API 配置
const KIE_VEO_API_URL = "https://api.kie.ai/api/v1/veo/generate"
const KIE_VEO_QUERY_URL = "https://api.kie.ai/api/v1/veo/taskInfo"
const KIE_API_KEY = process.env.KIE_API_KEY!
// Webhook URL
const VEO_WEBHOOK_URL = process.env.KIE_VEO_WEBHOOK_URL

// Veo 3.1 积分消耗规则
// Veo 3.1 Lite: 50
// Veo 3.1 Fast: 100
// Veo 3.1 Quality: 400
function calculateVeoPoints(model: string): number {
  if (model === "veo3" || model === "kie-ai/veo3") {
    // Veo 3.1 Quality
    return 400
  } else if (model === "veo3fast" || model === "kie-ai/veo3-fast") {
    // Veo 3.1 Fast
    return 100
  } else {
    // Veo 3.1 Lite (默认)
    return 50
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
      imageUrls,
      model,
      generationType,
      aspectRatio,
      resolution,
      enableTranslation,
      watermark,
      webhookUrl,
      chatMessageId,
    } = body

    // 内部调用时必须提供 userId
    if (!sessionUserId) {
      console.error("Veo 3.1: 内部调用缺少 userId")
      return NextResponse.json({ error: "Invalid internal call: missing userId" }, { status: 400 })
    }

    // 计算实际积分消耗
    const actualPointsCost = calculateVeoPoints(model || "veo3_lite")

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

    // 构建 Veo 3.1 API 请求体
    const kieRequestBody: any = {
      prompt: prompt || "Generate video",
      model: model || "veo3_lite",
      resolution: resolution || "720p",
      aspectRatio: aspectRatio || "16:9",
      enableTranslation: enableTranslation !== false, // 默认启用翻译
    }

    // 设置 generationType
    if (generationType) {
      kieRequestBody.generationType = generationType
    }

    // 添加图片（如果是图生视频或首尾帧模式）
    if (imageUrls && imageUrls.length > 0) {
      kieRequestBody.imageUrls = imageUrls.slice(0, 3) // 最多 3 张图片
    }

    // 添加水印（如果有）
    if (watermark) {
      kieRequestBody.watermark = watermark
    }

    // 始终使用环境变量中的 webhook URL（公网可访问）
    // 忽略前端传来的 webhookUrl，确保 Kie.ai 能回调到公网地址
    const finalWebhookUrl = VEO_WEBHOOK_URL
    const useWebhookMode = !!finalWebhookUrl

    // 复用已有记录
    let recordId: string | undefined = chatMessageId
      ? (await db.query.generationHistory.findFirst({
          where: eq(generationHistory.chatMessageId, chatMessageId),
        }))?.id
      : undefined

    if (useWebhookMode && finalWebhookUrl) {
      // Webhook 模式
      if (!KIE_API_KEY) {
        return NextResponse.json({ error: "Kie.ai API key not configured" }, { status: 500 })
      }

      if (!recordId) {
        recordId = uuidv4()
        await db.insert(generationHistory).values({
          id: recordId,
          userId: sessionUserId,
          type: "video",
          prompt: prompt || "Generate video",
          imageUrls: imageUrls ? JSON.stringify(imageUrls) : "[]",
          model: model || "kie-ai/veo3-lite",
          aspectRatio: aspectRatio,
          resolution: resolution,
          pointsUsed: actualPointsCost,
          requestId: null,
          description: JSON.stringify({ generationType, enableTranslation, watermark }),
          status: "queued",
          createdAt: new Date(),
          chatMessageId: chatMessageId || null,
        })
        console.log("Veo 3.1 记录创建成功（Webhook模式）:", { recordId })
      } else {
        console.log("复用已有 Veo 3.1 记录:", { recordId, chatMessageId })
      }

      // 为回调地址追加 recordId 参数
      const webhookWithRecordId = appendRecordIdParam(finalWebhookUrl, recordId)
      kieRequestBody.callBackUrl = webhookWithRecordId

      // 同步调用 Veo 3.1 API
      try {
        const response = await fetch(KIE_VEO_API_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${KIE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(kieRequestBody),
        })

        if (!response.ok) {
          const errorData = await response.text()
          console.error("Veo 3.1 API error (webhook mode):", response.status, errorData)
          return NextResponse.json(
            { error: "Video generation failed", details: errorData },
            { status: 500 }
          )
        }

        const data = await response.json()

        if (data.code !== 200) {
          console.error("Veo 3.1 API returned error (webhook mode):", data)
          return NextResponse.json(
            { error: data.msg || "Video generation failed" },
            { status: data.code === 402 ? 402 : 500 }
          )
        }

        const taskId = data.data?.taskId
        if (!taskId) {
          console.error("No taskId returned from Veo 3.1 API (webhook mode):", data)
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

          console.log("Veo 3.1 记录已更新 taskId（Webhook模式）:", { taskId, recordId })
        } catch (updateError) {
          console.error("更新 Veo 3.1 记录 taskId 失败（Webhook模式）:", updateError)
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
        console.error("创建 Veo 3.1 任务失败（Webhook模式）:", error)
        return NextResponse.json({ error: "Failed to create task" }, { status: 500 })
      }
    }

    // 轮询模式：同步调用 API 然后轮询
    if (!KIE_API_KEY) {
      return NextResponse.json({ error: "Kie.ai API key not configured" }, { status: 500 })
    }

    if (!recordId) {
      recordId = uuidv4()
      await db.insert(generationHistory).values({
        id: recordId,
        userId: sessionUserId,
        type: "video",
        prompt: prompt || "Generate video",
        imageUrls: imageUrls ? JSON.stringify(imageUrls) : "[]",
        model: model || "kie-ai/veo3-lite",
        aspectRatio: aspectRatio,
        resolution: resolution,
        pointsUsed: actualPointsCost,
        requestId: null,
        description: JSON.stringify({ generationType, enableTranslation, watermark }),
        status: "queued",
        createdAt: new Date(),
        chatMessageId: chatMessageId || null,
      })
      console.log("Veo 3.1 记录创建成功（轮询模式）:", { recordId })
    } else {
      console.log("复用已有 Veo 3.1 记录:", { recordId, chatMessageId })
    }

    // 同步调用 Veo 3.1 API
    let taskId: string | null = null
    try {
      const response = await fetch(KIE_VEO_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${KIE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(kieRequestBody),
      })

      if (!response.ok) {
        const errorData = await response.text()
        console.error("Veo 3.1 API error (polling mode):", response.status, errorData)
        return NextResponse.json(
          { error: "Video generation failed", details: errorData },
          { status: 500 }
        )
      }

      const data = await response.json()

      if (data.code !== 200) {
        console.error("Veo 3.1 API returned error (polling mode):", data)
        return NextResponse.json(
          { error: data.msg || "Video generation failed" },
          { status: data.code === 402 ? 402 : 500 }
        )
      }

      taskId = data.data?.taskId
      if (!taskId) {
        console.error("No taskId returned from Veo 3.1 API (polling mode):", data)
        return NextResponse.json({ error: "No task ID returned" }, { status: 500 })
      }

      // 同步更新数据库（轮询模式：保持 queued，轮询完成后直接 completed）
      try {
        await db
          .update(generationHistory)
          .set({
            requestId: taskId,
            status: "pending",
          })
          .where(eq(generationHistory.id, recordId))

        console.log("Veo 3.1 记录已更新 taskId（轮询模式）:", { taskId, recordId })
      } catch (updateError) {
        console.error("更新 Veo 3.1 记录 taskId 失败（轮询模式）:", updateError)
      }
    } catch (error) {
      console.error("创建 Veo 3.1 任务失败（轮询模式）:", error)
      return NextResponse.json({ error: "Failed to create task" }, { status: 500 })
    }

    // 轮询模式：等待结果
    const maxRetries = 60 // 60次 * 5秒 = 5分钟
    let retryCount = 0
    let taskResult: any = null

    while (retryCount < maxRetries) {
      try {
        const queryResponse = await fetch(`${KIE_VEO_QUERY_URL}?taskId=${taskId}`, {
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
            const state = taskData.state

            if (state === 'success') {
              // 解析结果
              const info = taskData.info || {}
              const resultUrls = info.resultUrls || []
              const resultUrl = resultUrls[0]

              if (resultUrl) {
                taskResult = {
                  resultUrl,
                  originUrl: info.originUrls?.[0],
                  resolution: info.resolution || "720p"
                }
                break
              }
            } else if (state === 'fail') {
              console.error('Veo 3.1 任务失败:', taskData.failMsg || taskData.failCode)
              return NextResponse.json({ error: taskData.failMsg || "Video generation failed" }, { status: 500 })
            }
          }
        }

        // 等待5秒后重试
        await new Promise(resolve => setTimeout(resolve, 5000))
        retryCount++
      } catch (queryError) {
        console.error('轮询 Veo 3.1 任务状态失败:', queryError)
        retryCount++
      }
    }

    if (!taskResult) {
      return NextResponse.json({ error: "Video generation timeout" }, { status: 500 })
    }

    const { resultUrl, originUrl, resolution: finalResolution } = taskResult

    // 更新数据库记录
    try {
      await db.update(generationHistory)
        .set({
          imageUrls: JSON.stringify([resultUrl]),
          resolution: finalResolution,
          status: 'completed'
        })
        .where(eq(generationHistory.id, recordId))
      console.log('Veo 3.1 记录更新成功:', { recordId })
    } catch (dbError) {
      console.error('更新 Veo 3.1 数据库记录失败:', dbError)
    }

    // 扣除积分
    try {
      await usePoints(sessionUserId, actualPointsCost, "AI视频", "ai_video")
      console.log('Veo 3.1 积分扣除成功:', { taskId, userId: sessionUserId, actualPointsCost })
    } catch (pointsError) {
      console.error('Veo 3.1 积分扣除失败:', pointsError)
    }

    // 触发视频搬运任务
    try {
      console.log('Veo 3.1 触发搬运任务:', {
        taskId,
        videoUrls: [resultUrl],
        recordId,
        userId: sessionUserId
      })
      await saveVideosToR2Task.trigger({
        videoUrls: [resultUrl],
        recordId: recordId,
        userId: sessionUserId,
        chatMessageId: chatMessageId || undefined,
      })
      console.log('Veo 3.1 搬运任务触发成功')
    } catch (error) {
      console.error('Veo 3.1 触发搬运任务失败:', error)
    }

    return NextResponse.json({
      success: true,
      videoUrl: resultUrl,
      originalUrl: originUrl,
      resolution: finalResolution,
      requestId: taskId,
      pointsCost: actualPointsCost,
    })
  } catch (error) {
    console.error("Kie.ai Veo 3.1 API Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
