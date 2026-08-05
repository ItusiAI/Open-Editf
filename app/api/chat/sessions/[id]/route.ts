import { NextRequest, NextResponse } from "next/server"
import { authOptions } from "@/lib/auth"
import { getServerSession } from "next-auth"
import { db } from "@/lib/db"
import { chatSessions } from "@/lib/schema"
import { eq, and } from "drizzle-orm"

interface RouteParams {
  params: Promise<{ id: string }>
}

// 获取单个会话
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params

    const [chatSession] = await db
      .select()
      .from(chatSessions)
      .where(and(eq(chatSessions.id, id), eq(chatSessions.userId, session.user.id)))

    if (!chatSession) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: chatSession })
  } catch (error) {
    console.error("获取会话失败:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// 更新会话（如重命名）
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const { title } = body

    const [existing] = await db
      .select()
      .from(chatSessions)
      .where(and(eq(chatSessions.id, id), eq(chatSessions.userId, session.user.id)))

    if (!existing) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 })
    }

    await db
      .update(chatSessions)
      .set({ title: title ?? existing.title, updatedAt: new Date() })
      .where(and(eq(chatSessions.id, id), eq(chatSessions.userId, session.user.id)))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("更新会话失败:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// 删除会话
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params

    await db
      .delete(chatSessions)
      .where(and(eq(chatSessions.id, id), eq(chatSessions.userId, session.user.id)))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("删除会话失败:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
