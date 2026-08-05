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
    const { filename, contentType, data, subDir } = body
    if (!filename || !data) {
      return NextResponse.json({ error: "Missing file data" }, { status: 400 })
    }

    const buffer = Buffer.from(data, "base64")
    // subDir 默认为 images，支持 images/videos/audios 分类
    const subDirPath = subDir || "images"
    const key = `uploads/${subDirPath}/${Date.now()}-${filename}`

    await S3.send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      })
    )

    // Construct candidate public URLs (try multiple patterns and pick the first reachable)
    const publicBase = process.env.R2_PUBLIC_URL?.replace(/\/$/, "") || ""
    const candidates: string[] = []
    if (publicBase) candidates.push(`${publicBase}/${key}`)
    if (process.env.R2_ENDPOINT && process.env.R2_BUCKET) {
      const endpointClean = process.env.R2_ENDPOINT.replace(/\/$/, "")
      candidates.push(`${endpointClean}/${process.env.R2_BUCKET}/${key}`)
      try {
        const epUrl = new URL(process.env.R2_ENDPOINT)
        // try bucket as subdomain (some R2 endpoints expose bucket as subdomain)
        candidates.push(`https://${process.env.R2_BUCKET}.${epUrl.host}/${key}`)
      } catch {}
    }
    // Support optional path prefix (some deployments expose objects under a path, e.g. /editf/)
    if (process.env.R2_PATH_PREFIX && process.env.R2_ENDPOINT) {
      const prefix = String(process.env.R2_PATH_PREFIX).replace(/^\/|\/$/g, "")
      const endpointClean = process.env.R2_ENDPOINT.replace(/\/$/, "")
      candidates.push(`${endpointClean}/${prefix}/${key}`)
    }
    // Common legacy prefix used in some deployments
    if (process.env.R2_ENDPOINT) {
      const endpointClean = process.env.R2_ENDPOINT.replace(/\/$/, "")
      candidates.push(`${endpointClean}/editf/${key}`)
    }

    // pick first candidate that responds to HEAD
    let finalUrl = candidates[0] || ""
    for (const c of candidates) {
      try {
        const res = await fetch(c, { method: "HEAD" })
        if (res.ok) {
          finalUrl = c
          break
        }
      } catch (err) {
        // ignore and try next
      }
    }

    // fallback: if none worked but we have publicBase prefer it, else use endpoint/bucket/key
    if (!finalUrl) {
      if (publicBase) finalUrl = `${publicBase}/${key}`
      else if (process.env.R2_ENDPOINT && process.env.R2_BUCKET) {
        finalUrl = `${process.env.R2_ENDPOINT.replace(/\/$/, "")}/${process.env.R2_BUCKET}/${key}`
      } else {
        finalUrl = key
      }
    }

    return NextResponse.json({ url: finalUrl, key })
  } catch (err) {
    console.error("Upload API error:", err)
    return NextResponse.json({ error: "Upload failed" }, { status: 500 })
  }
}


