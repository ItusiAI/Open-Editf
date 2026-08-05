import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { db } from "@/lib/db"
import { generationHistory, chatMessages } from "@/lib/schema"
import { saveVideosToR2Task } from "@/src/trigger/save-videos-to-r2"
import { usePoints } from "@/lib/points-manager"
import { eq } from "drizzle-orm"
import Pusher from "pusher"

// Webhook HMAC Key - 从环境变量获取
const WEBHOOK_HMAC_KEY = process.env.KIE_WEBHOOK_HMAC_KEY!

// Pusher 配置
const pusherServer = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.NEXT_PUBLIC_PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.PUSHER_CLUSTER!,
  useTLS: true,
})

/**
 * 生成 webhook 签名
 */
function generateSignature(taskId: string, timestampSeconds: string, secret: string): string {
  const dataToSign = `${taskId}.${timestampSeconds}`
  const hmac = crypto.createHmac('sha256', secret)
  hmac.update(dataToSign)
  return hmac.digest('base64')
}

/**
 * 安全的签名比较（防止时序攻击）
 */
function verifySignature(taskId: string, timestampSeconds: string, receivedSignature: string, secret: string): boolean {
  const expectedSignature = generateSignature(taskId, timestampSeconds, secret)

  if (expectedSignature.length !== receivedSignature.length) {
    return false
  }

  return crypto.timingSafeEqual(
    Buffer.from(expectedSignature),
    Buffer.from(receivedSignature)
  )
}

/**
 * 从请求体获取原始 JSON（不解析）
 */
async function getRawBody(req: NextRequest): Promise<string> {
  const arrayBuffer = await req.arrayBuffer()
  const decoder = new TextDecoder('utf-8')
  return decoder.decode(arrayBuffer)
}

