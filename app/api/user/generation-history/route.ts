import { NextRequest, NextResponse } from "next/server"
import { authOptions } from "@/lib/auth"
import { getServerSession } from "next-auth"
import { db } from "@/lib/db"
import { generationHistory } from "@/lib/schema"
import { eq, desc, sql, like, and } from "drizzle-orm"

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const search = searchParams.get('search') || ''
    const offset = (page - 1) * limit

    // 构建查询条件
    const whereCondition = search
      ? and(eq(generationHistory.userId, session.user.id), like(generationHistory.prompt, `%${search}%`))
      : eq(generationHistory.userId, session.user.id)

    // 获取生成记录总数（使用 count(*) 确保返回数字）
    const totalCountResult = await db
      .select({ count: sql`count(*)` })
      .from(generationHistory)
      .where(whereCondition)
    const totalCount = Number(totalCountResult[0]?.count || 0)

    // 获取所有记录来计算总统计（不受搜索条件限制，只按用户ID过滤）
    const allRecords = await db
      .select()
      .from(generationHistory)
      .where(eq(generationHistory.userId, session.user.id))

    // 计算总图片数量
    const totalImages = allRecords.reduce((sum, record) => {
      const urls = JSON.parse(record.imageUrls || '[]')
      return sum + urls.length
    }, 0)

    // 分别统计编辑和生成的记录数量
    const generateRecords = allRecords.filter(record => record.type === 'generate')
    const editRecords = allRecords.filter(record => record.type === 'edit')
    const videoEditRecords = allRecords.filter(record => record.type === 'video')

    const totalGenerateProjects = generateRecords.length
    const totalEditProjects = editRecords.length
    const totalVideoProjects = videoEditRecords.length

    const totalGenerateImages = generateRecords.reduce((sum, record) => {
      const urls = JSON.parse(record.imageUrls || '[]')
      return sum + urls.length
    }, 0)

    const totalEditImages = editRecords.reduce((sum, record) => {
      const urls = JSON.parse(record.imageUrls || '[]')
      return sum + urls.length
    }, 0)

    const totalVideoImages = videoEditRecords.reduce((sum, record) => {
      const urls = JSON.parse(record.outputVideoUrls || '[]')
      return sum + urls.length
    }, 0)

    // 获取生成记录
    const records = await db
      .select()
      .from(generationHistory)
      .where(whereCondition)
      .orderBy(desc(generationHistory.createdAt))
      .limit(limit)
      .offset(offset)

    // 解析图片和视频URL并格式化数据
    const formattedRecords = records.map(record => ({
      ...record,
      imageUrls: JSON.parse(record.imageUrls || '[]'),
      outputVideoUrls: JSON.parse(record.outputVideoUrls || '[]'),
      createdAt: record.createdAt,
    }))

    const totalPages = Math.ceil(totalCount / limit)

    return NextResponse.json({
      success: true,
      records: formattedRecords,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems: totalCount,
        itemsPerPage: limit,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
      stats: {
        totalImages: totalImages,
        totalGenerateProjects: totalGenerateProjects,
        totalEditProjects: totalEditProjects,
        totalVideoProjects: totalVideoProjects,
        totalGenerateImages: totalGenerateImages,
        totalEditImages: totalEditImages,
        totalVideoImages: totalVideoImages
      }
    })
  } catch (error) {
    console.error('获取生成记录失败:', error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
