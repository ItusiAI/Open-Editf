import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { db } from "@/lib/db"
import { generationHistory, chatMessages } from "@/lib/schema"
import { saveImagesToR2Task } from "@/src/trigger/save-images-to-r2"
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
      console.error('Kie.ai Webhook 验证失败: 缺少签名头')
      return NextResponse.json({ error: 'Missing signature headers' }, { status: 401 })
    }

    // 2. 获取原始请求体用于验证
    const rawBody = await getRawBody(request)
    let bodyData: any
    
    try {
      bodyData = JSON.parse(rawBody)
    } catch (parseError) {
      console.error('Kie.ai Webhook 解析失败:', parseError)
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    console.log('Kie.ai 收到回调:', JSON.stringify(bodyData).substring(0, 300))

    // 3. 根据官方文档解析回调数据
    const { code, msg, data } = bodyData
    
    // 获取 taskId（支持多种字段名）
    const taskId = data?.taskId || data?.task_id || bodyData.taskId
    if (!taskId) {
      console.error('Kie.ai Webhook 验证失败: 缺少 taskId')
      return NextResponse.json({ error: 'Missing taskId' }, { status: 400 })
    }

    // 4. 验证签名
    if (WEBHOOK_HMAC_KEY) {
      const isValid = verifySignature(taskId, timestamp, receivedSignature, WEBHOOK_HMAC_KEY)
      
      if (!isValid) {
        console.error('Kie.ai Webhook 签名验证失败')
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
      }
      
      console.log('Kie.ai Webhook 签名验证通过:', { taskId })
    } else {
      console.log('Kie.ai Webhook 未配置 HMAC Key，跳过签名验证')
    }

    // 5. 检查任务状态
    const taskState = data?.state
    console.log('Kie.ai 任务状态:', { taskId, state: taskState })

    // 6. 获取原始任务记录（优先使用 recordId，其次 fallback 到 requestId=taskId）
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
      console.log('未找到对应的生成记录（测试模式或任务尚未写入记录）:', { taskId, recordIdFromQuery })
      return NextResponse.json({
        status: 'received',
        testMode: true,
        taskId,
      }, { status: 200 })
    }

    // 如果任务失败
    if (taskState !== 'success') {
      if (taskState === 'fail') {
        console.error('Kie.ai 任务失败:', { taskId, failMsg: data?.failMsg })

        // 更新数据库记录状态为失败
        if (existingRecord) {
          try {
            await db.update(generationHistory)
              .set({
                status: 'error',
                description: data?.failMsg || '任务执行失败',
              })
              .where(eq(generationHistory.id, existingRecord.id))

            // 更新聊天消息（如果有关联）
            if (existingRecord.chatMessageId) {
              await db.update(chatMessages)
                .set({
                  status: 'error',
                  errorMessage: data?.failMsg || '任务执行失败',
                })
                .where(eq(chatMessages.id, existingRecord.chatMessageId))
            }

            // 通过 Pusher 推送失败通知
            try {
              const channelName = `user-${existingRecord.userId}`
              await pusherServer.trigger(channelName, 'kie-result', {
                requestId: taskId,
                type: existingRecord.type,
                status: 'error',
                errorMessage: data?.failMsg || '任务执行失败',
                chatMessageId: existingRecord.chatMessageId || null,
                timestamp: new Date().toISOString(),
              })
              console.log('Pusher 失败通知推送成功:', { channel: channelName, taskId })
            } catch (pusherError) {
              console.error('Pusher 失败通知推送失败:', pusherError)
            }
          } catch (dbError) {
            console.error('更新失败状态失败:', dbError)
          }
        }
      }
      // 返回 200 避免重复回调
      return NextResponse.json({ status: 'received', taskId, state: taskState }, { status: 200 })
    }

    // 7. 解析结果 - 根据官方文档，resultJson 在 data.resultJson 中
    const resultJson = data?.resultJson
    if (!resultJson) {
      console.error('Kie.ai 返回结果为空:', { taskId })
      return NextResponse.json({ error: 'Empty result' }, { status: 400 })
    }

    // 解析 resultJson
    let resultData: any
    try {
      resultData = JSON.parse(resultJson)
    } catch (parseError) {
      console.error('解析 resultJson 失败:', parseError)
      return NextResponse.json({ error: 'Invalid result format' }, { status: 400 })
    }

    // 提取图片 URL
    const resultUrls = resultData?.resultUrls || []
    const imageUrl = resultUrls[0]

    if (!imageUrl) {
      console.error('无法从 resultJson 中提取图片 URL:', resultData)
      return NextResponse.json({ error: 'No image URL in result' }, { status: 400 })
    }

    console.log('Kie.ai 回调图片 URL:', { taskId, imageUrl })

    // 8. 更新数据库中的记录为 pending 状态（等待搬运完成）
    let pointsDeducted = false
    try {
      // 扣除积分（首次回调时执行，pending/completed 时跳过）
      if (existingRecord.status !== 'completed' && existingRecord.status !== 'pending') {
        pointsDeducted = true
        await db.update(generationHistory)
          .set({
            imageUrls: JSON.stringify([imageUrl]),
            seed: resultData.seed,
            description: resultData.description,
            status: 'pending'
          })
          .where(eq(generationHistory.id, existingRecord.id))

        // 扣除积分
        try {
          await usePoints(
            existingRecord.userId,
            existingRecord.pointsUsed || 40,
            existingRecord.type === 'edit' ? "AI编辑图片" : "AI图片生成",
            existingRecord.type === 'edit' ? "ai_image_edit" : "ai_image_generate"
          )
          console.log('积分扣除成功:', { taskId, userId: existingRecord.userId, pointsUsed: existingRecord.pointsUsed })
        } catch (pointsError) {
          console.error('积分扣除失败:', pointsError)
        }
      } else {
        console.log('积分已扣除，跳过:', { taskId, existingRecordStatus: existingRecord.status })
      }

      console.log('数据库记录更新成功:', { taskId, recordId: existingRecord.id })
    } catch (dbError) {
      console.error('更新数据库记录失败:', dbError)
    }

    // 8.1 如果有关联的聊天消息，一并更新
    if (existingRecord.chatMessageId) {
      try {
        const existingMeta = JSON.parse(existingRecord.description || "{}")
        await db.update(chatMessages)
          .set({
            outputImageUrls: JSON.stringify([imageUrl]),
            content: resultData.description || "",
            metadata: JSON.stringify({
              ...existingMeta,
              requestId: taskId,
              seed: resultData.seed,
            }),
            status: "completed",
          })
          .where(eq(chatMessages.id, existingRecord.chatMessageId))
        console.log('聊天消息更新成功:', { chatMessageId: existingRecord.chatMessageId })
      } catch (chatError) {
        console.error('更新聊天消息失败:', chatError)
      }
    }

    // 9. 立即返回成功响应（告诉 Kie.ai 已经收到）
    console.log('Kie.ai Webhook 处理完成:', {
      taskId,
      imageUrl,
      type: existingRecord.type
    })

    // 10. 异步 Pusher 推送：通知前端图片已生成（让用户立即看到结果）
    try {
      const channelName = `user-${existingRecord.userId}`
      await pusherServer.trigger(channelName, 'kie-result', {
        requestId: taskId,
        type: existingRecord.type,
        resultUrl: imageUrl,
        seed: resultData.seed,
        description: resultData.description,
        status: 'completed',
        chatMessageId: existingRecord.chatMessageId || null,
        timestamp: new Date().toISOString(),
      })
      console.log('Pusher 推送成功:', { channel: channelName, taskId })
    } catch (pusherError) {
      console.error('Pusher 推送失败:', pusherError)
    }

    // 11. 异步触发图片搬运任务（在返回响应后执行）
    try {
      console.log('触发图片搬运任务:', {
        taskId,
        imageUrls: [imageUrl],
        recordId: existingRecord.id,
        userId: existingRecord.userId
      })

      await saveImagesToR2Task.trigger({
        imageUrls: [imageUrl],
        recordId: existingRecord.id,
        userId: existingRecord.userId,
        chatMessageId: existingRecord.chatMessageId || undefined,
      })

      console.log('图片搬运任务触发成功')
    } catch (error) {
      console.error('触发图片搬运任务失败:', error)
    }

    return NextResponse.json({ status: 'received' }, { status: 200 })

  } catch (error) {
    console.error('Kie.ai Webhook 处理错误:', error)
    return NextResponse.json({ status: 'received' }, { status: 200 })
  }
}
