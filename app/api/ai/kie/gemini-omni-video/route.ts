import { NextRequest, NextResponse } from "next/server"
import { authOptions } from "@/lib/auth"
import { getServerSession } from "next-auth"
import { usePoints, getUserPointsDetail } from "@/lib/points-manager"
import { db } from "@/lib/db"
import { generationHistory } from "@/lib/schema"
import { saveVideosToR2Task } from "@/src/trigger/save-videos-to-r2"
import { v4 as uuidv4 } from "uuid"
import { eq } from "drizzle-orm"

// Kie.ai Gemini Omni Video API 配置
const KIE_API_URL = "https://api.kie.ai/api/v1/jobs/createTask"
const KIE_API_KEY = process.env.KIE_API_KEY!

// Webhook URL
const GEMINI_WEBHOOK_URL = process.env.KIE_GEMINI_WEBHOOK_URL || process.env.KIE_WEBHOOK_URL

/**
 * 计算 Gemini Omni Video 积分消耗
 * 有视频输入: 720p/1080p = 135积分, 4K = 200积分
 * 无视频输入: 720p/1080p
 *   - 4s = 50积分, 6s = 65积分, 8s = 80积分, 10s = 95积分
 * 无视频输入: 4K
 *   - 4s = 115积分, 6s = 130积分, 8s = 150积分, 10s = 165积分
 */
function calculatePointsCost(hasVideoInput: boolean, resolution: string, duration: string): number {
  if (hasVideoInput) {
    // 有视频输入
    if (resolution === "4K") {
      return 200
    }
    return 135 // 720p 或 1080p
  }

  // 无视频输入 - 根据 resolution 和 duration 计算
  if (resolution === "4K") {
    const durationMap: Record<string, number> = {
      "4": 115,
      "6": 130,
      "8": 150,
      "10": 165,
    }
    return durationMap[duration] || 165
  }

  // 720p/1080p
  const durationMap: Record<string, number> = {
    "4": 50,
    "6": 65,
    "8": 80,
    "10": 95,
  }
  return durationMap[duration] || 95
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
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }
      sessionUserId = session.user.id
    }

    const {
      prompt,
      imageUrls,
      videoList,
      characterIds,
      model,
      aspectRatio,
      resolution,
      duration,
      seed,
      webhookUrl,
      chatMessageId,
    } = body

    // 内部调用时必须提供 userId
    if (!sessionUserId) {
      console.error("Gemini Omni Video: 内部调用缺少 userId")
      return NextResponse.json({ error: "Invalid internal call: missing userId" }, { status: 400 })
    }

    if (!prompt || !prompt.trim()) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 })
    }

    // 判断是否有视频输入
    const hasVideoInput = !!(videoList && videoList.length > 0)
    const effectiveResolution = resolution || "720p"
    const effectiveDuration = duration || "8"

    // 计算实际积分消耗
    const actualPointsCost = calculatePointsCost(hasVideoInput, effectiveResolution, effectiveDuration)

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

    // 构建 Gemini Omni Video API 请求体
    const kieRequestBody: any = {
      model: "gemini-omni-video",
      input: {
        prompt: prompt,
      },
    }

    // 添加时长
    if (!hasVideoInput) {
      kieRequestBody.input.duration = effectiveDuration
    }

    // 添加画面比例
    if (aspectRatio) {
      kieRequestBody.input.aspect_ratio = aspectRatio
    }

    // 添加分辨率
    if (resolution) {
      kieRequestBody.input.resolution = resolution
    }

    // 添加 seed
    if (seed !== undefined) {
      kieRequestBody.input.seed = seed
    }

    // 添加图片（图生视频、参考生视频）
    if (imageUrls && imageUrls.length > 0) {
      kieRequestBody.input.image_urls = imageUrls.slice(0, 7)
    }

    // 添加视频（参考生视频）
    if (videoList && videoList.length > 0) {
      kieRequestBody.input.video_list = videoList.slice(0, 1)
    }

    // 添加角色 ID（参考生视频）
    if (characterIds && characterIds.length > 0) {
      kieRequestBody.input.character_ids = characterIds.slice(0, 3)
    }

    // 添加音频 ID
    if (body.audioIds && body.audioIds.length > 0) {
      kieRequestBody.input.audio_ids = body.audioIds.slice(0, 3)
    }

    // Webhook URL 配置
    const finalWebhookUrl = GEMINI_WEBHOOK_URL
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
          prompt: prompt,
          imageUrls: imageUrls ? JSON.stringify(imageUrls) : "[]",
          model: "kie-ai/gemini-omni-video",
          aspectRatio: aspectRatio,
          resolution: resolution,
          pointsUsed: actualPointsCost,
          requestId: null,
          description: JSON.stringify({
            duration: effectiveDuration,
            videoList,
            characterIds,
            audioIds: body.audioIds,
            hasVideoInput,
          }),
          status: "queued",
          createdAt: new Date(),
          chatMessageId: chatMessageId || null,
        })
        console.log("Gemini Omni Video 记录创建成功（Webhook模式）:", { recordId })
      } else {
        console.log("复用已有 Gemini Omni Video 记录:", { recordId, chatMessageId })
      }

      // 为回调地址追加 recordId 参数
      const webhookWithRecordId = appendRecordIdParam(finalWebhookUrl, recordId)
      kieRequestBody.callBackUrl = webhookWithRecordId

      // 同步调用 Gemini Omni Video API
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
          console.error("Gemini Omni Video API error (webhook mode):", response.status, errorData)
          return NextResponse.json(
            { error: "Video generation failed", details: errorData },
            { status: 500 }
          )
        }

        const data = await response.json()

        if (data.code !== 200) {
          console.error("Gemini Omni Video API returned error (webhook mode):", data)
          return NextResponse.json(
            { error: data.msg || "Video generation failed" },
            { status: data.code === 402 ? 402 : 500 }
          )
        }

        const taskId = data.data?.taskId
        if (!taskId) {
          console.error("No taskId returned from Gemini Omni Video API (webhook mode):", data)
          return NextResponse.json({ error: "No task ID returned" }, { status: 500 })
        }

        // 同步更新数据库（保持 queued 状态，等 Webhook 回调时再扣积分）
        try {
          await db
            .update(generationHistory)
            .set({
              requestId: taskId,
            })
            .where(eq(generationHistory.id, recordId))

          console.log("Gemini Omni Video 记录已更新 taskId（Webhook模式）:", { taskId, recordId })
        } catch (updateError) {
          console.error("更新 Gemini Omni Video 记录 taskId 失败（Webhook模式）:", updateError)
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
        console.error("创建 Gemini Omni Video 任务失败（Webhook模式）:", error)
        return NextResponse.json({ error: "Failed to create task" }, { status: 500 })
      }
    }

    // 非 Webhook 模式不支持（Gemini Omni Video 需要 Webhook）
    return NextResponse.json(
      { error: "Gemini Omni Video requires webhook mode" },
      { status: 500 }
    )
  } catch (error) {
    console.error("Kie.ai Gemini Omni Video API Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
