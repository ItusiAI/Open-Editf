import { NextRequest, NextResponse } from "next/server"
import { authOptions } from "@/lib/auth"
import { getServerSession } from "next-auth"
import { db } from "@/lib/db"
import { chatSessions } from "@/lib/schema"
import { eq, desc, and } from "drizzle-orm"
import { v4 as uuidv4 } from "uuid"

// 获取当前用户的会话列表
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const sessions = await db
      .select({
        id: chatSessions.id,
        title: chatSessions.title,
        type: chatSessions.type,
        createdAt: chatSessions.createdAt,
        updatedAt: chatSessions.updatedAt,
      })
      .from(chatSessions)
      .where(eq(chatSessions.userId, session.user.id))
      .orderBy(desc(chatSessions.updatedAt))

    return NextResponse.json({ success: true, data: sessions })
  } catch (error) {
    console.error("获取会话列表失败:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// 创建新会话
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const { title, locale, type } = body

    const id = uuidv4()
    const now = new Date()
    const defaultTitles: Record<string, string> = {
      en: "New Chat",
      zh: "新对话",
    }
    const sessionTitle = title || defaultTitles[locale] || "新对话"
    const sessionType = type || "chat"

    await db.insert(chatSessions).values({
      id,
      userId: session.user.id,
      title: sessionTitle,
      type: sessionType,
      createdAt: now,
      updatedAt: now,
    })

    return NextResponse.json({
      success: true,
      data: {
        id,
        title: sessionTitle,
        type: sessionType,
        createdAt: now,
        updatedAt: now,
      },
    })
  } catch (error) {
    console.error("创建会话失败:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
