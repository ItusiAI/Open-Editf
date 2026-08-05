import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { prompts } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { isAdmin } from '@/lib/auth-utils'

// GET /api/prompts/[id] - 获取单个 Prompt
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const data = await db
      .select()
      .from(prompts)
      .where(eq(prompts.id, id))
      .limit(1)

    if (data.length === 0) {
      return NextResponse.json(
        { error: 'Prompt not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      data: {
        ...data[0],
        categories: JSON.parse(data[0].categories || '[]'),
      },
    })
  } catch (error) {
    console.error('Error fetching prompt:', error)
    return NextResponse.json(
      { error: 'Failed to fetch prompt' },
      { status: 500 }
    )
  }
}

// PUT /api/prompts/[id] - 更新 Prompt (需要管理员权限)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminAccess = await isAdmin()
    if (!adminAccess) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()

    // 检查 Prompt 是否存在
    const existing = await db
      .select()
      .from(prompts)
      .where(eq(prompts.id, id))
      .limit(1)

    if (existing.length === 0) {
      return NextResponse.json(
        { error: 'Prompt not found' },
        { status: 404 }
      )
    }

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    }

    // 只更新提供的字段
    if (body.type !== undefined) updateData.type = body.type
    if (body.mode !== undefined) updateData.mode = body.mode
    if (body.prompt !== undefined) updateData.prompt = body.prompt
    if (body.categories !== undefined) updateData.categories = JSON.stringify(body.categories)
    if (body.thumbnailUrl !== undefined) updateData.thumbnailUrl = body.thumbnailUrl
    if (body.videoDuration !== undefined) updateData.videoDuration = body.videoDuration
    if (body.videoResolution !== undefined) updateData.videoResolution = body.videoResolution
    if (body.previewModel !== undefined) updateData.previewModel = body.previewModel
    if (body.previewAspectRatio !== undefined) updateData.previewAspectRatio = body.previewAspectRatio
    if (body.previewResolution !== undefined) updateData.previewResolution = body.previewResolution
    if (body.isActive !== undefined) updateData.isActive = body.isActive
    if (body.isFeatured !== undefined) updateData.isFeatured = body.isFeatured
    if (body.sortOrder !== undefined) updateData.sortOrder = body.sortOrder

    await db
      .update(prompts)
      .set(updateData)
      .where(eq(prompts.id, id))

    const updated = await db
      .select()
      .from(prompts)
      .where(eq(prompts.id, id))
      .limit(1)

    return NextResponse.json({
      data: {
        ...updated[0],
        categories: JSON.parse(updated[0].categories || '[]'),
      },
    })
  } catch (error) {
    console.error('Error updating prompt:', error)
    return NextResponse.json(
      { error: 'Failed to update prompt' },
      { status: 500 }
    )
  }
}

// DELETE /api/prompts/[id] - 删除 Prompt (需要管理员权限)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminAccess = await isAdmin()
    if (!adminAccess) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // 检查 Prompt 是否存在
    const existing = await db
      .select()
      .from(prompts)
      .where(eq(prompts.id, id))
      .limit(1)

    if (existing.length === 0) {
      return NextResponse.json(
        { error: 'Prompt not found' },
        { status: 404 }
      )
    }

    await db.delete(prompts).where(eq(prompts.id, id))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting prompt:', error)
    return NextResponse.json(
      { error: 'Failed to delete prompt' },
      { status: 500 }
    )
  }
}
