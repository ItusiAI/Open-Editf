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

// Wan 2.7 积分消耗规则: 720p=25积分/s, 1080p=40积分/s
function calculateVideoPoints(resolution: string, duration: number): number {
  const pointsPerSecond = resolution === "1080p" ? 40 : 25
  return pointsPerSecond * duration
}

// 获取 Wan 模型的 API 名称
function getWanModelName(videoGenerateMode: string): string {
  switch (videoGenerateMode) {
    case "image2video":
    case "firstlast2video":
      return "wan/2-7-image-to-video"
    case "reference2video":
      return "wan/2-7-r2v"
    case "videoEdit":
      return "wan/2-7-videoedit"
    default:
      return "wan/2-7-text-to-video"
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
      videoUrl,
      firstFrameUrl,
      lastFrameUrl,
      referenceImage,
      referenceVideo,
      chatMessageId,
      negativePrompt,
      watermark,
      seed,
      nsfwChecker,
      promptExtend,
    } = body

    // 内部调用时必须提供 userId
    if (!sessionUserId) {
      console.error("Wan 2.7: 内部调用缺少 userId")
      return NextResponse.json({ error: "Invalid internal call: missing userId" }, { status: 400 })
    }

    // 计算实际积分消耗
    const actualDuration = videoGenerateMode === "videoEdit" ? 0 : (duration !== undefined ? duration : 5)
    const actualPointsCost = calculateVideoPoints(resolution || "720p", actualDuration || 5)

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
    const kieModel = getWanModelName(videoGenerateMode || "text2video")

    // 构建 Kie.ai API 请求体
    const kieRequestBody: any = {
      model: kieModel,
      input: {
        prompt: prompt || "Generate video",
        resolution: resolution || "720p",
        aspect_ratio: aspectRatio || "16:9",
        prompt_extend: promptExtend !== false,
        watermark: watermark === true,
      },
    }

    // 根据生成模式设置不同的参数
    if (videoGenerateMode === "videoEdit") {
      // 视频编辑：需要 video_url
      if (videoUrl) {
        kieRequestBody.input.video_url = videoUrl
        // duration: 0 表示使用原视频时长
        kieRequestBody.input.duration = 0
        // 可选：参考图
        if (referenceImage) {
          kieRequestBody.input.reference_image = referenceImage
        }
      } else {
        console.error("Wan 2.7 视频编辑缺少 video_url")
        return NextResponse.json({ error: "Video URL is required for video editing" }, { status: 400 })
      }
    } else if (videoGenerateMode === "image2video" && firstFrameUrl) {
      // 图生视频：使用首帧图片
      kieRequestBody.input.first_frame_url = firstFrameUrl
      kieRequestBody.input.duration = duration !== undefined ? duration : 5
    } else if (videoGenerateMode === "firstlast2video") {
      // 首尾帧视频：使用首帧和尾帧图片
      if (firstFrameUrl) {
        kieRequestBody.input.first_frame_url = firstFrameUrl
      }
      if (lastFrameUrl) {
        kieRequestBody.input.last_frame_url = lastFrameUrl
      }
      kieRequestBody.input.duration = duration !== undefined ? duration : 5
    } else if (videoGenerateMode === "reference2video") {
      // 参考生视频：使用参考图片和视频
      if (referenceImage && referenceImage.length > 0) {
        kieRequestBody.input.reference_image = referenceImage.slice(0, 5)
      }
      if (referenceVideo && referenceVideo.length > 0) {
        kieRequestBody.input.reference_video = referenceVideo.slice(0, 5)
      }
      kieRequestBody.input.duration = duration !== undefined ? duration : 5
    } else {
      // 文生视频
      kieRequestBody.input.duration = duration !== undefined ? duration : 5
    }

    // 可选参数
    if (negativePrompt) {
      kieRequestBody.input.negative_prompt = negativePrompt
    }
    if (seed !== undefined && seed !== null) {
      kieRequestBody.input.seed = seed
    }
    if (nsfwChecker === false) {
      kieRequestBody.input.nsfw_checker = false
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
          description: JSON.stringify({ videoGenerateMode, duration }),
          status: "queued",
          createdAt: new Date(),
          chatMessageId: chatMessageId || null,
        })
        console.log("Wan 2.7 记录创建成功（Webhook模式）:", { recordId })
      } else {
        console.log("复用已有 Wan 2.7 记录:", { recordId, chatMessageId })
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
          console.error("Kie.ai API error (Wan webhook mode):", response.status, errorData)
          return NextResponse.json(
            { error: "Video generation failed", details: errorData },
            { status: 500 }
          )
        }

        const data = await response.json()

        if (data.code !== 200) {
          console.error("Kie.ai API returned error (Wan webhook mode):", data)
          return NextResponse.json(
            { error: data.msg || "Video generation failed" },
            { status: 500 }
          )
        }

        const taskId = data.data?.taskId
        if (!taskId) {
          console.error("No taskId returned from Kie.ai (Wan webhook mode):", data)
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

          console.log("Wan 2.7 记录已更新 taskId（Webhook模式）:", { taskId, recordId })
        } catch (updateError) {
          console.error("更新 Wan 2.7 记录 taskId 失败（Webhook模式）:", updateError)
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
        console.error("创建 Kie.ai Wan 2.7 任务失败（Webhook模式）:", error)
        return NextResponse.json({ error: "Failed to create task" }, { status: 500 })
      }
    }

    // 非 Webhook：轮询模式（暂不支持）
    return NextResponse.json({ error: "Polling mode not supported for Wan 2.7" }, { status: 501 })

  } catch (error) {
    console.error("Kie.ai Wan 2.7 API Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
