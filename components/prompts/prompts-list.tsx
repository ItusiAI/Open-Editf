'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import Image from 'next/image'
import { Search, Loader2, Copy, Sparkles, Play, Box, Zap, Square, Maximize, Clock, Grid, Video, Star, MessageSquare, ChevronDown } from 'lucide-react'
import { toast } from 'sonner'
import { Navbar } from '@/components/navbar'
import { Footer } from '@/components/footer'
import { useTranslations } from 'next-intl'

interface PromptItem {
  id: string
  type: 'image' | 'video'
  mode: string
  prompt: string
  categories: string[]
  thumbnailUrl?: string
  videoDuration?: number
  videoResolution?: string
  previewModel?: string
  previewAspectRatio?: string
  previewResolution?: string
  isFeatured?: boolean
}

const getCategoryLabel = (tPrompts: ReturnType<typeof useTranslations>, category: string) => {
  const translations: Record<string, string> = {
    general: tPrompts('categories.general'),
    portrait: tPrompts('categories.portrait'),
    landscape: tPrompts('categories.landscape'),
    architecture: tPrompts('categories.architecture'),
    product: tPrompts('categories.product'),
    animal: tPrompts('categories.animal'),
    art: tPrompts('categories.art'),
    photography: tPrompts('categories.photography'),
    ui: tPrompts('categories.ui'),
  }
  return translations[category] || category
}

const getModeLabel = (t: ReturnType<typeof useTranslations>, mode: string) => {
  return t(`modes.${mode}`) || mode
}

const getModelDisplayName = (model: string) => {
  const modelNames: { [key: string]: string } = {
    'gptImage2': 'GPT Image 2',
    'gptImage1_5': 'GPT Image 1.5',
    'nanoBananaPro': 'Nano Banana Pro',
    'nanoBanana2': 'Nano Banana 2',
    'nanoBanana2Lite': 'Nano Banana 2 Lite',
    'seedream5Lite': 'Seedream 5.0 Lite',
    'seedream5Pro': 'Seedream 5.0 Pro',
    'seedance2': 'Seedance 2.0',
    'seedance2fast': 'Seedance 2.0 Fast',
    'seedance2mini': 'Seedance 2.0 Mini',
    'kling30': 'Kling 3.0',
    'klingV3Turbo': 'Kling V3 Turbo',
    'veo3': 'Veo 3.1 Quality',
    'veo3fast': 'Veo 3.1 Fast',
    'veo3lite': 'Veo 3.1 Lite',
    'geminiOmniVideo': 'Gemini Omni',
    'wan27': 'Wan 2.7',
    'happyhorse': 'HappyHorse 1.0',
    'happyhorse11': 'HappyHorse 1.1',
    'minimaxH3': 'MiniMax H3',
  }
  return modelNames[model] || model
}

