'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, Plus, Pencil, Trash2, Image, Video, Check, X, Upload, Star } from 'lucide-react'
import { toast } from 'sonner'
import { Checkbox } from '@/components/ui/checkbox'
import {
  imageModelConfigs,
  videoModelConfigs,
  imageResolutions,
  imageQualities,
  imageModes,
  videoModes,
  getAvailableDurations,
  getModelResolutions,
  getImageModelAspectRatios,
  useImageQuality,
  getVideoModelSupportedModes,
  klingResolutions,
} from '@/lib/models-config'
import { useTranslations } from 'next-intl'

// 文件转 base64
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

interface PromptItem {
  id: string
  type: 'image' | 'video'
  mode: string // 图片: generate/edit, 视频: text2video/image2video/firstlast2video/reference2video/videoEdit
  prompt: string
  categories: string[]
  thumbnailUrl?: string
  videoDuration?: number
  videoResolution?: string
  previewModel?: string
  previewAspectRatio?: string
  previewResolution?: string
  isActive: boolean
  isFeatured: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
}

interface PromptFormData {
  type: 'image' | 'video'
  mode: string
  prompt: string
  categories: string[]
  thumbnailUrl: string
  videoDuration: string
  videoResolution: string
  previewModel: string
  previewAspectRatio: string
  previewResolution: string
  sortOrder: string
  isActive: boolean
  isFeatured: boolean
}

const initialFormData: PromptFormData = {
  type: 'image',
  mode: 'generate',
  prompt: '',
  categories: ['general'],
  thumbnailUrl: '',
  videoDuration: '5',
  videoResolution: '720p',
  previewModel: 'nanoBanana2',
  previewAspectRatio: '1:1',
  previewResolution: '1K',
  sortOrder: '0',
  isActive: true,
  isFeatured: false,
}

const categories = [
  { value: 'general', label: 'adminPrompts.categories.general' },
  { value: 'portrait', label: 'adminPrompts.categories.portrait' },
  { value: 'landscape', label: 'adminPrompts.categories.landscape' },
  { value: 'architecture', label: 'adminPrompts.categories.architecture' },
  { value: 'product', label: 'adminPrompts.categories.product' },
  { value: 'animal', label: 'adminPrompts.categories.animal' },
  { value: 'art', label: 'adminPrompts.categories.art' },
  { value: 'photography', label: 'adminPrompts.categories.photography' },
  { value: 'ui', label: 'adminPrompts.categories.ui' },
]

