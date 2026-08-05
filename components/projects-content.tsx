"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useTranslations, useLocale } from "next-intl"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Loader2, Eye, Download, Image as ImageIcon, Sparkles, Search, X, Copy, Check, CheckCircle, XCircle, Video } from "lucide-react"
import { format } from "date-fns"
import { zhCN, enUS } from "date-fns/locale"
import { SignInDialog } from "@/components/auth/signin-dialog"
import { useToast } from "@/hooks/use-toast"

interface GenerationRecord {
  id: string
  type: string
  prompt: string
  imageUrls: string[]
  outputVideoUrls: string[]
  model: string
  aspectRatio?: string
  resolution?: string
  pointsUsed: number
  status: 'pending' | 'completed' | 'error'
  createdAt: string
}

interface PaginationInfo {
  currentPage: number
  totalPages: number
  totalItems: number
  itemsPerPage: number
  hasNextPage: boolean
  hasPreviousPage: boolean
}

interface ProjectsContentProps {
  onSwitchToEditor?: () => void
}

export function ProjectsContent({ onSwitchToEditor }: ProjectsContentProps) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const locale = useLocale()
  const t = useTranslations("home")
  const { toast } = useToast()

  const headerRef = useRef<HTMLDivElement | null>(null)
  const [skeletonCount, setSkeletonCount] = useState(6)
  const [showSignInDialog, setShowSignInDialog] = useState(false)
  useEffect(() => {
    const calc = () => {
      if (typeof window === "undefined") return
      const headerH = headerRef.current?.getBoundingClientRect().height || 120
      const reserved = 240 // leave space for top/bottom and other UI
      const itemHeight = 140 // approx height per skeleton item
      const available = Math.max(0, window.innerHeight - headerH - reserved)
      const count = Math.max(5, Math.min(12, Math.ceil(available / itemHeight)))
      setSkeletonCount(count)
    }
    calc()
    window.addEventListener("resize", calc)
    return () => window.removeEventListener("resize", calc)
  }, [])

  // 检查登录状态，如果未登录显示登录弹窗
  useEffect(() => {
    if (status === 'loading') return
    if (!session?.user) {
      setShowSignInDialog(true)
    }
  }, [status, session])

  const [records, setRecords] = useState<GenerationRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [pagination, setPagination] = useState<PaginationInfo | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [previewIndex, setPreviewIndex] = useState<number | null>(null)
  const [previewVideoUrl, setPreviewVideoUrl] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [copiedPrompts, setCopiedPrompts] = useState<Set<string>>(new Set())
  const [downloadingImages, setDownloadingImages] = useState<Set<string>>(new Set()) // 正在下载的图片URL集合
  const prevSearchQueryRef = useRef("")
  const [stats, setStats] = useState<{
    totalImages: number
    totalGenerateProjects: number
    totalEditProjects: number
    totalVideoProjects: number
    totalGenerateImages: number
    totalEditImages: number
    totalVideoImages: number
  } | null>(null)

  useEffect(() => {
    if (status === "authenticated" && session?.user) {
      fetchRecords(currentPage)
    }
  }, [status, session, currentPage])

  const fetchRecords = useCallback(async (page: number = 1) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '5'
      })
      if (searchQuery.trim()) {
        params.append('search', searchQuery.trim())
      }
      const response = await fetch(`/api/user/generation-history?${params.toString()}`)
      if (response.ok) {
        const data = await response.json()
        setRecords(data.records || [])
        setPagination(data.pagination)
        setStats(data.stats)
      }
    } catch (error) {
      console.error('获取生成记录失败:', error)
    } finally {
      setLoading(false)
    }
  }, [searchQuery])

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage)
  }

  const handleSearch = () => {
    setCurrentPage(1) // Reset to first page when searching
    fetchRecords(1)
  }

  const handleClearSearch = () => {
    setSearchQuery("")
    setCurrentPage(1)
    prevSearchQueryRef.current = ""
    fetchRecords(1)
  }

  const handleSearchInputChange = (value: string) => {
    setSearchQuery(value)
  }

  // 当搜索查询改变时自动处理搜索逻辑
  useEffect(() => {
    const trimmedQuery = searchQuery.trim()
    const prevTrimmedQuery = prevSearchQueryRef.current.trim()

    // 如果从有搜索词变成无搜索词，自动清除搜索
    if (prevTrimmedQuery !== "" && trimmedQuery === "") {
      setCurrentPage(1)
      fetchRecords(1)
    }

    // 更新上一次的搜索查询
    prevSearchQueryRef.current = searchQuery
  }, [searchQuery, fetchRecords])

  const openPreview = (imageUrl: string, index: number) => {
    setPreviewImage(imageUrl)
    setPreviewIndex(index)
    if (typeof window !== "undefined") {
      document.body.classList.add("preview-open")
    }
  }

  const closePreview = () => {
    setPreviewImage(null)
    setPreviewIndex(null)
    setPreviewVideoUrl(null)
    if (typeof window !== "undefined") {
      document.body.classList.remove("preview-open")
    }
  }

  const openVideoPreview = (videoUrl: string, index: number) => {
    setPreviewVideoUrl(videoUrl)
    setPreviewIndex(index)
    if (typeof window !== "undefined") {
      document.body.classList.add("preview-open")
    }
  }

  // 获取视频模型显示名称
  const getVideoModelName = (model: string | undefined) => {
    if (!model) return 'Video Generation'
    if (model.includes('seedance2mini')) return 'Seedance 2.0 Mini'
    if (model.includes('seedance2fast')) return 'Seedance 2.0 Fast'
    if (model.includes('seedance2')) return 'Seedance 2.0'
    // Veo 3.1 系列需要精确匹配，避免被更宽泛的匹配覆盖
    if (model.includes('veo3_lite') || model.includes('veo3lite')) return 'Veo 3.1 Lite'
    if (model.includes('veo3_fast') || model.includes('veo3fast')) return 'Veo 3.1 Fast'
    if (model.includes('veo3_quality') || model.includes('veo3quality') || model.includes('veo3')) return 'Veo 3.1 Quality'
    if (model.includes('veo')) return 'Veo'
    // Kling 3.0
    if (model.includes('kling30') || model.includes('kling-3.0')) return 'Kling 3.0'
    // Kling V3 Turbo
    if (model.includes('kling/v3-turbo') || model.includes('klingV3Turbo') || model.includes('kling-v3-turbo')) return 'Kling V3 Turbo'
    // Wan 2.7
    if (model.includes('wan27') || model.includes('wan2.7')) return 'Wan 2.7'
    // HappyHorse 1.1
    if (model.includes('happyhorse-1-1') || model.includes('happyhorse11')) return 'HappyHorse 1.1'
    // HappyHorse 1.0
    if (model.includes('happyhorse')) return 'HappyHorse 1.0'
    // MiniMax H3
    if (model.includes('minimax-h3')) return 'MiniMax H3'
    return model.replace('kie-ai/', '') || 'Video Generation'
  }

  const downloadImage = async (imageUrl: string, filename: string) => {
    const imageKey = imageUrl
    setDownloadingImages(prev => new Set(prev).add(imageKey))

    try {
      let downloadUrl = imageUrl

      // 检查是否为KIE生成的图片，需要获取下载URL
      if (imageUrl.includes('kie.ai') || imageUrl.includes('tempfile')) {
        const downloadUrlResponse = await fetch('/api/ai/kie/download-url', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ url: imageUrl }),
        })

        if (downloadUrlResponse.ok) {
          const downloadUrlData = await downloadUrlResponse.json()
          downloadUrl = downloadUrlData.downloadUrl
        }
        // 如果获取失败，使用原始URL
      }

      // 获取图片的blob数据
      const response = await fetch(downloadUrl)
      const blob = await response.blob()

      // 创建blob URL
      const blobUrl = URL.createObjectURL(blob)

      // 创建下载链接
      const link = document.createElement('a')
      link.href = blobUrl
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      // 清理blob URL
      URL.revokeObjectURL(blobUrl)

      // 显示成功提示
      toast({
        title: t("operate.downloadSuccess") || "Download Successful",
        description: t("operate.downloadSuccessDesc") || "Image saved to local storage",
      })
    } catch (error) {
      console.error('下载图片失败:', error)
      toast({
        title: t("operate.downloadError") || "Download Failed",
        description: t("operate.downloadErrorDesc") || "Please try again later",
        variant: "destructive",
      })

      // 如果blob方式失败，回退到直接链接方式
      const link = document.createElement('a')
      link.href = imageUrl
      link.download = filename
      link.target = '_blank'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } finally {
      setDownloadingImages(prev => {
        const newSet = new Set(prev)
        newSet.delete(imageKey)
        return newSet
      })
    }
  }

  // 下载视频
  const downloadVideo = async (videoUrl: string, filename: string) => {
    try {
      // 直接下载视频
      const link = document.createElement('a')
      link.href = videoUrl
      link.download = filename
      link.target = '_blank'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      toast({
        title: t("operate.downloadSuccess") || "Download Started",
        description: t("operate.downloadSuccessDesc") || "Video download has started",
      })
    } catch (error) {
      console.error('下载视频失败:', error)
      toast({
        title: t("operate.downloadError") || "Download Failed",
        description: t("operate.downloadErrorDesc") || "Please try again later",
        variant: "destructive",
      })
    }
  }

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString)
    if (locale === 'zh') {
      return format(date, 'yyyy年MM月dd日 HH:mm', { locale: zhCN })
    }
    return format(date, 'MMM dd, yyyy HH:mm', { locale: enUS })
  }

  const copyPromptToClipboard = async (prompt: string, recordId: string) => {
    try {
      await navigator.clipboard.writeText(prompt)
      setCopiedPrompts(prev => new Set([...prev, recordId]))
      // 2秒后重置复制状态
      setTimeout(() => {
        setCopiedPrompts(prev => {
          const newSet = new Set(prev)
          newSet.delete(recordId)
          return newSet
        })
      }, 2000)
    } catch (error) {
      console.error('复制失败:', error)
      // 降级方案：使用传统方法
      const textArea = document.createElement('textarea')
      textArea.value = prompt
      document.body.appendChild(textArea)
      textArea.select()
      try {
        document.execCommand('copy')
        setCopiedPrompts(prev => new Set([...prev, recordId]))
        setTimeout(() => {
          setCopiedPrompts(prev => {
            const newSet = new Set(prev)
            newSet.delete(recordId)
            return newSet
          })
        }, 2000)
      } catch (fallbackError) {
        console.error('降级复制也失败:', fallbackError)
      }
      document.body.removeChild(textArea)
    }
  }

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  // 未登录用户直接显示登录弹窗
  if (!session?.user) {
    return (
      <SignInDialog
        open={showSignInDialog}
        onOpenChange={(open) => {
          setShowSignInDialog(open)
          // 如果用户关闭登录弹窗，跳转到首页
          if (!open) {
            router.push(`/${locale}`)
          }
        }}
      />
    )
  }

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-4">
      {/* Header */}
          <div className="mb-4 sm:mb-6" ref={headerRef}>
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <div className="p-1.5 sm:p-2 bg-primary/10 rounded-lg shrink-0">
              <ImageIcon className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-semibold text-foreground truncate">{t("projects.title")}</h1>
              <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">{t("projects.subtitle")}</p>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative w-full">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <input
                type="text"
                placeholder={t("projects.searchPlaceholder") || "搜索项目..."}
                value={searchQuery}
                onChange={(e) => handleSearchInputChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSearch()
                  }
                }}
                className="w-full pl-10 pr-10 py-2 text-sm border border-input rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={handleClearSearch}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            {searchQuery && (
              <Button
                onClick={handleSearch}
                size="sm"
                className="mt-2 w-full sm:hidden"
              >
                <Search className="w-4 h-4 mr-2" />
                {t("projects.search") || "搜索"}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        // Skeleton loading state for better visual feedback
        <div className="space-y-6 w-full">
          {/* Stats skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Array.from({ length: Math.min(3, skeletonCount) }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <div className="animate-pulse">
                    <div className="h-6 bg-muted rounded w-24 mb-3" />
                    <div className="h-8 bg-muted rounded w-full" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Records skeleton list */}
          <div className="space-y-4">
            {Array.from({ length: Math.max(3, skeletonCount) }).map((_, i) => (
              <Card key={i} className="overflow-hidden">
                <CardContent className="p-3 sm:p-6">
                  <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                    <div className="flex-shrink-0">
                      <div className="w-full h-40 sm:w-24 sm:h-24 md:w-32 md:h-32 bg-muted rounded-lg" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="mb-3">
                        <div className="h-5 bg-muted rounded w-3/4 mb-2" />
                        <div className="h-3 bg-muted rounded w-1/3" />
                      </div>
                      <div className="flex gap-3 flex-wrap">
                        <div className="h-6 w-16 bg-muted rounded" />
                        <div className="h-6 w-16 bg-muted rounded" />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ) : records.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <ImageIcon className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">{t("projects.noRecords")}</h3>
            <p className="text-muted-foreground mb-6">{t("projects.noRecordsDesc")}</p>
            <Button onClick={() => {
              if (onSwitchToEditor) {
                onSwitchToEditor()
              } else {
                router.push(`/${locale}/editor`)
              }
            }}>
              <Sparkles className="w-4 h-4 mr-2" />
              {t("projects.startGenerating")}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <Card>
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg shrink-0">
                    <Sparkles className="w-5 h-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm text-muted-foreground truncate">{t("projects.totalGenerateProjects") || "生成项目"}</p>
                    <p className="text-xl sm:text-2xl font-bold">
                      {stats?.totalGenerateProjects || 0}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="sm:col-span-2 lg:col-span-1">
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg shrink-0">
                    <div className="w-5 h-5 bg-orange-600 dark:bg-orange-400 rounded-full flex items-center justify-center text-white text-xs font-bold">
                      E
                    </div>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm text-muted-foreground truncate">{t("projects.totalEditProjects") || "编辑项目"}</p>
                    <p className="text-xl sm:text-2xl font-bold">
                      {stats?.totalEditProjects || 0}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="sm:col-span-2 lg:col-span-1">
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-violet-100 dark:bg-violet-900/30 rounded-lg shrink-0">
                    <div className="w-5 h-5 bg-violet-600 dark:bg-violet-400 rounded-full flex items-center justify-center text-white text-xs font-bold">
                      V
                    </div>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm text-muted-foreground truncate">{t("projects.totalVideoProjects")}</p>
                    <p className="text-xl sm:text-2xl font-bold">
                      {stats?.totalVideoProjects || 0}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Records List */}
          <div className="space-y-4">
            {records.map((record) => (
              <Card key={record.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                <CardContent className="p-3 sm:p-6">
                  <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                    {/* Image */}
                    <div className="flex-shrink-0">
                      <div className="w-full h-40 sm:w-24 sm:h-24 md:w-32 md:h-32 relative overflow-hidden bg-muted rounded-lg">
                        {record.type === 'video' ? (
                          // 视频记录显示视频播放器（使用 outputVideoUrls）
                          (() => {
                            const videoUrl = record.outputVideoUrls?.[0]
                            if (!videoUrl) {
                              return (
                                <div className="w-full h-full flex flex-col items-center justify-center bg-destructive/10">
                                  <XCircle className="w-6 h-6 sm:w-8 sm:h-8 text-destructive mb-1" />
                                  <span className="text-xs text-destructive">{t('projects.status.failed')}</span>
                                </div>
                              )
                            }
                            return (
                              <div className="relative w-full h-full">
                                <video
                                  src={videoUrl}
                                  className="w-full h-full object-cover hover:scale-105 transition-transform cursor-pointer"
                                  onClick={() => openVideoPreview(videoUrl, 0)}
                                  muted
                                  playsInline
                                  preload="metadata"
                                />
                                <div className="absolute top-1 right-1">
                                  <Badge variant="default" className="text-[10px] sm:text-xs px-1 py-0 bg-violet-500 hover:bg-violet-600">
                                    {t('projects.type.videoEdit')}
                                  </Badge>
                                </div>
                                <div className="absolute bottom-1 right-1">
                                  {record.status === 'completed' && (
                                    <Badge variant="default" className="bg-green-500 hover:bg-green-600 text-[10px] sm:text-xs px-1 py-0">
                                      <CheckCircle className="w-2 h-2 sm:w-3 sm:h-3 mr-0.5 sm:mr-1" />
                                      <span className="hidden xs:inline">{t('projects.status.success')}</span>
                                    </Badge>
                                  )}
                                  {record.status === 'error' && (
                                    <Badge variant="destructive" className="text-[10px] sm:text-xs px-1 py-0">
                                      <XCircle className="w-2 h-2 sm:w-3 sm:h-3 mr-0.5 sm:mr-1" />
                                      <span className="hidden xs:inline">{t('projects.status.failed')}</span>
                                    </Badge>
                                  )}
                                  {record.status === 'pending' && (
                                    <Badge variant="secondary" className="text-[10px] sm:text-xs px-1 py-0">
                                      <Loader2 className="w-2 h-2 sm:w-3 sm:h-3 mr-0.5 sm:mr-1 animate-spin" />
                                      <span className="hidden xs:inline">{t('projects.status.pending')}</span>
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            )
                          })()
                        ) : (
                          <>
                            <img
                              src={record.imageUrls[0]}
                              alt={record.prompt}
                              className="w-full h-full object-cover hover:scale-105 transition-transform cursor-pointer"
                              onClick={() => openPreview(record.imageUrls[0], 0)}
                            />
                            <div className="absolute top-1 right-1">
                              <Badge variant={record.type === 'generate' ? 'default' : 'secondary'} className="text-[10px] sm:text-xs px-1 py-0">
                                {record.type === 'generate' ? t('projects.type.generate') : t('projects.type.edit')}
                              </Badge>
                            </div>
                            <div className="absolute bottom-1 right-1">
                              {record.status === 'completed' && (
                                <Badge variant="default" className="bg-green-500 hover:bg-green-600 text-[10px] sm:text-xs px-1 py-0">
                                  <CheckCircle className="w-2 h-2 sm:w-3 sm:h-3 mr-0.5 sm:mr-1" />
                                  <span className="hidden xs:inline">{t('projects.status.success')}</span>
                                </Badge>
                              )}
                              {record.status === 'error' && (
                                <Badge variant="destructive" className="text-[10px] sm:text-xs px-1 py-0">
                                  <XCircle className="w-2 h-2 sm:w-3 sm:h-3 mr-0.5 sm:mr-1" />
                                  <span className="hidden xs:inline">{t('projects.status.failed')}</span>
                                </Badge>
                              )}
                              {record.status === 'pending' && (
                                <Badge variant="secondary" className="text-[10px] sm:text-xs px-1 py-0">
                                  <Loader2 className="w-2 h-2 sm:w-3 sm:h-3 mr-0.5 sm:mr-1 animate-spin" />
                                  <span className="hidden xs:inline">{t('projects.status.pending')}</span>
                                </Badge>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col gap-2 mb-3">
                        <div>
                          <div className="flex items-start gap-2 mb-1">
                            <h3 className="text-base font-semibold text-foreground line-clamp-2 flex-1" title={record.prompt}>
                              {record.prompt}
                            </h3>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0 shrink-0 opacity-60 hover:opacity-100 transition-opacity"
                              onClick={() => copyPromptToClipboard(record.prompt, record.id)}
                              title={copiedPrompts.has(record.id) ? (t("projects.copied") || "已复制") : (t("projects.copyPrompt") || "复制提示词")}
                            >
                              {copiedPrompts.has(record.id) ? (
                                <Check className="w-3 h-3 text-green-600" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </Button>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {formatDateTime(record.createdAt)}
                          </p>
                        </div>
                        <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          {record.type === 'video' ? (
                            <span className="flex items-center gap-1">
                              <Video className="w-3 h-3" />
                              {record.outputVideoUrls?.length || 0} {t("projects.videosCount") || '视频'}
                            </span>
                          ) : (
                            <span className="flex items-center gap-1">
                              <ImageIcon className="w-3 h-3" />
                              {record.imageUrls.length} {t("projects.imagesCount")}
                            </span>
                          )}
                          <span>{(record.aspectRatio === 'auto' || !record.aspectRatio) ? '1:1' : record.aspectRatio}</span>
                          <span>{(record.resolution === 'auto' || !record.resolution) ? '1K' : record.resolution}</span>
                          <span className="flex items-center gap-1">
                            <Sparkles className="w-3 h-3" />
                            {record.type === 'video' ? getVideoModelName(record.model) : record.model === 'kie-ai/nano-banana-pro' ? 'Nano Banana Pro' : record.model === 'kie-ai/nano-banana-2' ? 'Nano Banana 2' : record.model === 'kie-ai/nano-banana-2-lite' ? 'Nano Banana 2 Lite' : record.model?.startsWith('kie-ai/gpt-image/1.5') ? 'GPT Image 1.5' : record.model?.startsWith('kie-ai/gpt-image-2') ? 'GPT Image 2' : record.model?.startsWith('kie-ai/gpt-image') ? 'GPT Image 1.5' : record.model?.startsWith('kie-ai/seedream/5-lite') ? 'Seedream 5.0 Lite' : record.model?.startsWith('kie-ai/seedream/5-pro') ? 'Seedream 5.0 Pro' : record.model?.replace('kie-ai/', '') || 'unknown'}
                          </span>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex gap-2 flex-wrap">
                        {record.type === 'video' ? (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={!record.outputVideoUrls?.length}
                              onClick={() => openVideoPreview(record.outputVideoUrls[0], 0)}
                              className="flex-1 sm:flex-none items-center gap-1.5 text-xs"
                            >
                              <Eye className="w-3 h-3" />
                              {t("projects.view")}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={!record.outputVideoUrls?.length}
                              onClick={() => {
                                const videoUrl = record.outputVideoUrls[0]
                                if (videoUrl) downloadVideo(videoUrl, `video-${record.id}.mp4`)
                              }}
                              className="flex-1 sm:flex-none items-center gap-1.5 text-xs"
                            >
                              <Download className="w-3 h-3" />
                              {t("projects.download")}
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={record.imageUrls.length === 0}
                              onClick={() => openPreview(record.imageUrls[0], 0)}
                              className="flex-1 sm:flex-none items-center gap-1.5 text-xs"
                            >
                              <Eye className="w-3 h-3" />
                              {t("projects.view")}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={record.imageUrls.length === 0 || downloadingImages.has(record.imageUrls[0])}
                              onClick={() => downloadImage(record.imageUrls[0], `generated-image-${record.id}.png`)}
                              className="flex-1 sm:flex-none items-center gap-1.5 text-xs"
                            >
                              {downloadingImages.has(record.imageUrls[0]) ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Download className="w-3 h-3" />
                              )}
                              {downloadingImages.has(record.imageUrls[0])
                                ? (t("operate.downloading") || "...")
                                : t("projects.download")
                              }
                            </Button>
                            {record.imageUrls.length > 1 && (
                              <p className="text-xs text-muted-foreground self-center px-1">
                                +{record.imageUrls.length - 1}
                              </p>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-6 border-t">
              <div className="text-xs sm:text-sm text-muted-foreground order-2 sm:order-1">
                {t("projects.pageInfo", { current: pagination.currentPage, total: pagination.totalPages })}
              </div>
              <div className="flex items-center gap-1 sm:gap-2 order-1 sm:order-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(pagination.currentPage - 1)}
                  disabled={!pagination.hasPreviousPage}
                  className="px-2 sm:px-3"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M15 18l-6-6 6-6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span className="hidden sm:inline ml-1">{t("projects.previous")}</span>
                </Button>

                <div className="hidden sm:flex items-center gap-1">
                  {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                    let pageNum
                    const totalPages = pagination.totalPages
                    const currentPage = pagination.currentPage

                    if (totalPages <= 5) {
                      pageNum = i + 1
                    } else if (currentPage <= 3) {
                      pageNum = i + 1
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i
                    } else {
                      pageNum = currentPage - 2 + i
                    }

                    return (
                      <Button
                        key={pageNum}
                        variant={pageNum === currentPage ? "default" : "outline"}
                        size="sm"
                        onClick={() => handlePageChange(pageNum)}
                        className="w-8 h-8 p-0"
                      >
                        {pageNum}
                      </Button>
                    )
                  })}
                </div>

                <div className="flex sm:hidden items-center justify-center min-w-[60px] text-sm font-medium">
                  {pagination.currentPage}/{pagination.totalPages}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(pagination.currentPage + 1)}
                  disabled={!pagination.hasNextPage}
                  className="px-2 sm:px-3"
                >
                  <span className="hidden sm:inline mr-1">{t("projects.next")}</span>
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M9 18l6-6-6-6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Image Preview Modal */}
      {previewImage && (
        <>
          <div
            className="fixed inset-0 bg-black z-50"
            onClick={closePreview}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="relative max-w-5xl max-h-full">
              <img
                src={previewImage}
                alt="Preview"
                className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              />
              <button
                onClick={closePreview}
                className="absolute top-4 right-4 w-12 h-12 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center text-white transition-colors"
              >
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M6 18L18 6M6 6l12 12" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          </div>
        </>
      )}

      {/* Video Preview Modal */}
      {previewVideoUrl && (
        <>
          <div
            className="fixed inset-0 bg-black z-50"
            onClick={closePreview}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="relative max-w-5xl max-h-full">
              <video
                src={previewVideoUrl}
                controls
                autoPlay
                loop
                muted
                className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              />
              <button
                onClick={closePreview}
                className="absolute top-4 right-4 w-12 h-12 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center text-white transition-colors"
              >
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M6 18L18 6M6 6l12 12" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