function PromptCard({
  id,
  type,
  mode,
  prompt,
  categories,
  thumbnailUrl,
  videoDuration,
  videoResolution,
  previewModel,
  previewAspectRatio,
  previewResolution,
  isFeatured,
  t,
  tPrompts,
}: PromptItem & { t: ReturnType<typeof useTranslations>, tPrompts: ReturnType<typeof useTranslations> }) {
  const [copied, setCopied] = useState(false)
  const [showApplyMenu, setShowApplyMenu] = useState(false)
  const tCard = t

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      if (!target?.closest('[data-prompt-apply-menu]')) {
        setShowApplyMenu(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const buildPromptParams = () => {
    const params = new URLSearchParams()
    params.set('prompt', prompt)
    if (type === 'video') {
      params.set('mode', 'video')
      if (mode) params.set('videoMode', mode)
    }
    if (previewModel) params.set('model', previewModel)
    if (previewAspectRatio) params.set('aspectRatio', previewAspectRatio)
    if (previewResolution || videoResolution) params.set('resolution', previewResolution || videoResolution || '')
    if (type === 'video' && videoDuration) params.set('duration', videoDuration.toString())
    return params
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(prompt)
      setCopied(true)
      toast.success(tCard('copySuccess'))
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error(tCard('copyFailed'))
    }
  }

  const gradientColors = [
    'from-purple-500 to-pink-500',
    'from-blue-500 to-cyan-500',
    'from-green-500 to-teal-500',
    'from-orange-500 to-red-500',
    'from-indigo-500 to-purple-500',
    'from-yellow-500 to-orange-500',
  ]
  const colorIndex = id.charCodeAt(0) % gradientColors.length

  return (
    <div className="group bg-card border border-border rounded-2xl overflow-hidden hover:shadow-lg transition-all duration-300 hover:border-primary/50">
      <div className="relative overflow-hidden">
        {thumbnailUrl && type !== 'video' ? (
          <img src={thumbnailUrl} alt="Prompt preview" className="w-full h-auto" style={{ display: 'block' }} />
        ) : thumbnailUrl && type === 'video' ? (
          <div className="relative w-full aspect-video">
            <video 
              src={thumbnailUrl} 
              className="w-full h-full object-cover" 
              muted 
              loop 
              playsInline 
              controls 
            />
          </div>
        ) : (
          <div className={`w-full aspect-video bg-gradient-to-br ${gradientColors[colorIndex]} opacity-80 flex flex-col items-center justify-center gap-2`}>
            <Video className="w-10 h-10 text-white/70" />
            <Play className="w-14 h-14 text-white/90" />
          </div>
        )}
        <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 bg-black/50 backdrop-blur-sm rounded-full text-xs font-medium">
          {type === 'video' ? <><Play className="w-3 h-3" />{tCard('video')}</> : <><Grid className="w-3 h-3" />{tCard('image')}</>}
        </div>
        {type === 'video' && videoDuration && (
          <div className="absolute top-3 right-3 px-2 py-1 bg-black/50 backdrop-blur-sm rounded-full text-xs font-medium">
            {videoDuration}{tCard('seconds')}
          </div>
        )}
      </div>
      <div className="p-4">
        <div className="flex flex-wrap gap-1.5 mb-2">
          {isFeatured && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 text-xs rounded-full font-medium">
              <Star className="w-3 h-3 fill-current" />
              {tCard('featured')}
            </span>
          )}
          {categories.map((cat) => (
            <span key={cat} className="inline-block px-2.5 py-1 bg-primary/10 text-primary text-xs rounded-full font-medium">
              {getCategoryLabel(tPrompts, cat)}
            </span>
          ))}
        </div>
        <div className="bg-secondary/50 rounded-xl p-3 mb-2">
          <p className="text-sm text-foreground line-clamp-4 leading-relaxed">{prompt}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mb-3 p-2 bg-secondary/30 rounded-lg">
          {previewModel && (
            <span className="flex items-center gap-1 px-2 py-1 bg-secondary rounded-md">
              <Box className="w-3 h-3" />{tCard('model')}: {getModelDisplayName(previewModel)}
            </span>
          )}
          <span className="flex items-center gap-1 px-2 py-1 bg-secondary rounded-md">
            <Zap className="w-3 h-3" />{tCard('mode')}: {getModeLabel(tCard, mode)}
          </span>
          {previewAspectRatio && (
            <span className="flex items-center gap-1 px-2 py-1 bg-secondary rounded-md">
              <Square className="w-3 h-3" />{tCard('aspectRatio')}: {previewAspectRatio}
            </span>
          )}
          {(previewResolution || videoResolution) && (
            <span className="flex items-center gap-1 px-2 py-1 bg-secondary rounded-md">
              <Maximize className="w-3 h-3" />{tCard('resolution')}: {previewResolution || videoResolution}
            </span>
          )}
          {type === 'video' && videoDuration && (
            <span className="flex items-center gap-1 px-2 py-1 bg-secondary rounded-md">
              <Clock className="w-3 h-3" />{tCard('duration')}: {videoDuration}{tCard('seconds')}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <button onClick={handleCopy} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-secondary hover:bg-secondary/80 rounded-lg text-sm font-medium transition-colors">
            <Copy className="w-4 h-4" />{copied ? t('copied') : t('copy')}
          </button>
          <div className="flex-1 relative" data-prompt-apply-menu>
            <button
              onClick={() => setShowApplyMenu((prev) => !prev)}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-sm font-medium transition-colors"
            >
              <Sparkles className="w-4 h-4" />{tCard('use')}
              <ChevronDown className="w-3.5 h-3.5 opacity-80" />
            </button>
            {showApplyMenu && (
              <div className="absolute left-0 right-0 bottom-full mb-2 rounded-xl border border-border bg-background shadow-xl overflow-hidden z-20">
                <button
                  onClick={() => {
                    const params = buildPromptParams()
                    setShowApplyMenu(false)
                    window.location.href = `/editor?${params.toString()}`
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left hover:bg-secondary/70 transition-colors"
                >
                  <Sparkles className="w-4 h-4" />
                  {tCard('apply.editor')}
                </button>
                <button
                  onClick={() => {
                    const params = buildPromptParams()
                    setShowApplyMenu(false)
                    window.location.href = `/chat?${params.toString()}`
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left hover:bg-secondary/70 transition-colors border-t border-border"
                >
                  <MessageSquare className="w-4 h-4" />
                  {tCard('apply.chat')}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export function PromptsList() {
  const [items, setItems] = useState<PromptItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [type, setType] = useState('all')
  const [categories, setCategories] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [columns, setColumns] = useState(4)
  const pageSize = 20
  const containerRef = useRef<HTMLDivElement>(null)
  const t = useTranslations('prompts')
  const tCard = useTranslations('promptCard')
  const tCat = useTranslations('prompts.categories')
  const tMasonry = useTranslations('promptMasonry')

  // 响应式列数
  useEffect(() => {
    const updateColumns = () => {
      if (window.innerWidth < 640) setColumns(1)
      else if (window.innerWidth < 1024) setColumns(2)
      else if (window.innerWidth < 1280) setColumns(3)
      else setColumns(4)
    }
    updateColumns()
    window.addEventListener('resize', updateColumns)
    return () => window.removeEventListener('resize', updateColumns)
  }, [])

  const categoryOptions = [
    { value: 'all', label: tCat('all') },
    { value: 'general', label: tCat('general') },
    { value: 'portrait', label: tCat('portrait') },
    { value: 'landscape', label: tCat('landscape') },
    { value: 'architecture', label: tCat('architecture') },
    { value: 'product', label: tCat('product') },
    { value: 'animal', label: tCat('animal') },
    { value: 'art', label: tCat('art') },
    { value: 'photography', label: tCat('photography') },
    { value: 'ui', label: tCat('ui') },
  ]

  const handleCategoryClick = (value: string) => {
    if (value === 'all') {
      setCategories([])
    } else {
      if (categories.includes(value)) {
        setCategories(categories.filter(c => c !== value))
      } else {
        setCategories([...categories, value])
      }
    }
  }

  const fetchPrompts = useCallback(async (pageNum: number, reset = false) => {
    try {
      if (pageNum === 1) setLoading(true)
      else setLoadingMore(true)

      const params = new URLSearchParams()
      params.set('page', pageNum.toString())
      params.set('pageSize', pageSize.toString())
      if (type !== 'all') params.set('type', type)
      if (categories.length > 0) params.set('categories', categories.join(','))

      const response = await fetch(`/api/prompts?${params.toString()}`)
      const result = await response.json()

      if (result.data) {
        if (reset) {
          setItems(result.data)
        } else {
          setItems(prev => [...prev, ...result.data])
        }
        setHasMore(result.pagination.page < result.pagination.totalPages)
      }
    } catch (error) {
      console.error('Failed to fetch prompts:', error)
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [type, categories])

  useEffect(() => {
    setPage(1)
    fetchPrompts(1, true)
  }, [type, categories, fetchPrompts])

  const handleLoadMore = () => {
    const nextPage = page + 1
    setPage(nextPage)
    fetchPrompts(nextPage)
  }

  const filteredItems = searchQuery
    ? items.filter(item =>
        item.prompt.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.categories.some(cat => cat.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : items

  // 瀑布流布局：把卡片分配到各列
  const columnItems = useMemo(() => {
    const cols: PromptItem[][] = Array.from({ length: columns }, () => [])
    filteredItems.forEach((item, index) => {
      cols[index % columns].push(item)
    })
    return cols
  }, [filteredItems, columns])

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden font-sans antialiased">
      <Navbar />
      <div className="bg-gradient-to-b from-primary/5 to-transparent py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">{t('title')}</h1>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">{t('description')}</p>
          </div>

          <div className="space-y-4">
            {/* 第一行：类型切换 + 搜索框 */}
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2 p-1 bg-secondary/50 rounded-xl">
                {['all', 'image', 'video'].map((t_type) => (
                  <button
                    key={t_type}
                    onClick={() => setType(t_type)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      type === t_type
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {t(t_type)}
                  </button>
                ))}
              </div>

              <div className="relative flex-1 min-w-[200px] max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('searchPlaceholder')}
                  className="w-full pl-10 pr-4 py-2.5 bg-secondary/50 border border-border rounded-xl text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                />
              </div>
            </div>

            {/* 第二行：分类标签（多选） */}
            <div className="flex flex-wrap items-center gap-2">
              {categoryOptions.map((cat) => {
                const isSelected = cat.value === 'all' ? categories.length === 0 : categories.includes(cat.value)
                return (
                  <button
                    key={cat.value}
                    onClick={() => handleCategoryClick(cat.value)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                      isSelected
                        ? 'bg-primary/20 text-primary border border-primary/30'
                        : 'bg-secondary/50 text-muted-foreground hover:bg-secondary hover:text-foreground'
                    }`}
                  >
                    {cat.label}
                  </button>
                )
              })}
            </div>

            {/* 提示信息 */}
            <p className="text-center text-sm text-muted-foreground mb-6">{t('disclaimer')}</p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-1">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 mb-4 rounded-full bg-secondary/50 flex items-center justify-center">
              <span className="text-4xl">💭</span>
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">{tMasonry('noPrompts')}</h3>
            <p className="text-sm text-muted-foreground">{tMasonry('noPromptsHint')}</p>
          </div>
        ) : (
          <>
            <div ref={containerRef} className="flex gap-4">
              {columnItems.map((colItems, colIndex) => (
                <div key={colIndex} className="flex-1 flex flex-col gap-4">
                  {colItems.map((item) => (
                    <PromptCard key={item.id} {...item} t={tCard} tPrompts={t} />
                  ))}
                </div>
              ))}
            </div>

            {hasMore && (
              <div className="flex justify-center mt-8">
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="px-6 py-3 bg-secondary hover:bg-secondary/80 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {loadingMore ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />{t('loading')}
                    </span>
                  ) : t('loadMore')}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <Footer />
      <style jsx global>{`
        .font-sans {
          font-family: var(--font-inter), 'Noto Sans SC', system-ui, sans-serif;
        }
      `}</style>
    </div>
  )
}
