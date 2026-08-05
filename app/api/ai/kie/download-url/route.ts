import { NextRequest, NextResponse } from "next/server"
import { authOptions } from "@/lib/auth"
import { getServerSession } from "next-auth"

// Kie.ai API 配置
const KIE_DOWNLOAD_URL_API = "https://api.kie.ai/api/v1/common/download-url"
const KIE_API_KEY = process.env.KIE_API_KEY!

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { url } = body

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 })
    }

    // 调用KIE下载URL API
    const response = await fetch(KIE_DOWNLOAD_URL_API, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${KIE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ url })
    })

    if (!response.ok) {
      const errorData = await response.text()
      console.error('KIE Download URL API error:', response.status, errorData)
      return NextResponse.json({ error: "Failed to get download URL" }, { status: 500 })
    }

    const data = await response.json()

    if (data.code !== 200) {
      console.error('KIE Download URL API returned error:', data)
      return NextResponse.json({ error: data.msg || "Failed to get download URL" }, { status: 500 })
    }

    // 返回可下载的URL
    return NextResponse.json({
      success: true,
      downloadUrl: data.data
    })

  } catch (error) {
    console.error("KIE Download URL API Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
