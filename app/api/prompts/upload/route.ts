import { NextRequest, NextResponse } from "next/server"
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3"

const S3 = new S3Client({
  region: process.env.R2_REGION || "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY || "",
    secretAccessKey: process.env.R2_SECRET_KEY || "",
  },
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { filename, contentType, data, type } = body
    if (!filename || !data) {
      return NextResponse.json({ error: "Missing file data" }, { status: 400 })
    }

    const base64Data = data.replace(/^data:[^;]+;base64,/, "")
    const buffer = Buffer.from(base64Data, "base64")
    const subDir = type === "video" ? "videos" : "images"
    const key = `uploads/prompts/${subDir}/${Date.now()}-${filename}`

    await S3.send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      })
    )

    const publicBase = process.env.R2_PUBLIC_URL?.replace(/\/$/, "") || ""
    const finalUrl = publicBase
      ? `${publicBase}/${key}`
      : `${process.env.R2_ENDPOINT?.replace(/\/$/, "")}/${process.env.R2_BUCKET}/${key}`

    return NextResponse.json({ url: finalUrl, key })
  } catch (err) {
    console.error("Prompt upload error:", err)
    return NextResponse.json({ error: "Upload failed" }, { status: 500 })
  }
}
