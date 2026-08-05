import { NextRequest, NextResponse } from "next/server"
import { authOptions } from "@/lib/auth"
import { getServerSession } from "next-auth"
import { getUserPointsDetail } from "@/lib/points-manager"
import { db } from "@/lib/db"
import { chatMessages, chatSessions, generationHistory } from "@/lib/schema"
import { eq, and, asc } from "drizzle-orm"
import { v4 as uuidv4 } from "uuid"

const WEBHOOK_URL = process.env.KIE_WEBHOOK_URL
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"

// 获取某个会话的所有消息
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get("sessionId")

    if (!sessionId) {
      return NextResponse.json({ error: "sessionId is required" }, { status: 400 })
    }

    // 验证会话归属
    const [chatSession] = await db
      .select()
      .from(chatSessions)
      .where(and(eq(chatSessions.id, sessionId), eq(chatSessions.userId, session.user.id)))

    if (!chatSession) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 })
    }

    const messages = await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.sessionId, sessionId))
      .orderBy(asc(chatMessages.createdAt))

    // 解析 JSON 字段
    const parsedMessages = messages.map((msg) => ({
      ...msg,
      inputImageUrls: JSON.parse(msg.inputImageUrls || "[]"),
      outputImageUrls: JSON.parse(msg.outputImageUrls || "[]"),
      outputVideoUrls: JSON.parse(msg.outputVideoUrls || "[]"),
      metadata: JSON.parse(msg.metadata || "{}"),
    }))

    return NextResponse.json({ success: true, data: parsedMessages })
  } catch (error) {
    console.error("获取消息失败:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// 发送消息（创建用户消息 + 触发 AI 生成 + 创建 AI 回复消息）
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const {
      sessionId,
      content,
      inputImageUrls = [],
      aspectRatio = "auto",
      resolution = "auto",
      model = "nanoBananaPro",
      quality,
      contentType,
      videoGenerateMode,
      duration,
      audioSetting,
    } = body

    if (!sessionId) {
      return NextResponse.json({ error: "sessionId is required" }, { status: 400 })
    }

    // 验证会话归属
    const [chatSession] = await db
      .select()
      .from(chatSessions)
      .where(and(eq(chatSessions.id, sessionId), eq(chatSessions.userId, session.user.id)))

    if (!chatSession) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 })
    }

    const isEditMode = inputImageUrls.length > 0
    const isVideoMode = contentType === "video"

    // 计算积分消耗
    let pointsCost = 15
    if (isVideoMode) {
      // 视频模式积分计算
      const videoDuration = duration || 5
      if (model === "seedance2fast") {
        // Seedance 2.0 Fast: 有视频=15/35, 无视频=25/55 (480p/720p)
        const effectiveResolution = resolution === "1080p" ? "720p" : resolution
        const hasReferenceVideo = false // 暂时不考虑参考视频
        const pointsPerSecond = hasReferenceVideo
          ? (effectiveResolution === "480p" ? 15 : 35)
          : (effectiveResolution === "480p" ? 25 : 55)
        pointsCost = pointsPerSecond * videoDuration
      } else if (model === "seedance2mini") {
        // Seedance 2.0 Mini: 有视频=10/20, 无视频=15/35 (480p/720p)
        const effectiveResolution = resolution === "1080p" ? "720p" : resolution
        const hasReferenceVideo = false // 暂时不考虑参考视频
        const pointsPerSecond = hasReferenceVideo
          ? (effectiveResolution === "480p" ? 10 : 20)
          : (effectiveResolution === "480p" ? 15 : 35)
        pointsCost = pointsPerSecond * videoDuration
      } else if (model === "wan27") {
        // Wan 2.7: 720p=25积分/s, 1080p=40积分/s
        const pointsPerSecond = resolution === "1080p" ? 40 : 25
        pointsCost = pointsPerSecond * videoDuration
      } else if (model === "happyhorse") {
        // HappyHorse 1.0: 720p=45积分/s, 1080p=80积分/s
        const pointsPerSecond = resolution === "1080p" ? 80 : 45
        pointsCost = pointsPerSecond * videoDuration
      } else if (model === "happyhorse11") {
        // HappyHorse 1.1: 720p=35积分/s, 1080p=45积分/s
        const pointsPerSecond = resolution === "1080p" ? 45 : 35
        pointsCost = pointsPerSecond * videoDuration
      } else if (model === "klingV3Turbo") {
        // Kling V3 Turbo: 720p=25积分/s, 1080p=40积分/s
        const pointsPerSecond = resolution === "1080p" ? 40 : 25
        pointsCost = pointsPerSecond * videoDuration
      } else if (model.startsWith("veo")) {
        // Veo 系列: 固定价格
        if (model === "veo3") pointsCost = 400
        else if (model === "veo3fast") pointsCost = 100
        else pointsCost = 50
      } else {
        // Seedance 2.0: 有视频=20/40/100, 无视频=30/70/170
        const pointsPerSecond = resolution === "480p" ? 30 : resolution === "720p" ? 70 : 170
        pointsCost = pointsPerSecond * videoDuration
      }
    } else if (model === "gptImage1_5") {
      pointsCost = quality === "high" ? 35 : 6
    } else if (model === "seedream5Lite") {
      pointsCost = 9
    } else if (model === "seedream5Pro") {
      // Seedream 5.0 Pro: basic=10积分, high=25积分
      pointsCost = quality === "high" ? 25 : 10
    } else if (model === "nanoBanana2Lite") {
      // Nano Banana 2 Lite: 1K=6积分
      pointsCost = 6
    } else {
      const pointsMap: { [key: string]: { "1K": number; "2K": number; "4K": number } } = {
        nanoBananaPro: { "1K": 15, "2K": 15, "4K": 30 },
        nanoBanana2: { "1K": 8, "2K": 15, "4K": 20 }
      }
      pointsCost = pointsMap[model]?.[resolution as keyof typeof pointsMap[typeof model]] || 15
    }
    try {
      const pointsDetail = await getUserPointsDetail(session.user.id)
      if (pointsDetail.totalPoints < pointsCost) {
        return NextResponse.json(
          { error: "Insufficient points", requiredPoints: pointsCost },
          { status: 402 }
        )
      }
    } catch (e) {
      console.error("[chat/messages] 积分检查失败:", e)
      return NextResponse.json({ error: "Failed to check points balance" }, { status: 500 })
    }

    // 创建用户消息记录
    const userMessageId = uuidv4()
    const userMessageCreatedAt = new Date()

    await db.insert(chatMessages).values({
      id: userMessageId,
      sessionId,
      role: "user",
      content: content || "",
      inputImageUrls: JSON.stringify(inputImageUrls),
      outputImageUrls: "[]",
      metadata: JSON.stringify({ aspectRatio, resolution, model, contentType, videoGenerateMode, duration, audioSetting }),
      status: "completed",
      createdAt: userMessageCreatedAt,
    })

    // 更新会话标题（如果还没有自定义标题的话）
    let sessionType = "chat"
    if (isVideoMode) {
      sessionType = "video"
    } else if (isEditMode || inputImageUrls.length > 0) {
      sessionType = "image"
    }

    if (chatSession.title === "新对话" && content) {
      const newTitle = content.slice(0, 30) + (content.length > 30 ? "..." : "")
      await db
        .update(chatSessions)
        .set({ title: newTitle, type: sessionType, updatedAt: userMessageCreatedAt })
        .where(eq(chatSessions.id, sessionId))
    } else {
      await db
        .update(chatSessions)
        .set({ type: sessionType, updatedAt: userMessageCreatedAt })
        .where(eq(chatSessions.id, sessionId))
    }

    // 创建占位的 AI 回复消息（pending 状态）
    const assistantMessageId = uuidv4()

    await db.insert(chatMessages).values({
      id: assistantMessageId,
      sessionId,
      role: "assistant",
      content: "",
      inputImageUrls: "[]",
      outputImageUrls: "[]",
      outputVideoUrls: "[]",
      metadata: JSON.stringify({ aspectRatio, resolution, isEditMode, contentType, videoGenerateMode, duration, audioSetting, model }),
      status: "pending",
      createdAt: new Date(),
    })

    // 模型映射
    const modelMap: { [key: string]: string } = {
      "nanoBananaPro": "kie-ai/nano-banana-pro",
      "nanoBanana2": "kie-ai/nano-banana-2",
      "gptImage1_5": "kie-ai/gpt-image/1.5-text-to-image",
      "seedream5Lite": "kie-ai/seedream/5-lite",
      "seedream5Pro": "kie-ai/seedream/5-pro",
      "nanoBanana2Lite": "kie-ai/nano-banana-2-lite"
    }

    // 创建 generationHistory 记录（关联 chatMessageId，以便 webhook 回调时更新消息状态）
    const recordId = uuidv4()

    // 视频模型映射
    const videoModelMap: { [key: string]: string } = {
      "happyhorse": "happyhorse/text-to-video",
      "happyhorse11": "happyhorse-1-1/text-to-video",
      "klingV3Turbo": "kling/v3-turbo-text-to-video",
      "seedance2fast": "kie-ai/seedance-2-fast",
      "seedance2": "kie-ai/seedance-2",
      "seedance2mini": "kie-ai/seedance-2-mini",
      "veo3": "kie-ai/veo3",
      "veo3fast": "kie-ai/veo3-fast",
      "veo3lite": "kie-ai/veo3-lite",
      "wan27": "wan/2-7-text-to-video",
    }

    try {
      await db.insert(generationHistory).values({
        id: recordId,
        userId: session.user.id,
        type: isVideoMode ? "video" : (isEditMode ? "edit" : "generate"),
        prompt: content || (isEditMode ? "Edit image" : isVideoMode ? "Video generation" : ""),
        imageUrls: "[]",
        model: isVideoMode
          ? (videoModelMap[model] || `kie-ai/${model}`)
          : (modelMap[model] || "kie-ai/nano-banana-pro"),
        aspectRatio,
        resolution,
        pointsUsed: pointsCost,
        requestId: null,
        seed: null,
        description: isVideoMode
          ? JSON.stringify({ videoGenerateMode, duration, audioSetting })
          : null,
        status: "queued",
        createdAt: new Date(),
        chatMessageId: assistantMessageId,
      })
    } catch (dbErr) {
      console.error("创建 generationHistory 失败:", dbErr)
    }

    const useWebhookMode = !!WEBHOOK_URL

    // 视频模式：直接返回，让前端调用对应的视频 API
    if (isVideoMode) {
      return NextResponse.json({
        success: true,
        userMessageId,
        assistantMessageId,
        recordId,
        pointsCost,
        mode: "video",
        message: "视频生成任务已创建，请在浏览器端完成后续调用",
      })
    }

    if (useWebhookMode) {
      // Webhook 模式：同步调用 AI API（避免延迟问题）
      try {
        const endpoint = isEditMode ? `${BASE_URL}/api/ai/kie/edit` : `${BASE_URL}/api/ai/kie/generate`
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-internal-call": "true" },
          body: JSON.stringify({
            prompt: content,
            imageUrls: inputImageUrls,
            aspectRatio,
            resolution,
            model,
            quality,
            webhookUrl: WEBHOOK_URL,
            chatMessageId: assistantMessageId,
            userId: session.user.id,
          }),
        })

        if (!res.ok) {
          const data = await res.json()
          console.error("AI API 调用失败:", res.status, data)
          const errorMsg = res.status === 402 ? "积分不足" : (data.error || "Generation failed")
          await db
            .update(chatMessages)
            .set({ status: "error", errorMessage: errorMsg })
            .where(eq(chatMessages.id, assistantMessageId))
          return NextResponse.json({ error: errorMsg }, { status: res.status === 402 ? 402 : 500 })
        }

        // API 返回后更新 generationHistory 的 requestId
        const data = await res.json()
        if (data.recordId) {
          await db
            .update(generationHistory)
            .set({ requestId: data.requestId || null, status: "pending" })
            .where(eq(generationHistory.id, data.recordId))
        }
      } catch (err) {
        console.error("AI API 调用失败:", err)
        await db
          .update(chatMessages)
          .set({ status: "error", errorMessage: "Request failed" })
          .where(eq(chatMessages.id, assistantMessageId))
        return NextResponse.json({ error: "Request failed" }, { status: 500 })
      }
    } else {
      // 非 webhook 模式：同步调用（会轮询等待结果）
      try {
        const endpoint = isEditMode ? `${BASE_URL}/api/ai/kie/edit` : `${BASE_URL}/api/ai/kie/generate`
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-internal-call": "true" },
          body: JSON.stringify({
            prompt: content,
            imageUrls: inputImageUrls,
            aspectRatio,
            resolution,
            model,
            webhookUrl: null,
            userId: session.user.id,
          }),
        })

        const data = await res.json()

        if (!res.ok) {
          const errorMsg = res.status === 402 ? "积分不足" : (data.error || "Generation failed")
          await db
            .update(chatMessages)
            .set({ status: "error", errorMessage: errorMsg })
            .where(eq(chatMessages.id, assistantMessageId))
          return NextResponse.json({ error: errorMsg }, { status: res.status === 402 ? 402 : 500 })
        }

        if (data.images && data.images.length > 0) {
          const imageUrls = data.images.map((img: any) => img.url || img)
          await db
            .update(chatMessages)
            .set({
              outputImageUrls: JSON.stringify(imageUrls),
              content: data.description || "",
              metadata: JSON.stringify({
                aspectRatio,
                resolution,
                isEditMode,
                requestId: data.requestId,
                pointsUsed: data.pointsCost,
                seed: data.seed,
              }),
              status: "completed",
            })
            .where(eq(chatMessages.id, assistantMessageId))
        }
      } catch (err) {
        console.error("AI 生成失败:", err)
        const errorMsg = err instanceof Error ? err.message : "Internal error"
        await db
          .update(chatMessages)
          .set({ status: "error", errorMessage: errorMsg })
          .where(eq(chatMessages.id, assistantMessageId))
        return NextResponse.json({ error: errorMsg }, { status: 500 })
      }
    }

    // 立即返回，前端通过 Pusher 监听结果更新
    return NextResponse.json({
      success: true,
      data: {
        userMessageId,
        assistantMessageId,
        useWebhook: useWebhookMode,
      },
    })
  } catch (error) {
    console.error("发送消息失败:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