export async function POST(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const recordIdFromQuery = url.searchParams.get("recordId")

    // 获取原始请求体
    const rawBody = await getRawBody(request)
    let bodyData: any
    
    try {
      bodyData = JSON.parse(rawBody)
    } catch (parseError) {
      console.error('Veo 3.1 Webhook 解析失败:', parseError)
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    console.log('Veo 3.1 Webhook 收到回调:', JSON.stringify(bodyData).substring(0, 500))

    // 解析 Veo 3.1 回调数据
    // Veo 3.1 格式: { code, msg, data: { taskId, info: { resultUrls, originUrls, resolution }, fallbackFlag } }
    const { code, msg, data } = bodyData
    
    // 获取 taskId
    const taskId = data?.taskId
    if (!taskId) {
      console.error('Veo 3.1 Webhook: 缺少 taskId')
      return NextResponse.json({ error: 'Missing taskId' }, { status: 400 })
    }

    // 验证签名
    const webhookTimestamp = request.headers.get('X-Webhook-Timestamp')
    const webhookSignature = request.headers.get('X-Webhook-Signature')

    if (WEBHOOK_HMAC_KEY) {
      if (!webhookTimestamp || !webhookSignature) {
        console.error('Veo 3.1 Webhook 验证失败: 缺少签名头')
        return NextResponse.json({ error: 'Missing signature headers' }, { status: 401 })
      }

      const isValid = verifySignature(taskId, webhookTimestamp, webhookSignature, WEBHOOK_HMAC_KEY)

      if (!isValid) {
        console.error('Veo 3.1 Webhook 签名验证失败')
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
      }

      console.log('Veo 3.1 Webhook 签名验证通过:', { taskId })
    } else {
      console.log('Veo 3.1 Webhook 未配置 HMAC Key，跳过签名验证')
    }

    // 获取 info
    const info = data?.info || {}
    const fallbackFlag = data?.fallbackFlag || false

    // 获取原始任务记录
    let existingRecord = null

    if (recordIdFromQuery) {
      existingRecord = await db.query.generationHistory.findFirst({
        where: eq(generationHistory.id, recordIdFromQuery)
      })
    }

    if (!existingRecord) {
      existingRecord = await db.query.generationHistory.findFirst({
        where: eq(generationHistory.requestId, taskId)
      })
    }

    // 测试模式下直接返回
    if (!existingRecord) {
      console.log('Veo 3.1 未找到对应的生成记录（测试模式）:', { taskId, recordIdFromQuery })
      return NextResponse.json({
        status: 'received',
        testMode: true,
        taskId,
      }, { status: 200 })
    }

    // 检查任务状态
    // Veo 3.1: code 200 表示成功，其他表示失败
    if (code !== 200) {
      console.error('Veo 3.1 任务失败:', { taskId, code, msg })

      try {
        await db.update(generationHistory)
          .set({
            status: 'error',
            description: msg || '视频生成失败',
          })
          .where(eq(generationHistory.id, existingRecord.id))

        // 更新聊天消息
        if (existingRecord.chatMessageId) {
          await db.update(chatMessages)
            .set({
              status: 'error',
              errorMessage: msg || '视频生成失败',
            })
            .where(eq(chatMessages.id, existingRecord.chatMessageId))
        }

        // 通过 Pusher 推送失败通知
        try {
          const channelName = `user-${existingRecord.userId}`
          await pusherServer.trigger(channelName, 'kie-result', {
            requestId: taskId,
            type: 'video',
            status: 'error',
            errorMessage: msg || '视频生成失败',
            isVideo: true,
            chatMessageId: existingRecord.chatMessageId || null,
            timestamp: new Date().toISOString(),
          })
          console.log('Veo 3.1 Pusher 失败通知推送成功:', { channel: channelName, taskId })
        } catch (pusherError) {
          console.error('Veo 3.1 Pusher 失败通知推送失败:', pusherError)
        }
      } catch (dbError) {
        console.error('更新 Veo 3.1 失败状态失败:', dbError)
      }

      return NextResponse.json({ status: 'received', taskId, code, msg }, { status: 200 })
    }

    // 解析成功结果
    // Veo 3.1 info 格式: { resultUrls: [], originUrls: [], resolution: "1080p" }
    const resultUrls = info?.resultUrls || []
    const originUrls = info?.originUrls || []
    const resolution = info?.resolution || '720p'
    const resultUrl = resultUrls[0]
    const originalUrl = originUrls[0]

    if (!resultUrl) {
      console.error('Veo 3.1 返回结果为空:', { taskId })
      return NextResponse.json({ error: 'No URL in result' }, { status: 400 })
    }

    console.log('Veo 3.1 Webhook 回调结果:', { 
      taskId, 
      resultUrl, 
      originalUrl,
      resolution,
      fallbackFlag 
    })

    // 更新数据库记录
    try {
      // 检查是否已处理过（避免重复处理）- 只有 queued 状态才处理
      if (existingRecord.status !== 'completed' && existingRecord.status !== 'pending') {
        await db.update(generationHistory)
          .set({
            outputVideoUrls: JSON.stringify([resultUrl]), // 视频保存到 outputVideoUrls
            resolution: resolution,
            status: 'pending'
          })
          .where(eq(generationHistory.id, existingRecord.id))

        // 扣除积分
        try {
          await usePoints(
            existingRecord.userId,
            existingRecord.pointsUsed || 50,
            "AI视频",
            "ai_video"
          )
          console.log('Veo 3.1 积分扣除成功:', {
            taskId,
            userId: existingRecord.userId,
            pointsUsed: existingRecord.pointsUsed,
            fallbackFlag
          })
        } catch (pointsError) {
          console.error('Veo 3.1 积分扣除失败:', pointsError)
        }
      } else {
        console.log('Veo 3.1 记录已处理，跳过:', { taskId, existingRecordStatus: existingRecord.status })
      }

      console.log('Veo 3.1 记录更新成功:', { taskId, recordId: existingRecord.id })
    } catch (dbError) {
      console.error('更新 Veo 3.1 数据库记录失败:', dbError)
    }

    // 更新聊天消息
    if (existingRecord.chatMessageId) {
      try {
        const existingMeta = JSON.parse(existingRecord.description || "{}")
        await db.update(chatMessages)
          .set({
            outputVideoUrls: JSON.stringify([resultUrl]),
            metadata: JSON.stringify({
              ...existingMeta,
              requestId: taskId,
              resolution: resolution,
              fallbackFlag: fallbackFlag,
            }),
            status: "completed",
          })
          .where(eq(chatMessages.id, existingRecord.chatMessageId))
        console.log('Veo 3.1 聊天消息更新成功:', { chatMessageId: existingRecord.chatMessageId })
      } catch (chatError) {
        console.error('更新 Veo 3.1 聊天消息失败:', chatError)
      }
    }

    console.log('Veo 3.1 Webhook 处理完成:', {
      taskId,
      resultUrl,
      originalUrl,
      resolution,
      fallbackFlag,
    })

    // Pusher 推送通知
    try {
      const channelName = `user-${existingRecord.userId}`
      await pusherServer.trigger(channelName, 'kie-result', {
        requestId: taskId,
        type: 'video',
        videoUrl: resultUrl,
        resultUrl: resultUrl,
        originalUrl: originalUrl,
        resolution: resolution,
        fallbackFlag: fallbackFlag,
        status: 'completed',
        isVideo: true,
        chatMessageId: existingRecord.chatMessageId || null,
        timestamp: new Date().toISOString(),
      })
      console.log('Veo 3.1 Pusher 推送成功:', { channel: channelName, taskId })
    } catch (pusherError) {
      console.error('Veo 3.1 Pusher 推送失败:', pusherError)
    }

    // 触发视频搬运任务
    try {
      console.log('Veo 3.1 触发搬运任务:', {
        taskId,
        videoUrls: [resultUrl],
        recordId: existingRecord.id,
        userId: existingRecord.userId
      })
      await saveVideosToR2Task.trigger({
        videoUrls: [resultUrl],
        recordId: existingRecord.id,
        userId: existingRecord.userId,
        chatMessageId: existingRecord.chatMessageId || undefined,
      })
      console.log('Veo 3.1 搬运任务触发成功')
    } catch (error) {
      console.error('Veo 3.1 触发搬运任务失败:', error)
    }

    return NextResponse.json({ status: 'received' }, { status: 200 })

  } catch (error) {
    console.error('Veo 3.1 Webhook 处理错误:', error)
    return NextResponse.json({ status: 'received' }, { status: 200 })
  }
}
