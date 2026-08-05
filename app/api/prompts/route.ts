import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { prompts } from '@/lib/schema'
import { eq, and, desc, sql } from 'drizzle-orm'
import { isAdmin } from '@/lib/auth-utils'
import { nanoid } from 'nanoid'

// GET /api/prompts - 获取 Prompt 列表
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const type = searchParams.get('type') // 'image' | 'video' | null
    const categories = searchParams.get('categories') // 逗号分隔的分类，如 'portrait,landscape'
    const featured = searchParams.get('featured') // 'true' | null - 只获取精选
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '20')

    // 构建查询条件
    const conditions = [eq(prompts.isActive, true)]

    if (type && type !== 'all') {
      conditions.push(eq(prompts.type, type))
    }

    if (categories && categories !== 'all') {
      // 解析逗号分隔的分类
      const categoryList = categories.split(',').map(c => c.trim())
      // 使用 SQL LIKE 查询（因为是 JSON 数组）
      const categoryConditions = categoryList.map(cat =>
        sql`${prompts.categories} LIKE ${`%${cat}%`}`
      )
      conditions.push(sql.join(categoryConditions, sql` OR `) as any)
    }

    // 如果指定只获取精选
    if (featured === 'true') {
      conditions.push(eq(prompts.isFeatured, true))
    }

    const offset = (page - 1) * pageSize

    // 查询数据 - 精选优先排序，然后按 sortOrder 和 createdAt
    const data = await db
      .select()
      .from(prompts)
      .where(and(...conditions))
      .orderBy(desc(prompts.isFeatured), desc(prompts.sortOrder), desc(prompts.createdAt))
      .limit(pageSize)
      .offset(offset)

    // 获取总数
    const countResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(prompts)
      .where(and(...conditions))

    const total = countResult[0]?.count || 0

    // 解析 categories JSON
    const parsedData = data.map(item => ({
      ...item,
      categories: JSON.parse(item.categories || '[]'),
    }))

    return NextResponse.json({
      data: parsedData,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    })
  } catch (error) {
    console.error('Error fetching prompts:', error)
    return NextResponse.json(
      { error: 'Failed to fetch prompts' },
      { status: 500 }
    )
  }
}

// POST /api/prompts - 创建 Prompt (需要管理员权限)
export async function POST(request: NextRequest) {
  try {
    const adminAccess = await isAdmin()
    if (!adminAccess) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      type = 'image',
      mode = 'generate',
      prompt,
      categories = ['general'],
      thumbnailUrl,
      videoDuration,
      videoResolution,
      previewModel,
      previewAspectRatio,
      previewResolution,
      isActive = true,
      isFeatured = false,
      sortOrder = 0,
    } = body

    if (!prompt) {
      return NextResponse.json(
        { error: 'Prompt content is required' },
        { status: 400 }
      )
    }

    const id = nanoid()
    const now = new Date()

    await db.insert(prompts).values({
      id,
      type,
      mode,
      prompt,
      categories: JSON.stringify(categories),
      thumbnailUrl,
      videoDuration,
      videoResolution,
      previewModel,
      previewAspectRatio,
      previewResolution,
      isActive,
      isFeatured,
      sortOrder,
      createdAt: now,
      updatedAt: now,
    })

    const newPrompt = await db
      .select()
      .from(prompts)
      .where(eq(prompts.id, id))
      .limit(1)

    return NextResponse.json({
      data: {
        ...newPrompt[0],
        categories: JSON.parse(newPrompt[0].categories || '[]'),
      },
    })
  } catch (error) {
    console.error('Error creating prompt:', error)
    return NextResponse.json(
      { error: 'Failed to create prompt' },
      { status: 500 }
    )
  }
}
