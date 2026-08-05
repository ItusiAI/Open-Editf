import { NextRequest, NextResponse } from "next/server"
import { authOptions } from "@/lib/auth"
import { getServerSession } from "next-auth"
import { getUserPointsDetail } from "@/lib/points-manager"
import { db } from "@/lib/db"
import { generationHistory } from "@/lib/schema"
import { v4 as uuidv4 } from "uuid"
import { eq } from "drizzle-orm"

// Kie.ai API 配置
const KIE_API_URL = "https://api.kie.ai/api/v1/jobs/createTask"
const KIE_API_KEY = process.env.KIE_API_KEY!
// Webhook URL - 视频专用 webhook
const VIDEO_WEBHOOK_URL = process.env.KIE_VIDEO_WEBHOOK_URL

// Kling V3 Turbo 积分消耗规则: 720p=25积分/s, 1080p=40积分/s
function calculateVideoPoints(resolution: string, duration: number): number {
  const pointsPerSecond = resolution === "1080p" ? 40 : 25
  return pointsPerSecond * duration
}

// 获取 Kling V3 Turbo 模型的 API 名称
function getKlingV3TurboModelName(videoGenerateMode: string): string {
  switch (videoGenerateMode) {
    case "image2video":
      return "kling/v3-turbo-image-to-video"
    default:
      return "kling/v3-turbo-text-to-video"
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
      aspectRatio,
      resolution,
      duration,
      videoGenerateMode,
      imageUrls,
      firstFrameUrl,
      chatMessageId,
      seed,
    } = body

    // 内部调用时必须提供 userId
    if (!sessionUserId) {
      console.error("Kling V3 Turbo: 内部调用缺少 userId")
      return NextResponse.json({ error: "Invalid internal call: missing userId" }, { status: 400 })
    }

    const safeDuration = duration !== undefined && duration !== null ? Number(duration) : 5
    const actualPointsCost = calculateVideoPoints(resolution || "720p", safeDuration || 5)

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
    const kieModel = getKlingV3TurboModelName(videoGenerateMode || "text2video")

    // 构建 Kie.ai API 请求体
    const kieRequestBody: any = {
      model: kieModel,
      input: {
        prompt: prompt || "Generate video",
        duration: String(safeDuration || 5),
      },
    }

    // 设置公共参数
    if (videoGenerateMode === "image2video") {
      // 图生视频：使用第一张图片作为首帧
      if (imageUrls && imageUrls.length > 0) {
        kieRequestBody.input.image_urls = imageUrls.slice(0, 1)
      } else if (firstFrameUrl) {
        kieRequestBody.input.image_urls = [firstFrameUrl]
      } else {
        console.error("Kling V3 Turbo 图生视频缺少图片")
        return NextResponse.json({ error: "Image URL is required for image-to-video" }, { status: 400 })
      }
      // 图生视频需要 resolution
      kieRequestBody.input.resolution = resolution || "720p"
    } else {
      // 文生视频：aspect_ratio + resolution
      kieRequestBody.input.aspect_ratio = aspectRatio || "16:9"
      kieRequestBody.input.resolution = resolution || "720p"
    }

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
          resolution: resolution,
          pointsUsed: actualPointsCost,
          requestId: null,
          seed: seed ? String(seed) : null,
          description: JSON.stringify({ videoGenerateMode, duration: safeDuration }),
          status: "queued",
          createdAt: new Date(),
          chatMessageId: chatMessageId || null,
        })
        console.log("Kling V3 Turbo 记录创建成功（Webhook模式）:", { recordId })
      } else {
        console.log("复用已有 Kling V3 Turbo 记录:", { recordId, chatMessageId })
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
          console.error("Kie.ai API error (Kling V3 Turbo webhook mode):", response.status, errorData)
          return NextResponse.json(
            { error: "Video generation failed", details: errorData },
            { status: 500 }
          )
        }

        const data = await response.json()

        if (data.code !== 200) {
          console.error("Kie.ai API returned error (Kling V3 Turbo webhook mode):", data)
          return NextResponse.json(
            { error: data.msg || "Video generation failed" },
            { status: 500 }
          )
        }

        const taskId = data.data?.taskId
        if (!taskId) {
          console.error("No taskId returned from Kie.ai (Kling V3 Turbo webhook mode):", data)
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

          console.log("Kling V3 Turbo 记录已更新 taskId（Webhook模式）:", { taskId, recordId })
        } catch (updateError) {
          console.error("更新 Kling V3 Turbo 记录 taskId 失败（Webhook模式）:", updateError)
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
        console.error("创建 Kie.ai Kling V3 Turbo 任务失败（Webhook模式）:", error)
        return NextResponse.json({ error: "Failed to create task" }, { status: 500 })
      }
    }

    // 非 Webhook：轮询模式（暂不支持）
    return NextResponse.json({ error: "Polling mode not supported for Kling V3 Turbo" }, { status: 501 })

  } catch (error) {
    console.error("Kie.ai Kling V3 Turbo API Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
