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

export const saveVideosToR2Task = task({
  id: "save-videos-to-r2",
  maxDuration: 600, // 10分钟超时，适合视频上传任务
  run: async (payload: {
    videoUrls: string[];
    recordId: string;
    userId: string;
    chatMessageId?: string;
  }) => {
    const { videoUrls, recordId, userId, chatMessageId } = payload;

    logger.info("开始视频搬运任务", { recordId, userId, videoCount: videoUrls.length });

    try {
      const savedUrls: string[] = [];

      // 串行处理视频（视频文件较大，并发可能导致问题）
      for (let i = 0; i < videoUrls.length; i++) {
        const videoUrl = videoUrls[i];
        logger.info(`处理视频 ${i + 1}/${videoUrls.length}`, { videoUrl });

        try {
          // 下载视频
          const response = await fetch(videoUrl);
          if (!response.ok) {
            throw new Error(`Failed to download video: ${response.statusText}`);
          }

          const videoBuffer = await response.arrayBuffer();
          const contentType = response.headers.get('content-type') || 'video/mp4';

          // 生成文件名
          const timestamp = Date.now();
          const randomId = Math.random().toString(36).slice(2, 8);
          const filename = `generated-${timestamp}-${randomId}.mp4`;
          const key = `video/${filename}`;

          logger.info(`上传到R2`, { key });

          // 上传到R2
          await S3.send(
            new PutObjectCommand({
              Bucket: process.env.R2_BUCKET,
              Key: key,
              Body: Buffer.from(videoBuffer),
              ContentType: contentType,
            })
          );

          // 构造R2公用URL
          const publicBase = process.env.R2_PUBLIC_URL?.replace(/\/$/, "") || ""
          let finalUrl = ""
          if (publicBase) {
            finalUrl = `${publicBase}/${key}`
          } else if (process.env.R2_ENDPOINT && process.env.R2_BUCKET) {
            finalUrl = `${process.env.R2_ENDPOINT.replace(/\/$/, "")}/${process.env.R2_BUCKET}/${key}`
          } else {
            finalUrl = key
          }

          logger.info(`视频 ${i + 1} 搬运完成`, { finalUrl });
          savedUrls.push(finalUrl);

        } catch (error) {
          logger.error(`视频 ${i + 1} 搬运失败`, { error: error instanceof Error ? error.message : String(error), videoUrl });
          throw error;
        }
      }

      // 更新数据库中的记录，将临时链接替换为R2链接，并设置状态为completed
      logger.info("更新数据库记录", { recordId, savedUrlsCount: savedUrls.length });

      await db
        .update(generationHistory)
        .set({
          outputVideoUrls: JSON.stringify(savedUrls),
          status: 'completed',
        })
        .where(eq(generationHistory.id, recordId));

      logger.info("视频搬运任务完成", {
        recordId,
        originalCount: videoUrls.length,
        savedCount: savedUrls.length
      });

      // 如果有 chatMessageId，更新数据库中的聊天消息的视频链接
      if (chatMessageId) {
        try {
          await db
            .update(chatMessages)
            .set({
              outputVideoUrls: JSON.stringify(savedUrls),
            })
            .where(eq(chatMessages.id, chatMessageId));

          logger.info("已更新聊天消息的视频链接", { chatMessageId });
        } catch (updateError) {
          logger.error("更新 chatMessages 失败", { error: updateError instanceof Error ? updateError.message : String(updateError) });
        }
      }

      return {
        success: true,
        recordId,
        savedUrls,
        originalUrls: videoUrls,
      };

    } catch (error) {
      logger.error("视频搬运任务失败", { error: error instanceof Error ? error.message : String(error), recordId });
      throw error;
    }
  },
});
