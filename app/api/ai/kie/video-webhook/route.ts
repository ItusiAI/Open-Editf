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

    // 1. 获取 header 字段
    const timestamp = request.headers.get('X-Webhook-Timestamp')
    const receivedSignature = request.headers.get('X-Webhook-Signature')

    if (!timestamp || !receivedSignature) {
      console.error('Video Webhook 验证失败: 缺少签名头')
      return NextResponse.json({ error: 'Missing signature headers' }, { status: 401 })
    }

    // 2. 获取原始请求体用于验证
    const rawBody = await getRawBody(request)
    let bodyData: any
    
    try {
      bodyData = JSON.parse(rawBody)
    } catch (parseError) {
      console.error('Video Webhook 解析失败:', parseError)
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    console.log('Video Webhook 收到回调:', JSON.stringify(bodyData).substring(0, 300))

    // 3. 解析回调数据
    const { code, msg, data } = bodyData
    
    // 获取 taskId
    const taskId = data?.taskId || data?.task_id || bodyData.taskId
    if (!taskId) {
      console.error('Video Webhook 验证失败: 缺少 taskId')
      return NextResponse.json({ error: 'Missing taskId' }, { status: 400 })
    }

    // 4. 验证签名
    if (WEBHOOK_HMAC_KEY) {
      const isValid = verifySignature(taskId, timestamp, receivedSignature, WEBHOOK_HMAC_KEY)
      
      if (!isValid) {
        console.error('Video Webhook 签名验证失败')
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
      }
      
      console.log('Video Webhook 签名验证通过:', { taskId })
    } else {
      console.log('Video Webhook 未配置 HMAC Key，跳过签名验证')
    }

    // 5. 检查任务状态
    const taskState = data?.state
    console.log('Video 任务状态:', { taskId, state: taskState })

    // 6. 获取原始任务记录
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
      console.log('未找到对应的视频生成记录（测试模式）:', { taskId, recordIdFromQuery })
      return NextResponse.json({
        status: 'received',
        testMode: true,
        taskId,
      }, { status: 200 })
    }

    // 如果任务失败
    if (taskState !== 'success') {
      if (taskState === 'fail') {
        console.error('Video 任务失败:', { taskId, failMsg: data?.failMsg })

        if (existingRecord) {
          try {
            await db.update(generationHistory)
              .set({
                status: 'error',
                description: data?.failMsg || '视频任务执行失败',
              })
              .where(eq(generationHistory.id, existingRecord.id))

            // 更新聊天消息
            if (existingRecord.chatMessageId) {
              await db.update(chatMessages)
                .set({
                  status: 'error',
                  errorMessage: data?.failMsg || '视频任务执行失败',
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
                errorMessage: data?.failMsg || '视频任务执行失败',
                isVideo: true,
                chatMessageId: existingRecord.chatMessageId || null,
                timestamp: new Date().toISOString(),
              })
              console.log('Video Pusher 失败通知推送成功:', { channel: channelName, taskId })
            } catch (pusherError) {
              console.error('Video Pusher 失败通知推送失败:', pusherError)
            }
          } catch (dbError) {
            console.error('更新视频失败状态失败:', dbError)
          }
        }
      }
      return NextResponse.json({ status: 'received', taskId, state: taskState }, { status: 200 })
    }

    // 7. 解析结果
    const resultJson = data?.resultJson
    if (!resultJson) {
      console.error('Video 返回结果为空:', { taskId })
      return NextResponse.json({ error: 'Empty result' }, { status: 400 })
    }

    // 解析 resultJson
    let resultData: any
    try {
      resultData = JSON.parse(resultJson)
    } catch (parseError) {
      console.error('解析 video resultJson 失败:', parseError)
      return NextResponse.json({ error: 'Invalid result format' }, { status: 400 })
    }

    // 提取视频 URL
    const resultUrls = resultData?.resultUrls || []
    const resultUrl = resultUrls[0]

    if (!resultUrl) {
      console.error('无法从 video resultJson 中提取 URL:', resultData)
      return NextResponse.json({ error: 'No URL in result' }, { status: 400 })
    }

    console.log('Video Webhook 回调 URL:', { taskId, resultUrl })

    // 8. 更新数据库记录
    try {
      // 检查是否已处理过（避免重复处理）- 只有 queued 状态才处理
      if (existingRecord.status !== 'completed' && existingRecord.status !== 'pending') {
        await db.update(generationHistory)
          .set({
            outputVideoUrls: JSON.stringify([resultUrl]),
            seed: resultData.seed,
            description: resultData.description,
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
          console.log('Video 积分扣除成功:', { taskId, userId: existingRecord.userId, pointsUsed: existingRecord.pointsUsed })
        } catch (pointsError) {
          console.error('Video 积分扣除失败:', pointsError)
        }
      } else {
        console.log('Video 记录已处理，跳过:', { taskId, existingRecordStatus: existingRecord.status })
      }

      console.log('视频记录更新成功:', { taskId, recordId: existingRecord.id })
    } catch (dbError) {
      console.error('更新视频数据库记录失败:', dbError)
    }

    // 9. 更新聊天消息
    if (existingRecord.chatMessageId) {
      try {
        const existingMeta = JSON.parse(existingRecord.description || "{}")
        await db.update(chatMessages)
          .set({
            outputVideoUrls: JSON.stringify([resultUrl]), // 视频用 outputVideoUrls
            metadata: JSON.stringify({
              ...existingMeta,
              requestId: taskId,
              seed: resultData.seed,
            }),
            status: "completed",
          })
          .where(eq(chatMessages.id, existingRecord.chatMessageId))
        console.log('视频聊天消息更新成功:', { chatMessageId: existingRecord.chatMessageId })
      } catch (chatError) {
        console.error('更新视频聊天消息失败:', chatError)
      }
    }

    console.log('Video Webhook 处理完成:', {
      taskId,
      resultUrl,
    })

    // 10. Pusher 推送通知
    try {
      const channelName = `user-${existingRecord.userId}`
      await pusherServer.trigger(channelName, 'kie-result', {
        requestId: taskId,
        type: 'video',
        imageUrl: resultUrl, // 用于兼容旧代码
        videoUrl: resultUrl, // 用于 operate.tsx (Veo 兼容)
        resultUrl: resultUrl,
        seed: resultData.seed,
        description: resultData.description,
        status: 'completed',
        isVideo: true,
        chatMessageId: existingRecord.chatMessageId || null,
        timestamp: new Date().toISOString(),
      })
      console.log('Video Pusher 推送成功:', { channel: channelName, taskId })
    } catch (pusherError) {
      console.error('Video Pusher 推送失败:', pusherError)
    }

    // 11. 触发视频搬运任务
    try {
      console.log('Video 触发搬运任务:', {
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
      console.log('Video 搬运任务触发成功')
    } catch (error) {
      console.error('Video 触发搬运任务失败:', error)
    }

    return NextResponse.json({ status: 'received' }, { status: 200 })

  } catch (error) {
    console.error('Video Webhook 处理错误:', error)
    return NextResponse.json({ status: 'received' }, { status: 200 })
  }
}
