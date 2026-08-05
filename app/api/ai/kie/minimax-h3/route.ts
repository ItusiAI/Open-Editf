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

// MiniMax H3 积分消耗规则
// 文生视频/图生视频/参考生视频: 2K 分辨率固定 50 积分
// 参考生视频: 5 张以上图片 15 积分/张
function calculateMiniMaxPoints(videoGenerateMode: string, imageCount: number): number {
  const basePoints = 50
  if (videoGenerateMode === "reference2video" && imageCount > 5) {
    return basePoints + 15 * (imageCount - 5)
  }
  return basePoints
}

function appendRecordIdParam(baseUrl: string, recordId: string) {
  const hasQuery = baseUrl.includes("?")
  const separator = hasQuery ? "&" : "?"
  return `${baseUrl}${separator}recordId=${encodeURIComponent(recordId)}`
}

// 获取 MiniMax H3 的 API 模型名称
// 首尾帧与图生视频共用同一端点（image-to-video），仅多传 last_frame_url
function getMiniMaxModelName(videoGenerateMode: string): string {
  if (videoGenerateMode === "firstlast2video") {
    return "minimax-h3/image-to-video"
  }
  switch (videoGenerateMode) {
    case "image2video":
      return "minimax-h3/image-to-video"
    case "reference2video":
      return "minimax-h3/reference-to-video"
    default:
      return "minimax-h3/text-to-video"
  }
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
      duration,
      videoGenerateMode,
      imageUrls,
      referenceImageUrls,
      referenceVideoUrls,
      referenceAudioUrls,
      firstFrameUrl,
      lastFrameUrl,
      chatMessageId,
      watermark,
      seed,
      nsfwChecker,
      promptExtend,
    } = body

    // 内部调用时必须提供 userId
    if (!sessionUserId) {
      console.error("MiniMax H3: 内部调用缺少 userId")
      return NextResponse.json({ error: "Invalid internal call: missing userId" }, { status: 400 })
    }

    // 计算实际积分消耗
    const imageCount = (referenceImageUrls && referenceImageUrls.length > 0)
      ? referenceImageUrls.length
      : (imageUrls && imageUrls.length > 0)
        ? imageUrls.length
        : 0
    const actualPointsCost = calculateMiniMaxPoints(videoGenerateMode || "text2video", imageCount)

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
    const mode = videoGenerateMode || "text2video"
    const kieModel = getMiniMaxModelName(mode)

    // 构建 Kie.ai API 请求体
    const kieRequestBody: any = {
      model: kieModel,
      input: {
        prompt: prompt || "Generate video",
        aspect_ratio: aspectRatio || "16:9",
        duration: duration !== undefined ? duration : 6,
      },
    }

    // 根据生成模式设置不同的参数
    if (mode === "image2video") {
      // 图生视频：使用首帧图片 URL
      if (imageUrls && imageUrls.length > 0) {
        kieRequestBody.input.first_frame_url = imageUrls[0]
      } else if (firstFrameUrl) {
        kieRequestBody.input.first_frame_url = firstFrameUrl
      }
    } else if (mode === "firstlast2video") {
      // 首尾帧视频：复用 image-to-video 端点，传入首帧与尾帧
      if (referenceImageUrls && referenceImageUrls.length >= 2) {
        kieRequestBody.input.first_frame_url = referenceImageUrls[0]
        kieRequestBody.input.last_frame_url = referenceImageUrls[1]
      } else {
        if (firstFrameUrl) {
          kieRequestBody.input.first_frame_url = firstFrameUrl
        }
        if (lastFrameUrl) {
          kieRequestBody.input.last_frame_url = lastFrameUrl
        }
      }
    } else if (mode === "reference2video") {
      // 参考生视频：使用参考图片/视频
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
    // text2video 模式：仅需 prompt + aspect_ratio + duration

    // 可选参数
    if (nsfwChecker === false) {
      kieRequestBody.input.nsfw_checker = false
    }
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
          resolution: "2K",
          pointsUsed: actualPointsCost,
          requestId: null,
          seed: seed ? String(seed) : null,
          description: JSON.stringify({ videoGenerateMode: mode, duration }),
          status: "queued",
          createdAt: new Date(),
          chatMessageId: chatMessageId || null,
        })
        console.log("MiniMax H3 记录创建成功（Webhook模式）:", { recordId })
      } else {
        console.log("复用已有 MiniMax H3 记录:", { recordId, chatMessageId })
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
          console.error("Kie.ai API error (MiniMax H3 webhook mode):", response.status, errorData)
          return NextResponse.json(
            { error: "Video generation failed", details: errorData },
            { status: 500 }
          )
        }

        const data = await response.json()

        if (data.code !== 200) {
          console.error("Kie.ai API returned error (MiniMax H3 webhook mode):", data)
          return NextResponse.json(
            { error: data.msg || "Video generation failed" },
            { status: 500 }
          )
        }

        const taskId = data.data?.taskId
        if (!taskId) {
          console.error("No taskId returned from Kie.ai (MiniMax H3 webhook mode):", data)
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

          console.log("MiniMax H3 记录已更新 taskId（Webhook模式）:", { taskId, recordId })
        } catch (updateError) {
          console.error("更新 MiniMax H3 记录 taskId 失败（Webhook模式）:", updateError)
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
        console.error("创建 MiniMax H3 任务失败（Webhook模式）:", error)
        return NextResponse.json({ error: "Failed to create task" }, { status: 500 })
      }
    }

    // 非 Webhook：暂不支持轮询
    return NextResponse.json({ error: "Polling mode not supported for MiniMax H3" }, { status: 501 })

  } catch (error) {
    console.error("Kie.ai MiniMax H3 API Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
