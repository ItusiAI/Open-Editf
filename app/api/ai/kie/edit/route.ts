import { NextRequest, NextResponse } from "next/server"
import { authOptions } from "@/lib/auth"
import { getServerSession } from "next-auth"
import { usePoints, getUserPointsDetail } from "@/lib/points-manager"
import { db } from "@/lib/db"
import { generationHistory } from "@/lib/schema"
import { saveImagesToR2Task } from "@/src/trigger/save-images-to-r2"
import { v4 as uuidv4 } from "uuid"
import { eq } from "drizzle-orm"

// Kie.ai API 配置
const KIE_API_URL = "https://api.kie.ai/api/v1/jobs/createTask"
const KIE_QUERY_URL = "https://api.kie.ai/api/v1/jobs/recordInfo"
const KIE_API_KEY = process.env.KIE_API_KEY!
// Webhook URL - 如果配置了环境变量则使用
const WEBHOOK_URL = process.env.KIE_WEBHOOK_URL

function appendRecordIdParam(baseUrl: string, recordId: string) {
  const hasQuery = baseUrl.includes("?")
  const separator = hasQuery ? "&" : "?"
  return `${baseUrl}${separator}recordId=${encodeURIComponent(recordId)}`
}

export async function POST(request: NextRequest) {
  try {
    // 内部调用时跳过认证校验（messages route 直接调用）
    const isInternalCall = request.headers.get("x-internal-call") === "true"
    const body = await request.json()
    let sessionUserId: string | undefined

    if (isInternalCall) {
      // 内部调用时从请求体获取 userId
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

    const { prompt, imageUrls, aspectRatio, resolution, webhookUrl, chatMessageId, model, quality } = body

    // 内部调用时必须提供 userId
    if (!sessionUserId) {
      console.error("内部调用缺少 userId")
      return NextResponse.json({ error: "Invalid internal call: missing userId" }, { status: 400 })
    }

    // 验证imageUrls是有效的数组且包含有效的URL
    if (!Array.isArray(imageUrls)) {
      return NextResponse.json(
        { error: "imageUrls must be an array" },
        { status: 400 }
      )
    }

    if (imageUrls.length === 0) {
      return NextResponse.json(
        { error: "At least one image URL is required for editing" },
        { status: 400 }
      )
    }

    // 积分消耗设置
    let pointsCost = 15
    if (model === "gptImage1_5") {
      pointsCost = quality === "high" ? 35 : 6
    } else if (model === "gptImage2") {
      const pointsMap2: { "1K": number; "2K": number; "4K": number } = { "1K": 5, "2K": 8, "4K": 15 }
      pointsCost = pointsMap2[resolution as keyof typeof pointsMap2] || 8
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

    // 预检查积分是否足够
    try {
      const pointsDetail = await getUserPointsDetail(sessionUserId)
      if (pointsDetail.totalPoints < pointsCost) {
        return NextResponse.json({ error: "Insufficient points", requiredPoints: pointsCost }, { status: 402 })
      }
    } catch (error) {
      console.error('积分检查失败:', error)
      return NextResponse.json({ error: "Failed to check points balance" }, { status: 500 })
    }

    // 转换参数格式以适配 Kie.ai API
    let aspectRatioParam = "1:1"
    let resolutionParam = "2K"
    let qualityParam: string | undefined

    const aspectRatioMap: { [key: string]: string } = {
      "1:1": "1:1",
      "2:3": "2:3",
      "3:2": "3:2",
      "3:4": "3:4",
      "4:3": "4:3",
      "4:5": "4:5",
      "5:4": "5:4",
      "9:16": "9:16",
      "16:9": "16:9",
      "21:9": "21:9"
    }
    aspectRatioParam = aspectRatioMap[aspectRatio] || "1:1"

    // 转换分辨率参数
    resolutionParam = resolution || "2K"

    // GPT/Seedream 模型质量参数
    if (model === "gptImage1_5") {
      qualityParam = quality || "medium"
    } else if (model === "gptImage2") {
      qualityParam = quality || "medium"
    } else if (model === "seedream5Lite") {
      qualityParam = quality || "basic"
    } else if (model === "seedream5Pro") {
      qualityParam = quality || "basic"
    }

    // 模型映射
    const modelMap: { [key: string]: string } = {
      "nanoBananaPro": "nano-banana-pro",
      "nanoBanana2": "nano-banana-2",
      "gptImage1_5": "gpt-image/1.5-image-to-image",
      "gptImage2": "gpt-image-2-image-to-image",
      "seedream5Lite": "seedream/5-lite-image-to-image",
      "seedream5Pro": "seedream/5-pro-image-to-image",
      "nanoBanana2Lite": "nano-banana-2-lite"
    }
    const modelParam = modelMap[model] || "nano-banana-pro"

    // 构建 Kie.ai API 请求体
    const kieRequestBody: any = {
      model: modelParam,
      input: model === "gptImage1_5"
        ? {
            prompt: prompt || "Edit image",
            input_urls: imageUrls.slice(0, 8),
            aspect_ratio: aspectRatioParam,
            quality: qualityParam,
            output_format: "png",
          }
        : model === "gptImage2"
        ? {
            prompt: prompt || "Edit image",
            input_urls: imageUrls.slice(0, 16),
            aspect_ratio: aspectRatioParam,
            nsfw_checker: false,
            output_format: "png",
          }
        : model === "seedream5Lite"
        ? {
            prompt: prompt || "Edit image",
            image_urls: imageUrls.slice(0, 10),
            aspect_ratio: aspectRatioParam,
            quality: qualityParam || "basic",
            output_format: "png",
          }
        : model === "seedream5Pro"
        ? {
            prompt: prompt || "Edit image",
            image_urls: imageUrls.slice(0, 10),
            aspect_ratio: aspectRatioParam,
            quality: qualityParam || "basic",
          }
        : model === "nanoBanana2Lite"
        ? {
            prompt: prompt || "Edit image",
            image_urls: imageUrls.slice(0, 10),
            aspect_ratio: aspectRatioParam,
          }
        : {
            prompt: prompt || "Edit image",
            image_input: imageUrls.slice(0, 8), // 限制最多8张图片
            aspect_ratio: aspectRatioParam,
            resolution: resolutionParam,
            output_format: "png",
          },
    }

    const finalWebhookUrl = webhookUrl !== undefined ? webhookUrl : WEBHOOK_URL
    const useWebhookMode = !!finalWebhookUrl

    // 复用已有记录：如果传入了 chatMessageId，尝试查找已有记录避免重复创建
    let recordId: string | undefined = chatMessageId
      ? (await db.query.generationHistory.findFirst({
          where: eq(generationHistory.chatMessageId, chatMessageId),
        }))?.id
      : undefined

    if (useWebhookMode && finalWebhookUrl) {
      // Webhook 模式：同步调用 Kie.ai API（避免延迟问题）
      if (!KIE_API_KEY) {
        return NextResponse.json({ error: "Kie.ai API key not configured" }, { status: 500 })
      }

      if (!recordId) {
        recordId = uuidv4()
        await db.insert(generationHistory).values({
          id: recordId,
          userId: sessionUserId,
          type: "edit",
          prompt: prompt || "Edit image",
          imageUrls: "[]",
          model: `kie-ai/${modelParam}`,
          aspectRatio: aspectRatio,
          resolution: resolution,
          pointsUsed: pointsCost,
          requestId: null,
          seed: null,
          description: null,
          status: "queued",
          createdAt: new Date(),
          chatMessageId: chatMessageId || null,
        })
        console.log("编辑记录创建成功（Webhook模式，待创建任务）:", { recordId })
      } else {
        console.log("复用已有编辑记录:", { recordId, chatMessageId })
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
          console.error("Kie.ai API error (webhook mode - edit):", response.status, errorData)
          return NextResponse.json(
            { error: "AI editing failed", details: errorData },
            { status: 500 }
          )
        }

        const data = await response.json()

        if (data.code !== 200) {
          console.error("Kie.ai API returned error (webhook mode - edit):", data)
          return NextResponse.json(
            { error: data.msg || "AI editing failed" },
            { status: 500 }
          )
        }

        const taskId = data.data?.taskId
        if (!taskId) {
          console.error("No taskId returned from Kie.ai (webhook mode - edit):", data)
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

          console.log("编辑记录已更新 taskId（Webhook模式）:", { taskId, recordId })
        } catch (updateError) {
          console.error("更新编辑记录 taskId 失败（Webhook模式）:", updateError)
        }

        // 立即返回结果
        return NextResponse.json({
          success: true,
          recordId,
          pointsCost,
          mode: "webhook",
          taskId,
          message: "任务已提交，结果将通过 webhook 回调返回",
        })
      } catch (error) {
        console.error("创建 Kie.ai 任务失败（Webhook模式 - edit）:", error)
        return NextResponse.json({ error: "Failed to create task" }, { status: 500 })
      }
    }

    // 非 Webhook：轮询模式（保持原有逻辑）
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
      console.error("Kie.ai API error:", response.status, errorData)
      return NextResponse.json({ error: "AI editing failed" }, { status: 500 })
    }

    const data = await response.json()

    if (data.code !== 200) {
      console.error("Kie.ai API returned error:", data)
      return NextResponse.json({ error: data.msg || "AI editing failed" }, { status: 500 })
    }

    const taskId = data.data?.taskId
    if (!taskId) {
      console.error("No taskId returned from Kie.ai:", data)
      return NextResponse.json({ error: "No task ID returned" }, { status: 500 })
    }

    // 轮询模式：原有逻辑
    const maxRetries = 30 // 30次 * 2秒 = 60秒
    let retryCount = 0
    let taskResult: any = null

    while (retryCount < maxRetries) {
      try {
        const queryResponse = await fetch(`${KIE_QUERY_URL}?taskId=${taskId}`, {
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

            // 检查任务状态 - 根据文档，状态字段是 'state'
            if (taskData.state === 'success' && taskData.resultJson) {
              // 解析 resultJson
              try {
                const resultData = JSON.parse(taskData.resultJson)
                taskResult = resultData
                break
              } catch (parseError) {
                console.error('Error parsing resultJson:', parseError)
                return NextResponse.json({ error: "AI editing failed - invalid result format" }, { status: 500 })
              }
            } else if (taskData.state === 'fail') {
              console.error('Kie.ai task failed:', taskData.failMsg || taskData.failCode)
              return NextResponse.json({ error: taskData.failMsg || "AI editing failed" }, { status: 500 })
            }
            // 如果还在处理中，继续等待 (waiting, queuing, generating)
          }
        }

        // 等待2秒后重试
        await new Promise(resolve => setTimeout(resolve, 2000))
        retryCount++
      } catch (queryError) {
        console.error('Error querying Kie.ai task:', queryError)
        retryCount++
      }
    }

    if (!taskResult) {
      return NextResponse.json({ error: "AI editing timeout" }, { status: 500 })
    }

    // 解析 Kie.ai 返回的结果 - 根据文档，resultUrls在resultJson中
    const resultUrls = taskResult.resultUrls || []
    const images = resultUrls.map((url: string) => ({ url })) || []

    if (!images || images.length === 0) {
      return NextResponse.json({ error: "No images generated" }, { status: 500 })
    }

    // 保存编辑记录到数据库（复用已有记录或新建）
    if (!recordId) recordId = uuidv4()
    try {
      await db.insert(generationHistory).values({
        id: recordId,
        userId: sessionUserId,
        type: 'edit',
        prompt: prompt || "Edit image",
        imageUrls: JSON.stringify(images.map((img: any) => img.url || img)),
        model: `kie-ai/${modelParam}`,
        aspectRatio: aspectRatio,
        resolution: resolution,
        pointsUsed: pointsCost,
        requestId: taskId,
        seed: taskResult.seed,
        description: taskResult.description,
        status: 'pending',
        createdAt: new Date(),
      })
    } catch (dbError) {
      console.error('保存编辑记录失败:', dbError)
    }

    // 扣除积分
    try {
      await usePoints(sessionUserId, pointsCost, "AI编辑图片", "ai_image_edit")
    } catch (pointsError) {
      console.error('积分扣除失败，但图片已成功生成:', pointsError)
    }

    // 异步触发图片搬运任务
    try {
      const finalImageUrls = images.map((img: any) => img.url || img)
      console.log('触发图片搬运任务:', {
        imageUrls: finalImageUrls,
        recordId,
        userId: sessionUserId
      })

      const triggerResult = await saveImagesToR2Task.trigger({
        imageUrls: finalImageUrls,
        recordId: recordId,
        userId: sessionUserId,
      })

      console.log('图片搬运任务触发成功:', triggerResult)
    } catch (error) {
      console.error('触发图片搬运任务失败:', error)
    }

    const responseData: any = {
      success: true,
      images: images,
      requestId: taskId,
      pointsCost,
    }

    if (taskResult.seed) responseData.seed = taskResult.seed
    if (taskResult.description) responseData.description = taskResult.description

    return NextResponse.json(responseData)
  } catch (error) {
    console.error("Kie.ai Edit API Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
