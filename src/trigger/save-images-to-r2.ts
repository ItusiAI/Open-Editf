import { task, logger } from "@trigger.dev/sdk/v3";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { db } from "@/lib/db";
import { generationHistory, chatMessages } from "@/lib/schema";
import { eq } from "drizzle-orm";

// 配置R2客户端
const S3 = new S3Client({
  region: process.env.R2_REGION || "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY || "",
    secretAccessKey: process.env.R2_SECRET_KEY || "",
  },
});

export const saveImagesToR2Task = task({
  id: "save-images-to-r2",
  maxDuration: 300, // 5分钟超时，适合图片上传任务
  run: async (payload: {
    imageUrls: string[];
    recordId: string;
    userId: string;
    chatMessageId?: string;
  }) => {
    const { imageUrls, recordId, userId, chatMessageId } = payload;

    logger.info("开始图片搬运任务", { recordId, userId, imageCount: imageUrls.length });

    try {
      const savedUrls: string[] = [];

      // 并发处理所有图片，但限制并发数量
      const batchSize = 3;
      for (let i = 0; i < imageUrls.length; i += batchSize) {
        const batch = imageUrls.slice(i, i + batchSize);
        const batchPromises = batch.map(async (imageUrl, index) => {
          const globalIndex = i + index;
          logger.info(`处理图片 ${globalIndex + 1}/${imageUrls.length}`, { imageUrl });

          try {
            // 下载图片
            const response = await fetch(imageUrl);
            if (!response.ok) {
              throw new Error(`Failed to download image: ${response.statusText}`);
            }

            const imageBuffer = await response.arrayBuffer();
            const contentType = response.headers.get('content-type') || 'image/png';

            // 生成文件名
            const timestamp = Date.now();
            const randomId = Math.random().toString(36).slice(2, 8);
            const filename = `generated-${timestamp}-${randomId}.png`;
            const key = `image/${filename}`;

            logger.info(`上传到R2`, { key });

            // 上传到R2
            await S3.send(
              new PutObjectCommand({
                Bucket: process.env.R2_BUCKET,
                Key: key,
                Body: Buffer.from(imageBuffer),
                ContentType: contentType,
              })
            );

            // 构造R2公用URL
            // 优先使用 R2_PUBLIC_URL (CNAME 公开访问域名)，如果没有则回退到 R2_ENDPOINT
            const publicBase = process.env.R2_PUBLIC_URL?.replace(/\/$/, "") || ""
            let finalUrl = ""
            if (publicBase) {
              finalUrl = `${publicBase}/${key}`
            } else if (process.env.R2_ENDPOINT && process.env.R2_BUCKET) {
              finalUrl = `${process.env.R2_ENDPOINT.replace(/\/$/, "")}/${process.env.R2_BUCKET}/${key}`
            } else {
              finalUrl = key
            }

            logger.info(`图片 ${globalIndex + 1} 搬运完成`, { finalUrl });
            return finalUrl;

          } catch (error) {
            logger.error(`图片 ${globalIndex + 1} 搬运失败`, { error: error instanceof Error ? error.message : String(error), imageUrl });
            throw error;
          }
        });

        const batchResults = await Promise.all(batchPromises);
        savedUrls.push(...batchResults);
      }

      // 更新数据库中的记录，将Fal链接替换为R2链接，并设置状态为completed
      logger.info("更新数据库记录", { recordId, savedUrlsCount: savedUrls.length });

      await db
        .update(generationHistory)
        .set({
          imageUrls: JSON.stringify(savedUrls),
          status: 'completed',
        })
        .where(eq(generationHistory.id, recordId));

      logger.info("图片搬运任务完成", {
        recordId,
        originalCount: imageUrls.length,
        savedCount: savedUrls.length
      });

      // 如果有 chatMessageId，更新数据库中的聊天消息的图片链接
      if (chatMessageId) {
        try {
          await db
            .update(chatMessages)
            .set({
              outputImageUrls: JSON.stringify(savedUrls),
            })
            .where(eq(chatMessages.id, chatMessageId));

          logger.info("已更新聊天消息的图片链接", { chatMessageId });
        } catch (updateError) {
          logger.error("更新 chatMessages 失败", { error: updateError instanceof Error ? updateError.message : String(updateError) });
        }
      }

      return {
        success: true,
        recordId,
        savedUrls,
        originalUrls: imageUrls,
      };

    } catch (error) {
      logger.error("图片搬运任务失败", { error: error instanceof Error ? error.message : String(error), recordId });
      throw error;
    }
  },
});