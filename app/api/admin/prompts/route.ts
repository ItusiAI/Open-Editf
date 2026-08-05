import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { prompts } from '@/lib/schema'
import { desc, sql } from 'drizzle-orm'
import { isAdmin } from '@/lib/auth-utils'

// GET /api/admin/prompts - 获取所有 Prompt 列表 (包括禁用的, 需要管理员权限)
export async function GET(request: NextRequest) {
  try {
    const adminAccess = await isAdmin()
    if (!adminAccess) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const type = searchParams.get('type')
    const categories = searchParams.get('categories')
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '20')

    let query = db.select().from(prompts)

    const conditions = []

    if (type && type !== 'all') {
      conditions.push(sql`${prompts.type} = ${type}`)
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

    const offset = (page - 1) * pageSize

    // 构建最终查询
    const data = conditions.length > 0
      ? await db.select().from(prompts).where(sql.join(conditions, sql` AND `)).orderBy(desc(prompts.isFeatured), desc(prompts.sortOrder), desc(prompts.createdAt)).limit(pageSize).offset(offset)
      : await db.select().from(prompts).orderBy(desc(prompts.isFeatured), desc(prompts.sortOrder), desc(prompts.createdAt)).limit(pageSize).offset(offset)

    // 获取总数
    const countResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(prompts)

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
    console.error('Error fetching admin prompts:', error)
    return NextResponse.json(
      { error: 'Failed to fetch prompts' },
      { status: 500 }
    )
  }
}