export function AdminPrompts() {
  const [prompts, setPrompts] = useState<PromptItem[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingPrompt, setEditingPrompt] = useState<PromptItem | null>(null)
  const [formData, setFormData] = useState<PromptFormData>(initialFormData)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const pageSize = 20

  const t = useTranslations('adminPrompts')
  const tCategories = useTranslations('adminPrompts.categories')

  const stats = {
    total: total,
    images: prompts.filter(p => p.type === 'image').length,
    videos: prompts.filter(p => p.type === 'video').length,
    active: prompts.filter(p => p.isActive).length,
  }

  // 获取分类标签
  const getCategoryLabel = (value: string) => {
    return tCategories(value) || value
  }

  // 类型切换时重置相关参数
  useEffect(() => {
    if (formData.type === 'image') {
      setFormData(prev => ({
        ...prev,
        mode: 'generate',
        videoDuration: '5',
        videoResolution: '720p',
      }))
    } else {
      setFormData(prev => {
        const modelResolutions = getModelResolutions(prev.previewModel || 'seedance2')
        const durations = getAvailableDurations(prev.previewModel || 'seedance2')
        const supportedModes = getVideoModelSupportedModes(prev.previewModel || 'seedance2')
        const defaultMode = supportedModes.includes(prev.mode) ? prev.mode : supportedModes[0] || 'text2video'
        return {
          ...prev,
          mode: defaultMode,
          previewModel: prev.previewModel || 'seedance2',
          previewAspectRatio: '1:1',
          previewResolution: '1K',
          videoResolution: modelResolutions.includes(prev.videoResolution) ? prev.videoResolution : modelResolutions[0],
          videoDuration: durations.includes(prev.videoDuration) ? prev.videoDuration : durations[0] || '5',
        }
      })
    }
  }, [formData.type])

  // 视频模型切换时重置分辨率、时长和模式
  const handleVideoModelChange = (modelKey: string) => {
    const resolutions = modelKey === 'kling30' ? klingResolutions : getModelResolutions(modelKey)
    const durations = getAvailableDurations(modelKey)
    const supportedModes = getVideoModelSupportedModes(modelKey)
    setFormData(prev => ({
      ...prev,
      previewModel: modelKey,
      mode: supportedModes.includes(prev.mode) ? prev.mode : supportedModes[0] || 'text2video',
      videoResolution: resolutions[0],
      videoDuration: durations[0] || '5',
    }))
  }

  // 图片模型切换时重置比例
  const handleImageModelChange = (modelKey: string) => {
    const aspectRatios = getImageModelAspectRatios(modelKey)
    setFormData(prev => ({
      ...prev,
      previewModel: modelKey,
      previewAspectRatio: aspectRatios[0],
      previewResolution: useImageQuality(modelKey) ? 'high' : '1K',
    }))
  }

  // 图片模式切换
  const handleImageModeChange = (mode: string) => {
    setFormData(prev => ({ ...prev, mode }))
  }

  // 视频模式切换
  const handleVideoModeChange = (mode: string) => {
    setFormData(prev => ({ ...prev, mode }))
  }

  const fetchPrompts = useCallback(async (pageNum: number = 1) => {
    try {
      setLoading(true)
      const response = await fetch(`/api/admin/prompts?page=${pageNum}&pageSize=${pageSize}`)
      const result = await response.json()
      if (result.data) {
        setPrompts(result.data)
        setPage(result.pagination.page)
        setTotal(result.pagination.total)
        setTotalPages(result.pagination.totalPages)
      }
    } catch (error) {
      console.error('Failed to fetch prompts:', error)
    } finally {
      setLoading(false)
    }
  }, [pageSize])

  useEffect(() => {
    fetchPrompts()
  }, [fetchPrompts])

  const openAddDialog = () => {
    setEditingPrompt(null)
    setFormData({ ...initialFormData })
    setDialogOpen(true)
  }

  const openEditDialog = (prompt: PromptItem) => {
    setEditingPrompt(prompt)
    setFormData({
      type: prompt.type,
      mode: prompt.mode || (prompt.type === 'video' ? 'text2video' : 'generate'),
      prompt: prompt.prompt,
      categories: prompt.categories || ['general'],
      thumbnailUrl: prompt.thumbnailUrl || '',
      videoDuration: prompt.videoDuration?.toString() || '5',
      videoResolution: prompt.videoResolution || '720p',
      previewModel: prompt.previewModel || (prompt.type === 'video' ? 'seedance2' : 'nanoBanana2'),
      previewAspectRatio: prompt.previewAspectRatio || '1:1',
      previewResolution: prompt.previewResolution || '1K',
      sortOrder: prompt.sortOrder.toString(),
      isActive: prompt.isActive,
      isFeatured: prompt.isFeatured,
    })
    setDialogOpen(true)
  }

  const handleSubmit = async () => {
    if (!formData.prompt.trim()) {
      toast.error(t('toast.promptRequired'))
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        type: formData.type,
        mode: formData.mode,
        prompt: formData.prompt,
        categories: formData.categories,
        thumbnailUrl: formData.thumbnailUrl || undefined,
        videoDuration: formData.type === 'video' ? parseInt(formData.videoDuration) : undefined,
        videoResolution: formData.type === 'video' ? formData.videoResolution : undefined,
        previewModel: formData.previewModel || undefined,
        previewAspectRatio: formData.previewAspectRatio || undefined,
        previewResolution: formData.previewResolution || undefined,
        sortOrder: parseInt(formData.sortOrder) || 0,
        isActive: formData.isActive,
        isFeatured: formData.isFeatured,
      }

      const url = editingPrompt ? `/api/prompts/${editingPrompt.id}` : '/api/prompts'
      const method = editingPrompt ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (response.ok) {
        toast.success(editingPrompt ? t('toast.updateSuccess') : t('toast.addSuccess'))
        setDialogOpen(false)
        fetchPrompts()
      } else {
        const result = await response.json()
        toast.error(result.error || t('toast.operationFailed'))
      }
    } catch (error) {
      console.error('Submit error:', error)
      toast.error(t('toast.operationFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/prompts/${id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        toast.success(t('toast.deleteSuccess'))
        setDeleteConfirmId(null)
        fetchPrompts()
      } else {
        const result = await response.json()
        toast.error(result.error || t('toast.deleteFailed'))
      }
    } catch (error) {
      console.error('Delete error:', error)
      toast.error(t('toast.deleteFailed'))
    }
  }

  const handleToggleActive = async (prompt: PromptItem) => {
    try {
      const response = await fetch(`/api/prompts/${prompt.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !prompt.isActive }),
      })

      if (response.ok) {
        toast.success(prompt.isActive ? t('toast.disabled') : t('toast.enabled'))
        fetchPrompts()
      } else {
        toast.error(t('toast.operationFailed'))
      }
    } catch (error) {
      console.error('Toggle error:', error)
      toast.error(t('toast.operationFailed'))
    }
  }

  const handleToggleFeatured = async (prompt: PromptItem) => {
    try {
      const response = await fetch(`/api/prompts/${prompt.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isFeatured: !prompt.isFeatured }),
      })

      if (response.ok) {
        toast.success(prompt.isFeatured ? t('toast.removeFeatured') : t('toast.setFeatured'))
        fetchPrompts()
      } else {
        toast.error(t('toast.operationFailed'))
      }
    } catch (error) {
      console.error('Toggle featured error:', error)
      toast.error(t('toast.operationFailed'))
    }
  }

  return (
    <div>
      {/* 统计卡片 */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-card border rounded-xl p-4">
          <div className="text-2xl font-bold">{stats.total}</div>
          <div className="text-sm text-muted-foreground">{t('stats.total')}</div>
        </div>
        <div className="bg-card border rounded-xl p-4">
          <div className="text-2xl font-bold flex items-center gap-2">
            <Image className="w-5 h-5" />
            {stats.images}
          </div>
          <div className="text-sm text-muted-foreground">{t('stats.image')}</div>
        </div>
        <div className="bg-card border rounded-xl p-4">
          <div className="text-2xl font-bold flex items-center gap-2">
            <Video className="w-5 h-5" />
            {stats.videos}
          </div>
          <div className="text-sm text-muted-foreground">{t('stats.video')}</div>
        </div>
        <div className="bg-card border rounded-xl p-4">
          <div className="text-2xl font-bold">{stats.active}</div>
          <div className="text-sm text-muted-foreground">{t('stats.active')}</div>
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="flex justify-end mb-4">
        <Button onClick={openAddDialog}>
          <Plus className="w-4 h-4 mr-2" />
          {t('addButton')}
        </Button>
      </div>

      {/* 列表 */}
      <div className="bg-card border rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : prompts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <span className="text-4xl mb-4">📝</span>
            <h3 className="text-lg font-semibold mb-2">{t('empty.title')}</h3>
            <p className="text-sm text-muted-foreground mb-4">{t('empty.hint')}</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-secondary/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium">{t('table.type')}</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">{t('table.prompt')}</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">{t('table.category')}</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">{t('table.status')}</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">{t('table.featured')}</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">{t('table.sort')}</th>
                  <th className="px-4 py-3 text-right text-sm font-medium">{t('table.actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {prompts.map((prompt) => (
                    <tr key={prompt.id} className="hover:bg-secondary/30">
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                          prompt.type === 'video'
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                            : 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                        }`}>
                          {prompt.type === 'video' ? (
                            <Video className="w-3 h-3" />
                          ) : (
                            <Image className="w-3 h-3" />
                          )}
                          {prompt.type === 'video' ? t('dialog.video') : t('dialog.image')}
                        </span>
                      </td>
                      <td className="px-4 py-3 max-w-xs">
                        <div className="text-sm line-clamp-2">{prompt.prompt}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {prompt.categories.slice(0, 3).map((cat) => (
                            <span key={cat} className="px-2 py-1 bg-secondary rounded text-xs">
                              {getCategoryLabel(cat)}
                            </span>
                          ))}
                          {prompt.categories.length > 3 && (
                            <span className="px-2 py-1 text-muted-foreground text-xs">
                              +{prompt.categories.length - 3}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleToggleActive(prompt)}
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                            prompt.isActive
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                              : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                          }`}
                        >
                          {prompt.isActive ? (
                            <Check className="w-3 h-3" />
                          ) : (
                            <X className="w-3 h-3" />
                          )}
                          {prompt.isActive ? t('status.enabled') : t('status.disabled')}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleToggleFeatured(prompt)}
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                            prompt.isFeatured
                              ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                              : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                          }`}
                        >
                          <Star className={`w-3 h-3 ${prompt.isFeatured ? 'fill-current' : ''}`} />
                          {prompt.isFeatured ? t('status.featured') : t('status.normal')}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-sm">{prompt.sortOrder}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditDialog(prompt)}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          {deleteConfirmId === prompt.id ? (
                            <div className="flex items-center gap-1">
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleDelete(prompt.id)}
                              >
                                {t('actions.confirm')}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setDeleteConfirmId(null)}
                              >
                                {t('actions.cancel')}
                              </Button>
                            </div>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeleteConfirmId(prompt.id)}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 分页 */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 py-4 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fetchPrompts(page - 1)}
                  disabled={page <= 1}
                >
                  {t('pagination.prev')}
                </Button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                    <Button
                      key={pageNum}
                      variant={pageNum === page ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => fetchPrompts(pageNum)}
                      className="w-10"
                    >
                      {pageNum}
                    </Button>
                  ))}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fetchPrompts(page + 1)}
                  disabled={page >= totalPages}
                >
                  {t('pagination.next')}
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {/* 添加/编辑对话框 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingPrompt ? t('dialog.editTitle') : t('dialog.addTitle')}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* 类型 */}
            <div className="space-y-2">
              <Label>{t('dialog.type')}</Label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="type"
                    value="image"
                    checked={formData.type === 'image'}
                    onChange={() => setFormData({ ...formData, type: 'image' })}
                    className="w-4 h-4"
                  />
                  <Image className="w-4 h-4" />
                  {t('dialog.image')}
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="type"
                    value="video"
                    checked={formData.type === 'video'}
                    onChange={() => setFormData({ ...formData, type: 'video' })}
                    className="w-4 h-4"
                  />
                  <Video className="w-4 h-4" />
                  {t('dialog.video')}
                </label>
              </div>
            </div>

            {/* Prompt 内容 */}
            <div className="space-y-2">
              <Label>{t('dialog.promptContent')} *</Label>
              <Textarea
                value={formData.prompt}
                onChange={(e) => setFormData({ ...formData, prompt: e.target.value })}
                placeholder={t('dialog.promptPlaceholder')}
                rows={4}
              />
            </div>

            {/* 分类（多选） */}
            <div className="space-y-2">
              <Label>{t('dialog.category')}</Label>
              <div className="grid grid-cols-2 gap-2 p-3 border rounded-lg bg-background">
                {categories.map((cat) => (
                  <div key={cat.value} className="flex items-center gap-2">
                    <Checkbox
                      id={`cat-${cat.value}`}
                      checked={formData.categories.includes(cat.value)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setFormData({ ...formData, categories: [...formData.categories, cat.value] })
                        } else {
                          setFormData({ ...formData, categories: formData.categories.filter(c => c !== cat.value) })
                        }
                      }}
                    />
                    <Label htmlFor={`cat-${cat.value}`} className="text-sm cursor-pointer">
                      {getCategoryLabel(cat.value)}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            {/* 缩略图 */}
            <div className="space-y-2">
              <Label>{t('dialog.thumbnail')} {formData.type === 'image' ? t('dialog.image') : t('dialog.video')} {t('dialog.optional')}</Label>
              <div className="space-y-3">
                {/* 预览 */}
                {formData.thumbnailUrl && (
                  <div className="relative w-32 h-32 border rounded-md overflow-hidden bg-muted">
                    {formData.type === 'image' ? (
                      <img
                        src={formData.thumbnailUrl}
                        alt={t('dialog.thumbnail')}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <video
                        src={formData.thumbnailUrl}
                        className="w-full h-full object-cover"
                        muted
                        playsInline
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, thumbnailUrl: '' })}
                      className="absolute top-1 right-1 w-5 h-5 bg-black/50 text-white rounded-full text-xs flex items-center justify-center hover:bg-black/70"
                    >
                      ×
                    </button>
                  </div>
                )}
                {/* 上传按钮和URL输入 */}
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={uploading}
                    onClick={() => {
                      const input = document.createElement('input')
                      input.type = 'file'
                      input.accept = formData.type === 'image' ? 'image/*' : 'video/*'
                      input.onchange = async (e) => {
                        const file = (e.target as HTMLInputElement).files?.[0]
                        if (!file) return
                        setUploading(true)
                        try {
                          const res = await fetch('/api/prompts/upload', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              filename: file.name,
                              contentType: file.type,
                              data: await fileToBase64(file),
                              type: formData.type === 'video' ? 'video' : 'image',
                            }),
                          })
                          if (res.ok) {
                            const result = await res.json()
                            setFormData(prev => ({ ...prev, thumbnailUrl: result.url }))
                            toast.success(`${t('toast.uploadSuccess')}: ${result.url}`)
                          } else {
                            const error = await res.json()
                            toast.error(error.error || t('toast.uploadFailed'))
                          }
                        } catch (err) {
                          console.error('Upload error:', err)
                          toast.error(t('toast.uploadFailed'))
                        } finally {
                          setUploading(false)
                        }
                      }
                      input.click()
                    }}
                  >
                    {uploading ? (
                      <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4 mr-1" />
                    )}
                    {uploading ? t('toast.uploading') : t('dialog.upload')}
                  </Button>
                  <Input
                    value={formData.thumbnailUrl}
                    onChange={(e) => setFormData({ ...formData, thumbnailUrl: e.target.value })}
                    placeholder={t('dialog.urlPlaceholder')}
                    className="flex-1"
                  />
                </div>
              </div>
            </div>

            {/* 图片参数 */}
            {formData.type === 'image' && (
              <div className="border-t pt-4 mt-4">
                <div className="text-sm font-medium mb-4 text-muted-foreground">{t('dialog.imageParams')}</div>
                <div className="grid grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label>{t('dialog.model')}</Label>
                    <Select value={formData.previewModel} onValueChange={handleImageModelChange}>
                      <SelectTrigger>
                        <SelectValue placeholder={t('dialog.selectModel')} />
                      </SelectTrigger>
                      <SelectContent>
                        {imageModelConfigs.map((m) => (
                          <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{t('dialog.mode')}</Label>
                    <Select value={formData.mode} onValueChange={handleImageModeChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {imageModes.map((m) => (
                          <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{t('dialog.aspectRatio')}</Label>
                    <Select value={formData.previewAspectRatio} onValueChange={(v) => setFormData({ ...formData, previewAspectRatio: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder={t('dialog.selectRatio')} />
                      </SelectTrigger>
                      <SelectContent>
                        {getImageModelAspectRatios(formData.previewModel || 'nanoBanana2').map((r) => (
                          <SelectItem key={r} value={r}>{r}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {useImageQuality(formData.previewModel) ? (
                    <div className="space-y-2">
                      <Label>{t('dialog.quality')}</Label>
                      <Select value={formData.previewResolution} onValueChange={(v) => setFormData({ ...formData, previewResolution: v })}>
                        <SelectTrigger>
                          <SelectValue placeholder={t('dialog.selectQuality')} />
                        </SelectTrigger>
                        <SelectContent>
                          {imageQualities.map((q) => (
                            <SelectItem key={q} value={q}>{q}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label>{t('dialog.resolution')}</Label>
                      <Select value={formData.previewResolution} onValueChange={(v) => setFormData({ ...formData, previewResolution: v })}>
                        <SelectTrigger>
                          <SelectValue placeholder={t('dialog.selectResolution')} />
                        </SelectTrigger>
                        <SelectContent>
                          {imageResolutions.map((r) => (
                            <SelectItem key={r} value={r}>{r}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 视频参数 */}
            {formData.type === 'video' && (
              <div className="border-t pt-4 mt-4">
                <div className="text-sm font-medium mb-4 text-muted-foreground">{t('dialog.videoParams')}</div>
                <div className="grid grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label>{t('dialog.model')}</Label>
                    <Select value={formData.previewModel} onValueChange={handleVideoModelChange}>
                      <SelectTrigger>
                        <SelectValue placeholder={t('dialog.selectModel')} />
                      </SelectTrigger>
                      <SelectContent>
                        {videoModelConfigs.map((m) => (
                          <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{t('dialog.videoMode')}</Label>
                    <Select value={formData.mode} onValueChange={handleVideoModeChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {getVideoModelSupportedModes(formData.previewModel).map((m) => (
                          <SelectItem key={m} value={m}>
                            {videoModes.find(vm => vm.key === m)?.label || m}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{t('dialog.duration')}</Label>
                    <Select
                      value={formData.videoDuration}
                      onValueChange={(v) => setFormData({ ...formData, videoDuration: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {getAvailableDurations(formData.previewModel).map((d) => (
                          <SelectItem key={d} value={d}>{d}{t('toast.seconds')}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{t('dialog.resolution')}</Label>
                    <Select
                      value={formData.videoResolution}
                      onValueChange={(v) => setFormData({ ...formData, videoResolution: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(formData.previewModel === 'kling30' ? klingResolutions : getModelResolutions(formData.previewModel)).map((r) => (
                          <SelectItem key={r} value={r}>{r}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}

            {/* 排序 */}
            <div className="border-t pt-4 mt-4">
              <div className="text-sm font-medium mb-4 text-muted-foreground">{t('dialog.sort')}</div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('dialog.sortHint')}</Label>
                  <Input
                    type="number"
                    value={formData.sortOrder}
                    onChange={(e) => setFormData({ ...formData, sortOrder: e.target.value })}
                    placeholder="0"
                  />
                </div>
              </div>
            </div>

            {/* 启用状态 */}
            <div className="flex items-center gap-2">
              <Switch
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
              />
              <Label>{t('dialog.enabled')}</Label>
            </div>

            {/* 精选状态 */}
            <div className="flex items-center gap-2">
              <Switch
                checked={formData.isFeatured}
                onCheckedChange={(checked) => setFormData({ ...formData, isFeatured: checked })}
              />
              <Label className="flex items-center gap-1">
                <Star className="w-4 h-4 text-yellow-500" />
                {t('dialog.featured')}
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {t('dialog.cancel')}
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingPrompt ? t('dialog.save') : t('dialog.add')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
