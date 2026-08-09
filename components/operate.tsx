"use client"

import type React from "react"

import { useState, useRef, useEffect, type KeyboardEvent } from "react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction } from "@/components/ui/alert-dialog"
import { PricingDialog } from "@/components/pricing-dialog"
import { Input } from "@/components/ui/input"
import { Plus, Sparkles, X, Zap, Crop, ChevronLeft, ChevronRight, ChevronDown, Link, Upload, Download, Loader2, Eye, Settings2, FileUp, Play, Music, Image, Video, Monitor, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { useTranslations } from "next-intl"
import { useSearchParams } from "next/navigation"
import { useSession } from "next-auth/react"
import { SignInDialog } from "@/components/auth/signin-dialog"
import { useToast } from "@/hooks/use-toast"
import Pusher from "pusher-js"

interface AIFunctionProps {
  onSend?: (message: string) => void
  onImageUpload?: (file: File) => void
  placeholder?: string
}

const MAX_CHARACTERS = 20000

export function AIFunction({
  onSend,
  onImageUpload,
  placeholder,
}: AIFunctionProps) {
  const searchParams = useSearchParams()
  const [message, setMessage] = useState("")
  const [selectedImages, setSelectedImages] = useState<File[]>([])
  const [imageUrls, setImageUrls] = useState<string[]>([])
  type UploadingItem = {
    id: string
    filename: string
    localUrl: string
    status: "uploading" | "done" | "error"
    url?: string
    fileType: "image" | "video" | "audio"
    size?: number
    duration?: number
  }
  const [uploadingItems, setUploadingItems] = useState<UploadingItem[]>([])
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [aspectRatio, setAspectRatio] = useState<string>("1:1")
  const [duration, setDuration] = useState<string>("1K")
  const [quality, setQuality] = useState<string>("medium")
  const [selectedModel, setSelectedModel] = useState<string>("nanoBanana2")
  const [selectedVideoModel, setSelectedVideoModel] = useState<string>("seedance2")
  const [contentType, setContentType] = useState<"image" | "video">("image")
  // 视频生成模式: text2video(文生视频), image2video(图生视频), firstlast2video(首尾帧), reference2video(参考生视频), videoEdit(视频编辑)
  const [videoGenerateMode, setVideoGenerateMode] = useState<"text2video" | "image2video" | "firstlast2video" | "reference2video" | "videoEdit">("text2video")
  // 视频编辑参数
  const [videoAspectRatio, setVideoAspectRatio] = useState<string>("16:9")
  const [videoResolution, setVideoResolution] = useState<string>("720p")
  const [videoDuration, setVideoDuration] = useState<number>(5) // 默认5秒
  const [audioSetting, setAudioSetting] = useState<string>("auto")
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [showUploadPopover, setShowUploadPopover] = useState(false)
  const [isSignInDialogOpen, setIsSignInDialogOpen] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false) // 是否是编辑模式
  const [generatedImages, setGeneratedImages] = useState<any[]>([])
  const [showResults, setShowResults] = useState(false)
  const [generatedPreviewImage, setGeneratedPreviewImage] = useState<string | null>(null)
  const [generatedPreviewIndex, setGeneratedPreviewIndex] = useState<number | null>(null)
  const [generatedPreviewIsVideo, setGeneratedPreviewIsVideo] = useState<boolean>(false)
  const [pointsCost, setPointsCost] = useState(10) // 积分消耗，根据是否有图片动态设置
  const [showPurchaseDialog, setShowPurchaseDialog] = useState(false)
  const [showErrorDialog, setShowErrorDialog] = useState(false)
  const [errorDialogMessage, setErrorDialogMessage] = useState("")
  const [downloadingImages, setDownloadingImages] = useState<Set<string>>(new Set()) // 正在下载的图片URL集合
  const [currentPoints, setCurrentPoints] = useState<number | null>(null)
  const { data: session, status } = useSession()
  const { toast } = useToast()
  const t = useTranslations("home")
  const placeholderText = t("chat.inputPlaceholder")
  const [subscriptionTier, setSubscriptionTier] = useState<string | null>(null)
  const [maxUploadBytes, setMaxUploadBytes] = useState<number>(10 * 1024 * 1024) // default 10MB for free users
  const [purchaseReason, setPurchaseReason] = useState<'points' | 'quota' | null>(null)

  const formatBytes = (bytes: number) => {
    if (!isFinite(bytes)) return "无限制"
    return `${Math.round(bytes / (1024 * 1024))}MB`
  }

  useEffect(() => {
    const fetchSubscription = async () => {
      try {
        const res = await fetch("/api/user/subscription")
        if (!res.ok) return
        const json = await res.json()
        const tier = json?.tier || json?.data?.tier || null
        setSubscriptionTier(tier)
        let limit = 10 * 1024 * 1024 // 免费用户 10MB
        if (tier === "trial") limit = 50 * 1024 * 1024
        else if (tier === "pro") limit = 100 * 1024 * 1024
        else if (tier === "annual" || tier === "annual_plan" || tier === "annual_subscription") limit = Number.POSITIVE_INFINITY // 不限制
        setMaxUploadBytes(limit)
      } catch (err) {
        console.error("fetch subscription error:", err)
      }
    }

    if (status === "authenticated") {
      fetchSubscription()
    }
  }, [status])

  // 从 URL 参数初始化状态
  useEffect(() => {
    if (!searchParams) return
    const prompt = searchParams.get('prompt')
    const model = searchParams.get('model')
    const aspectRatioParam = searchParams.get('aspectRatio')
    const resolution = searchParams.get('resolution')
    const mode = searchParams.get('mode')
    const duration = searchParams.get('duration')
    const videoMode = searchParams.get('videoMode')

    if (prompt) setMessage(prompt)
    if (mode === 'video') {
      setContentType('video')
      // 视频模式：先设置模型，然后延迟设置其他参数（避免被模型切换逻辑重置）
      if (model) setSelectedVideoModel(model)
      if (videoMode) setVideoGenerateMode(videoMode as "text2video" | "image2video" | "firstlast2video" | "reference2video" | "videoEdit")
      // 延迟设置其他参数，确保模型已设置完成
      setTimeout(() => {
        if (aspectRatioParam) setVideoAspectRatio(aspectRatioParam)
        if (resolution) setVideoResolution(resolution)
        if (duration) setVideoDuration(parseInt(duration))
      }, 0)
    } else {
      // 图片模式：先设置模型，然后延迟设置其他参数
      if (model) setSelectedModel(model)
      // 延迟设置其他参数，确保模型已设置完成
      setTimeout(() => {
        if (aspectRatioParam) setAspectRatio(aspectRatioParam)
        // Seedream 使用 quality，其他模型使用 resolution(duration)
        if (resolution) {
          if (model === 'seedream5Lite' || model === 'seedream5Pro' || resolution === 'basic' || resolution === 'high') {
            setQuality(resolution)
          } else {
            setDuration(resolution)
          }
        }
      }, 0)
    }
  }, [searchParams])

  const handleSend = async () => {
    // 检查用户是否已登录
    if (status !== 'authenticated') {
      setIsSignInDialogOpen(true)
      return
    }

    // 视频模式：根据不同模式检查输入
    if (contentType === 'video') {
      const videoFiles = uploadingItems.filter((item) => item.fileType === 'video')
      const imageFiles = uploadingItems.filter((item) => item.fileType === 'image')

      if (videoGenerateMode === 'text2video') {
        // 文生视频：不需要任何输入
      } else if (videoGenerateMode === 'image2video') {
        // 图生视频：需要至少一张图片作为首帧
        if (imageFiles.length === 0) {
          setErrorDialogMessage(t("operate.imageRequired") || "Please upload an image as the first frame")
          setShowErrorDialog(true)
          return
        }
        // MiniMax H3 图生视频最多支持 1 张图片
        if (selectedVideoModel === "minimaxH3" && imageFiles.length > 1) {
          setErrorDialogMessage(t("operate.minimaxH3MaxImages") || "MiniMax H3 图生视频最多支持 1 张图片")
          setShowErrorDialog(true)
          return
        }
      } else if (videoGenerateMode === 'firstlast2video') {
        // 首尾帧视频：需要至少两张图片
        if (imageFiles.length < 2) {
          setErrorDialogMessage(t("operate.twoImagesRequired") || "Please upload at least two images (first and last frame)")
          setShowErrorDialog(true)
          return
        }
      } else if (videoGenerateMode === 'reference2video') {
        // 参考生视频：只支持 Seedance、Veo 3.1 Fast 和 HappyHorse
        if (selectedVideoModel.startsWith("seedance")) {
          // Seedance: 多模态参考生视频，支持图片/视频/音频任意组合
          const hasImage = imageFiles.length > 0
          const hasVideo = videoFiles.length > 0
          const audioFilesInRef = uploadingItems.filter((item) => item.fileType === 'audio')
          const hasAudio = audioFilesInRef.length > 0
          if (!hasImage && !hasVideo && !hasAudio) {
            setErrorDialogMessage(t("operate.referenceFileRequired") || "Please upload an image, video, or audio file")
            setShowErrorDialog(true)
            return
          }
          // Seedance 2.5: 图片最多30, 视频最多10, 音频最多10
          // Seedance 2.0 系列: 图片最多9, 视频最多3, 音频最多3
          const isSeedance25 = selectedVideoModel === "seedance25"
          const maxImages = isSeedance25 ? 30 : 9
          const maxVideos = isSeedance25 ? 10 : 3
          const maxAudios = isSeedance25 ? 10 : 3
          if (imageFiles.length > maxImages) {
            setErrorDialogMessage(t("operate.seedanceMaxImages") || `Seedance 参考生视频最多支持 ${maxImages} 张图片，请检查上传数量`)
            setShowErrorDialog(true)
            return
          }
          if (videoFiles.length > maxVideos) {
            setErrorDialogMessage(t("operate.seedanceMaxVideos") || `Seedance 参考生视频最多支持 ${maxVideos} 个视频，请检查上传数量`)
            setShowErrorDialog(true)
            return
          }
          if (audioFilesInRef.length > maxAudios) {
            setErrorDialogMessage(t("operate.seedanceMaxAudios") || `Seedance 参考生视频最多支持 ${maxAudios} 个音频，请检查上传数量`)
            setShowErrorDialog(true)
            return
          }
        } else if (selectedVideoModel === "veo3fast") {
          // Veo 3.1 Fast: 只支持 1-3 张图片
          if (imageFiles.length < 1 || imageFiles.length > 3) {
            setErrorDialogMessage(t("operate.veoReferenceVideoDialogHint") || "Veo 参考图生视频需要 1-3 张参考图片，请检查上传数量")
            setShowErrorDialog(true)
            return
          }
        } else if (selectedVideoModel === "happyhorse") {
          // HappyHorse: 需要 1-9 张图片
          if (imageFiles.length < 1 || imageFiles.length > 9) {
            setErrorDialogMessage(t("operate.happyhorseMaxImages"))
            setShowErrorDialog(true)
            return
          }
        } else if (selectedVideoModel === "happyhorse11") {
          // HappyHorse 1.1 参考生视频: 需要 1-9 张图片
          if (imageFiles.length < 1 || imageFiles.length > 9) {
            setErrorDialogMessage(t("operate.happyhorse11MaxImages") || "HappyHorse 1.1 参考图生视频最多支持 9 张参考图片，请检查上传数量")
            setShowErrorDialog(true)
            return
          }
        } else if (selectedVideoModel === "wan27") {
          // Wan: 需要至少 1 个图片或视频，最多 5 个图片和 5 个视频
          const hasImage = imageFiles.length > 0
          const hasVideo = videoFiles.length > 0
          if (!hasImage && !hasVideo) {
            setErrorDialogMessage(t("operate.wanReferenceFileRequired"))
            setShowErrorDialog(true)
            return
          }
          if (imageFiles.length > 5) {
            setErrorDialogMessage(t("operate.wanMaxImages"))
            setShowErrorDialog(true)
            return
          }
          if (videoFiles.length > 5) {
            setErrorDialogMessage(t("operate.wanMaxVideos"))
            setShowErrorDialog(true)
            return
          }
        } else if (selectedVideoModel === "geminiOmniVideo") {
          // Gemini Omni: 最多 7 张图片或 1 个视频（视频时长≤30s，截取≤10s）
          if (imageFiles.length > 7) {
            setErrorDialogMessage(t("operate.geminiOmniMaxImages") || "Gemini Omni 参考生视频最多支持 7 张参考图片，请检查上传数量")
            setShowErrorDialog(true)
            return
          }
          if (videoFiles.length > 1) {
            setErrorDialogMessage(t("operate.geminiOmniMaxVideos") || "Gemini Omni 参考生视频最多支持 1 个参考视频，请检查上传数量")
            setShowErrorDialog(true)
            return
          }
        } else if (selectedVideoModel === "minimaxH3") {
          // MiniMax H3 参考生视频：最多 9 张图片 + 3 个视频
          if (imageFiles.length > 9) {
            setErrorDialogMessage(t("operate.minimaxH3MaxImages") || "MiniMax H3 参考生视频最多支持 9 张图片")
            setShowErrorDialog(true)
            return
          }
          if (videoFiles.length > 3) {
            setErrorDialogMessage(t("operate.minimaxH3MaxVideos") || "MiniMax H3 参考生视频最多支持 3 个参考视频")
            setShowErrorDialog(true)
            return
          }
        }
      } else if (videoGenerateMode === 'videoEdit') {
        if (selectedVideoModel === "happyhorse") {
          if (videoFiles.length === 0) {
            setErrorDialogMessage(t("operate.happyhorseVideoEditRequired"))
            setShowErrorDialog(true)
            return
          }
        } else if (selectedVideoModel === "wan27") {
          if (videoFiles.length === 0) {
            setErrorDialogMessage(t("operate.wanVideoEditRequired"))
            setShowErrorDialog(true)
            return
          }
        }
      }

      // 如果有视频上传，检查是否上传完成
      if (videoFiles.length > 0 && !videoFiles[0]?.url) {
        setErrorDialogMessage(t("operate.videoUploadInProgress"))
        setShowErrorDialog(true)
        setIsGenerating(false)
        setShowResults(false)
        return
      }
    } else {
      if (!message.trim() && selectedImages.length === 0 && imageUrls.length === 0) {
        return
      }
    }

    setIsGenerating(true)
    // 判断是编辑还是生成模式
    const editMode = selectedImages.length > 0 || imageUrls.length > 0
    setIsEditMode(editMode)
    // 立即显示结果区域（显示加载占位图）
    setShowResults(true)
    // 清空之前的生成结果
    setGeneratedImages([])

    try {
      // 根据内容类型选择 API 端点
      if (contentType === 'video') {
        // 视频生成/编辑模式
        const videoFiles = uploadingItems.filter((item) => item.fileType === 'video')
        const imageFiles = uploadingItems.filter((item) => item.fileType === 'image')
        const audioFiles = uploadingItems.filter((item) => item.fileType === 'audio')
        const videoUrl = videoFiles[0]?.url

        // 根据生成模式构建请求参数
        let apiBody: any = {
          prompt: message,
          model: selectedVideoModel,
          aspectRatio: videoAspectRatio,
          resolution: videoResolution,
          duration: videoDuration,
          audioSetting: audioSetting,
          videoGenerateMode: videoGenerateMode,
        }

        // 根据不同模式设置不同的参数
        const isVeoModel = selectedVideoModel.startsWith("veo")
        const isWanModel = selectedVideoModel === "wan27"
        const isHappyHorseModel = selectedVideoModel === "happyhorse"
        let apiEndpoint = '/api/ai/kie/seedance'
        let requestBody: any = apiBody

        if (isVeoModel) {
          // Veo 3.1 系列使用 veo API
          apiEndpoint = '/api/ai/kie/veo'

          // Veo 3.1 generationType 映射
          const veoGenerationTypeMap: Record<string, string> = {
            "text2video": "TEXT_2_VIDEO",
            "image2video": "FIRST_AND_LAST_FRAMES_2_VIDEO",
            "firstlast2video": "FIRST_AND_LAST_FRAMES_2_VIDEO",
            "reference2video": "REFERENCE_2_VIDEO",
          }

          // 根据模型选择对应的 API model 参数
          const veoModelMap: Record<string, string> = {
            "veo3": "veo3",
            "veo3fast": "veo3_fast",
            "veo3lite": "veo3_lite",
          }

          requestBody = {
            prompt: message,
            model: veoModelMap[selectedVideoModel] || "veo3_lite",
            generationType: veoGenerationTypeMap[videoGenerateMode] || "TEXT_2_VIDEO",
            aspectRatio: videoAspectRatio,
            resolution: videoResolution,
          }
          
          // 根据不同模式设置不同的参数
          if (videoGenerateMode === 'image2video' || videoGenerateMode === 'firstlast2video') {
            // 图生视频/首尾帧：使用图片
            requestBody.imageUrls = imageFiles.slice(0, 2).map((f) => f.url).filter(Boolean)
          } else if (videoGenerateMode === 'reference2video') {
            // 参考图生视频：使用图片
            requestBody.imageUrls = imageFiles.slice(0, 3).map((f) => f.url).filter(Boolean)
          }
        } else if (isHappyHorseModel) {
          // HappyHorse 1.0 使用 happyhorse API
          apiEndpoint = '/api/ai/kie/happyhorse'

          requestBody = {
            prompt: message,
            model: "happyhorse",
            aspectRatio: videoAspectRatio,
            resolution: videoResolution,
            duration: videoDuration,
            videoGenerateMode: videoGenerateMode,
            audioSetting: audioSetting,
          }

          // 根据不同模式设置不同的参数
          if (videoGenerateMode === 'image2video') {
            // 图生视频：使用图片
            requestBody.imageUrls = imageFiles.slice(0, 1).map((f) => f.url).filter(Boolean)
          } else if (videoGenerateMode === 'reference2video') {
            // 参考生视频：使用图片（最多9张）
            requestBody.imageUrls = imageFiles.slice(0, 9).map((f) => f.url).filter(Boolean)
          } else if (videoGenerateMode === 'videoEdit') {
            // 视频编辑：使用视频文件
            if (videoFiles.length > 0) {
              requestBody.videoUrl = videoFiles[0]?.url
            }
            // 可选：使用图片作为参考图
            if (imageFiles.length > 0) {
              requestBody.referenceImage = imageFiles.slice(0, 5).map((f) => f.url).filter(Boolean)
            }
          }
        } else if (selectedVideoModel === "happyhorse11") {
          // HappyHorse 1.1 使用 happyhorse11 API
          apiEndpoint = '/api/ai/kie/happyhorse11'

          requestBody = {
            prompt: message,
            model: "happyhorse11",
            aspectRatio: videoAspectRatio,
            resolution: videoResolution,
            duration: videoDuration,
            videoGenerateMode: videoGenerateMode,
          }

          // 根据不同模式设置不同的参数
          if (videoGenerateMode === 'image2video') {
            // 图生视频：使用第一张图片
            requestBody.imageUrls = imageFiles.slice(0, 1).map((f) => f.url).filter(Boolean)
          } else if (videoGenerateMode === 'reference2video') {
            // 参考生视频：使用图片（最多9张）
            requestBody.referenceImage = imageFiles.slice(0, 9).map((f) => f.url).filter(Boolean)
          }
        } else if (selectedVideoModel === "klingV3Turbo") {
          // Kling V3 Turbo 使用 kling-v3-turbo API
          apiEndpoint = '/api/ai/kie/kling-v3-turbo'

          requestBody = {
            prompt: message,
            model: "klingV3Turbo",
            aspectRatio: videoAspectRatio,
            resolution: videoResolution,
            duration: videoDuration,
            videoGenerateMode: videoGenerateMode,
          }

          // 根据不同模式设置不同的参数
          if (videoGenerateMode === 'image2video') {
            // 图生视频：使用第一张图片
            requestBody.imageUrls = imageFiles.slice(0, 1).map((f) => f.url).filter(Boolean)
          }
        } else if (isWanModel) {
          // Wan 2.7 使用 wan API
          apiEndpoint = '/api/ai/kie/wan'

          requestBody = {
            prompt: message,
            model: "wan27",
            aspectRatio: videoAspectRatio,
            resolution: videoResolution,
            duration: videoDuration,
            videoGenerateMode: videoGenerateMode,
          }

          // 根据不同模式设置不同的参数
          if (videoGenerateMode === 'image2video') {
            // 图生视频：使用第一张图片作为首帧
            if (imageFiles.length > 0) {
              requestBody.firstFrameUrl = imageFiles[0]?.url
            }
          } else if (videoGenerateMode === 'firstlast2video') {
            // 首尾帧视频：使用前两张图片
            requestBody.firstFrameUrl = imageFiles[0]?.url
            requestBody.lastFrameUrl = imageFiles[1]?.url
          } else if (videoGenerateMode === 'reference2video') {
            // 参考生视频：使用图片/视频
            const wanImageUrls = imageFiles.slice(0, 5).map((f) => f.url).filter(Boolean)
            const wanVideoUrls = videoFiles.slice(0, 5).map((f) => f.url).filter(Boolean)
            if (wanImageUrls.length > 0) {
              requestBody.referenceImage = wanImageUrls
            }
            if (wanVideoUrls.length > 0) {
              requestBody.referenceVideo = wanVideoUrls
            }
          } else if (videoGenerateMode === 'videoEdit') {
            // Wan 视频编辑：使用视频文件作为待编辑视频
            if (videoFiles.length > 0) {
              requestBody.videoUrl = videoFiles[0]?.url
            }
            // 可选：使用图片作为参考图
            if (imageFiles.length > 0) {
              requestBody.referenceImage = imageFiles[0]?.url
            }
          }
        } else if (selectedVideoModel === "kling30") {
          // Kling 3.0 使用 kling30 API
          apiEndpoint = '/api/ai/kie/kling30'

          // Kling 3.0 分辨率映射: Standard/std, Pro/pro, 4K/4K
          const klingMode = videoResolution

          requestBody = {
            prompt: message,
            model: "kling30",
            aspectRatio: videoAspectRatio,
            mode: klingMode,
            duration: videoDuration,
            videoGenerateMode: videoGenerateMode,
            audioSetting: audioSetting,
          }

          // Kling 3.0 只支持单镜头: text2video, image2video, firstlast2video
          if (videoGenerateMode === 'image2video') {
            // 图生视频：使用第一张图片
            requestBody.imageUrls = imageFiles.slice(0, 1).map((f) => f.url).filter(Boolean)
          } else if (videoGenerateMode === 'firstlast2video') {
            // 首尾帧视频：使用前两张图片
            if (imageFiles.length >= 2) {
              requestBody.imageUrls = [imageFiles[0]?.url, imageFiles[1]?.url]
            } else if (imageFiles.length === 1) {
              requestBody.imageUrls = [imageFiles[0]?.url]
            }
          }
        } else if (selectedVideoModel === "geminiOmniVideo") {
          // Gemini Omni Video 使用专门的 API
          apiEndpoint = '/api/ai/kie/gemini-omni-video'

          requestBody = {
            prompt: message,
            model: "gemini-omni-video",
            aspectRatio: videoAspectRatio,
            resolution: videoResolution,
            duration: videoDuration,
            imageUrls: [],
            videoList: [],
          }

          // Gemini Omni Video 支持: text2video, image2video, reference2video
          // 注意：videoEdit 模式不支持（已在模型切换时重置）
          if (videoGenerateMode === 'image2video') {
            // 图生视频：使用第一张图片
            requestBody.imageUrls = imageFiles.slice(0, 7).map((f) => f.url).filter(Boolean)
          } else if (videoGenerateMode === 'reference2video') {
            // 参考生视频：使用图片（最多7张）和视频（最多1个，10秒）
            requestBody.imageUrls = imageFiles.slice(0, 7).map((f) => f.url).filter(Boolean)
            if (videoFiles.length > 0 && videoUrl) {
              // 视频片段：start 和 ends 参数需要从上传文件中获取，这里使用默认值
              requestBody.videoList = [{
                url: videoUrl,
                start: 0,
                ends: 10,
              }]
            }
          }
          // text2video 不需要额外参数
        } else if (selectedVideoModel === "minimaxH3") {
          // MiniMax H3 使用专门的 minimax-h3 API
          apiEndpoint = '/api/ai/kie/minimax-h3'

          requestBody = {
            prompt: message,
            aspectRatio: videoAspectRatio,
            duration: videoDuration,
            videoGenerateMode: videoGenerateMode,
          }

          // MiniMax H3 支持: text2video, image2video, firstlast2video, reference2video
          if (videoGenerateMode === 'image2video') {
            // 图生视频：使用图片（最多1张）
            requestBody.imageUrls = imageFiles.slice(0, 1).map((f) => f.url).filter(Boolean)
          } else if (videoGenerateMode === 'firstlast2video') {
            // 首尾帧视频：使用前两张图片（复用 image-to-video 端点）
            requestBody.referenceImageUrls = imageFiles.slice(0, 2).map((f) => f.url).filter(Boolean)
          } else if (videoGenerateMode === 'reference2video') {
            // 参考生视频：使用图片（最多9张）和视频（最多3个）
            requestBody.referenceImageUrls = imageFiles.slice(0, 9).map((f) => f.url).filter(Boolean)
            requestBody.referenceVideoUrls = videoFiles.slice(0, 3).map((f) => f.url).filter(Boolean)
            requestBody.referenceAudioUrls = audioFiles.slice(0, 3).map((f) => f.url).filter(Boolean)
          }
          // text2video 不需要额外参数
        } else {
          // Seedance 使用原有逻辑
          if (videoGenerateMode === 'text2video') {
            // 文生视频：不需要额外参数
          } else if (videoGenerateMode === 'image2video') {
            // 图生视频：使用第一张图片作为首帧
            apiBody.videoUrl = imageFiles[0]?.url
          } else if (videoGenerateMode === 'firstlast2video') {
            // 首尾帧视频：使用前两张图片
            apiBody.firstFrameUrl = imageFiles[0]?.url
            apiBody.lastFrameUrl = imageFiles[1]?.url
          } else if (videoGenerateMode === 'reference2video') {
            // Seedance: 多模态参考生视频，支持图片/视频/音频任意组合
            if (imageFiles.length > 0) {
              apiBody.referenceImageUrls = imageFiles.slice(0, 9).map((f) => f.url).filter(Boolean)
            }
            if (videoFiles.length > 0) {
              apiBody.referenceVideoUrls = [videoUrl].filter(Boolean)
            }
            const audioFiles = uploadingItems.filter((item) => item.fileType === 'audio')
            if (audioFiles.length > 0) {
              apiBody.referenceAudioUrls = audioFiles.slice(0, 3).map((f) => f.url).filter(Boolean)
            }
          }
        }

        const response = await fetch(apiEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        })

        const data = await response.json()

        if (!response.ok) {
          setShowResults(false)
          if (response.status === 402) {
            toast({
              title: t("operate.insufficientPoints"),
              description: t("operate.insufficientPointsDesc"),
              variant: "destructive",
            })
            setPurchaseReason('points')
            setShowPurchaseDialog(true)
          } else {
            toast({
              title: t("operate.error"),
              description: data.error || t("operate.errorDesc"),
              variant: "destructive",
            })
          }
          setIsGenerating(false)
          return
        }

        // 视频编辑使用 webhook 模式，等待 Pusher 推送结果
        // 更新积分消耗信息
        if (data.pointsCost) {
          setPointsCost(data.pointsCost)
        }

        toast({
          title: "Video editing started",
          description: "Please wait while your video is being processed...",
        })
      } else {
        // 图片生成/编辑模式
        const endpoint = editMode ? '/api/ai/kie/edit' : '/api/ai/kie/generate'
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            prompt: message,
            imageUrls: imageUrls,
            aspectRatio: aspectRatio,
            resolution: duration,
            model: selectedModel,
            ...((selectedModel === "seedream5Lite" || selectedModel === "seedream5Pro") && { quality }),
          }),
        })

        const data = await response.json()

        if (!response.ok) {
          // 出错时隐藏结果区域
          setShowResults(false)
          if (response.status === 402) {
            toast({
              title: t("operate.insufficientPoints"),
              description: t("operate.insufficientPointsDesc"),
              variant: "destructive",
            })
            // 打开购买弹窗
            setPurchaseReason('points')
            setShowPurchaseDialog(true)
          } else {
            toast({
              title: t("operate.error"),
              description: data.error || t("operate.errorDesc"),
              variant: "destructive",
            })
          }
          setIsGenerating(false)
          return
        }

        // 判断是否是 Webhook 模式（API 立即返回，不等待图片生成）
        const isWebhookMode = data.mode === 'webhook' || !data.images

        if (!isWebhookMode) {
          // 同步模式：关闭 isGenerating（图片已返回）
          setIsGenerating(false)
          // 同步返回结果
          setGeneratedImages(data.images || [])
          setShowResults(true)

          // 更新积分消耗信息（如果API返回了新的值）
          if (data.pointsCost) {
            setPointsCost(data.pointsCost)
          }

          toast({
            title: t("operate.success"),
            description: t("operate.successDesc"),
          })
        }
        // Webhook 模式：保持 isGenerating(true)，等待 Pusher 推送结果
      }
    } catch (error) {
      console.error('API call error:', error)
      // 出错时隐藏结果区域
      setShowResults(false)
      setIsGenerating(false) // 错误时关闭生成状态
      toast({
        title: t("operate.error"),
        description: t("operate.errorDesc"),
        variant: "destructive",
      })
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  useEffect(() => {
    // 获取当前用户积分
    const fetchPoints = async () => {
      try {
        const res = await fetch("/api/user/points")
        if (!res.ok) return
        const json = await res.json()
        if (json?.success && json?.data?.points != null) {
          setCurrentPoints(Number(json.data.points))
        }
      } catch (err) {
        console.error("fetch points error:", err)
      }
    }

    if (status === "authenticated") {
      fetchPoints()

      // 监听 Pusher Webhook 结果推送
      const userId = session?.user?.id
      if (userId) {
        const pusher = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
          cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
        })

        const channel = pusher.subscribe(`user-${userId}`)
        channel.bind('kie-result', (data: any) => {
          // 处理失败情况
          if (data.status === 'error') {
            setIsGenerating(false)
            setShowResults(false)
            toast({
              title: t("operate.error"),
              description: data.errorMessage || t("operate.errorDesc"),
              variant: "destructive",
            })
            return
          }

          // 处理成功情况（图片或视频）
          // Veo webhook 使用 videoUrl，Seedance/video webhook 使用 resultUrl
          const resultUrl = data.videoUrl || data.resultUrl
          if (resultUrl) {
            // 根据是否为视频设置结果
            if (data.isVideo) {
              // 视频结果
              setGeneratedImages([{ url: resultUrl, isVideo: true }])
            } else {
              // 图片结果
              setGeneratedImages([{ url: resultUrl }])
            }
            setShowResults(true)
            setIsGenerating(false)
            toast({
              title: data.isVideo ? t("operate.videoSuccess") : t("operate.success"),
              description: data.isVideo ? t("operate.videoSuccessDesc") : t("operate.successDesc"),
            })
          }
        })

        return () => {
          channel.unbind_all()
          pusher.unsubscribe(`user-${userId}`)
        }
      }
    }
  }, [status, session, t])

  // 模型切换时重置默认质量
  useEffect(() => {
    if (selectedModel === "seedream5Lite" || selectedModel === "seedream5Pro") {
      setQuality("basic")
    }
  }, [selectedModel])

  // 切换到视频模式时重置生成模式
  useEffect(() => {
    if (contentType === "video") {
      setVideoGenerateMode("text2video")
    }
  }, [contentType])

  // 根据是否有参考视频和分辨率动态设置积分消耗
  useEffect(() => {
    let cost: number
    if (contentType === 'video') {
      // 视频生成模式：只有输入参考视频才用低价，其他都是高价
      const videoFiles = uploadingItems.filter((item) => item.fileType === 'video')
      const imageFiles = uploadingItems.filter((item) => item.fileType === 'image')
      const hasReferenceVideo = videoFiles.length > 0

      if (selectedVideoModel === "seedance25") {
        // Seedance 2.5: 不含视频=45/105, 含视频=30/65 (480p/720p)
        const effectiveResolution = videoResolution === "1080p" ? "720p" : videoResolution
        const pointsPerSecond = hasReferenceVideo
          ? (effectiveResolution === "480p" ? 30 : 65)
          : (effectiveResolution === "480p" ? 45 : 105)
        cost = pointsPerSecond * videoDuration
      } else if (selectedVideoModel === "seedance2fast") {
        // Seedance 2.0 Fast: 有视频=15/35, 无视频=25/55 (480p/720p)
        const effectiveResolution = videoResolution === "1080p" ? "720p" : videoResolution
        const pointsPerSecond = hasReferenceVideo
          ? (effectiveResolution === "480p" ? 15 : 35)
          : (effectiveResolution === "480p" ? 25 : 55)
        cost = pointsPerSecond * videoDuration
      } else if (selectedVideoModel === "seedance2mini") {
        // Seedance 2.0 Mini: 有视频=10/20, 无视频=15/35 (480p/720p)
        const effectiveResolution = videoResolution === "1080p" ? "720p" : videoResolution
        const pointsPerSecond = hasReferenceVideo
          ? (effectiveResolution === "480p" ? 10 : 20)
          : (effectiveResolution === "480p" ? 15 : 35)
        cost = pointsPerSecond * videoDuration
      } else if (selectedVideoModel === "wan27") {
        // Wan 2.7: 720p=25积分/s, 1080p=40积分/s
        const pointsPerSecond = videoResolution === "1080p" ? 40 : 25
        cost = pointsPerSecond * videoDuration
      } else if (selectedVideoModel === "happyhorse") {
        // HappyHorse 1.0: 720p=45积分/s, 1080p=80积分/s
        const pointsPerSecond = videoResolution === "1080p" ? 80 : 45
        cost = pointsPerSecond * videoDuration
      } else if (selectedVideoModel === "happyhorse11") {
        // HappyHorse 1.1: 720p=35积分/s, 1080p=45积分/s
        const pointsPerSecond = videoResolution === "1080p" ? 45 : 35
        cost = pointsPerSecond * videoDuration
      } else if (selectedVideoModel === "klingV3Turbo") {
        // Kling V3 Turbo: 720p=25积分/s, 1080p=40积分/s
        const pointsPerSecond = videoResolution === "1080p" ? 40 : 25
        cost = pointsPerSecond * videoDuration
      } else if (selectedVideoModel === "kling30") {
        // Kling 3.0: Standard=25/35, Pro=30/45, 4K=110 (积分/s, 有/无音频)
        const hasAudio = audioSetting === "on"
        if (videoResolution === "4K") {
          cost = 110 * videoDuration
        } else if (videoResolution === "Pro") {
          // Pro 模式
          cost = hasAudio ? 45 * videoDuration : 30 * videoDuration
        } else {
          // Standard 模式
          cost = hasAudio ? 35 * videoDuration : 25 * videoDuration
        }
      } else if (selectedVideoModel.startsWith("veo")) {
        // Veo 3.1 系列: 固定价格，不按分辨率
        // Veo 3.1 Lite: 50
        // Veo 3.1 Fast: 100
        // Veo 3.1 Quality: 400
        if (selectedVideoModel === "veo3") {
          cost = 400
        } else if (selectedVideoModel === "veo3fast") {
          cost = 100
        } else {
          cost = 50
        }
      } else if (selectedVideoModel === "geminiOmniVideo") {
        // Gemini Omni Video 积分计算
        // 有视频输入: 720p/1080p = 135积分, 4K = 200积分
        // 无视频输入: 720p/1080p - 4s=50, 6s=65, 8s=80, 10s=95
        // 无视频输入: 4K - 4s=115, 6s=130, 8s=150, 10s=165
        if (hasReferenceVideo) {
          cost = videoResolution === "4K" ? 200 : 135
        } else {
          if (videoResolution === "4K") {
            const costMap4k: Record<number, number> = { 4: 115, 6: 130, 8: 150, 10: 165 }
            cost = costMap4k[videoDuration] || 165
          } else {
            const costMap: Record<number, number> = { 4: 50, 6: 65, 8: 80, 10: 95 }
            cost = costMap[videoDuration] || 95
          }
        }
      } else if (selectedVideoModel === "minimaxH3") {
        // MiniMax H3: 768p=30积分/s, 2K=50积分/s; 参考生视频 5+ 图片 +15 积分/张
        const pointsPerSecond = videoResolution === "768p" ? 30 : 50
        cost = pointsPerSecond * videoDuration
        if (videoGenerateMode === "reference2video" && imageFiles.length > 5) {
          cost += 15 * (imageFiles.length - 5)
        }
      } else {
        // Seedance 2.0: 有视频=20/40/100, 无视频=30/70/170 (480p/720p/1080p)
        const pointsPerSecond = hasReferenceVideo
          ? (videoResolution === "480p" ? 20 : videoResolution === "720p" ? 40 : 100)
          : (videoResolution === "480p" ? 30 : videoResolution === "720p" ? 70 : 170)
        cost = pointsPerSecond * videoDuration
      }
    } else if (selectedModel === "gptImage2") {
      const pointsMap2: { "1K": number; "2K": number; "4K": number } = { "1K": 5, "2K": 8, "4K": 15 }
      cost = pointsMap2[duration as keyof typeof pointsMap2] || 8
    } else if (selectedModel === "seedream5Lite") {
      cost = 9
    } else if (selectedModel === "seedream5Pro") {
      // Seedream 5.0 Pro: basic=10积分, high=25积分
      cost = quality === "high" ? 25 : 10
    } else if (selectedModel === "nanoBanana2Lite") {
      // Nano Banana 2 Lite: 1K=6积分
      cost = 6
    } else {
      const pointsMap: { [key: string]: { "1K": number; "2K": number; "4K": number } } = {
        nanoBananaPro: { "1K": 15, "2K": 15, "4K": 30 },
        nanoBanana2: { "1K": 8, "2K": 15, "4K": 20 }
      }
      cost = pointsMap[selectedModel]?.[duration as keyof typeof pointsMap[typeof selectedModel]] || 15
    }
    setPointsCost(cost)
  }, [contentType, duration, selectedModel, quality, videoResolution, videoDuration, uploadingItems, selectedVideoModel])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return
    // require authentication
    if (status !== "authenticated") {
      setIsSignInDialogOpen(true)
      return
    }
    // filter only supported mime types
    const validTypes = ["image/", "video/", "audio/"]
    const validFiles = files.filter((f) => typeof f.type === "string" && validTypes.some(t => f.type.startsWith(t)))
    const invalidCount = files.length - validFiles.length
    if (invalidCount > 0) {
      toast({
        title: t("operate.invalidImageFile") || "Only image, video and audio files are supported",
        variant: "destructive",
      })
    }
    if (validFiles.length === 0) return
    // filter by subscription max size
    const tooLarge = validFiles.filter((f) => f.size > maxUploadBytes)
    const allowed = validFiles.filter((f) => f.size <= maxUploadBytes)
    if (tooLarge.length > 0) {
      // Prompt upgrade dialog for quota limit
      setPurchaseReason('quota')
      setShowPurchaseDialog(true)
      return
    }
    if (allowed.length === 0) return

    // 分类文件
    const imageFiles = allowed.filter((f) => f.type.startsWith("image/"))
    const videoFiles = allowed.filter((f) => f.type.startsWith("video/"))
    const audioFiles = allowed.filter((f) => f.type.startsWith("audio/"))

    // keep local selected images for potential future use
    setSelectedImages((prev) => [...prev, ...imageFiles])

    const uploadFile = async (file: File, subDir: string) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      const localUrl = URL.createObjectURL(file)
      const fileType: "image" | "video" | "audio" = file.type.startsWith("video/") ? "video" : file.type.startsWith("audio/") ? "audio" : "image"

      setUploadingItems((prev) => [...prev, { id, filename: file.name, localUrl, status: "uploading", fileType, size: file.size }])

      try {
        const reader = new FileReader()
        const dataUrl: string = await new Promise((resolve, reject) => {
          reader.onerror = () => reject(new Error("File read error"))
          reader.onload = () => resolve(String(reader.result))
          reader.readAsDataURL(file)
        })
        const match = dataUrl.match(/^data:(.+);base64,(.+)$/)
        if (!match) throw new Error("Invalid file data")
        const contentType = match[1]
        const base64 = match[2]

        const res = await fetch("/api/upload", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            filename: file.name,
            contentType,
            data: base64,
            subDir,
          }),
        })
        if (!res.ok) {
          console.error("Upload failed", await res.text())
          setUploadingItems((prev) => prev.map((it) => (it.id === id ? { ...it, status: "error" } : it)))
        } else {
          const json = await res.json()
          if (json?.url) {
            setUploadingItems((prev) =>
              prev.map((it) => (it.id === id ? { ...it, status: "done", url: json.url } : it))
            )
            setImageUrls((prev) => [...prev, json.url])
            try {
              URL.revokeObjectURL(localUrl)
            } catch {}
          } else {
            setUploadingItems((prev) => prev.map((it) => (it.id === id ? { ...it, status: "error" } : it)))
          }
        }
      } catch (err) {
        console.error("Upload error:", err)
        setUploadingItems((prev) => prev.map((it) => (it.id === id ? { ...it, status: "error" } : it)))
      }
    }

    // 上传图片
    imageFiles.forEach((file) => {
      onImageUpload?.(file)
      uploadFile(file, "images")
    })
    // 上传视频
    videoFiles.forEach((file) => {
      uploadFile(file, "videos")
    })
    // 上传音频
    audioFiles.forEach((file) => {
      uploadFile(file, "audios")
    })

    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
    // close upload popover after selecting files
    setShowUploadPopover(false)
  }

  const removeImage = (index: number) => {
    setSelectedImages(selectedImages.filter((_, i) => i !== index))
  }

  const addImageUrl = async (url: string) => {
    if (url.trim() && !imageUrls.includes(url.trim())) {
      const newUrl = url.trim()
      setImageUrls([...imageUrls, newUrl])

      // 如果是视频链接
      if (newUrl.match(/\.(mp4|webm|mov|avi)($|\?)/i) || newUrl.includes('video')) {
        const videoFile = {
          url: newUrl,
          filename: newUrl.split('/').pop() || 'video.mp4',
          localUrl: newUrl,
          fileType: 'video' as const,
          status: 'done' as const,
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        }

        setUploadingItems((prev) => [...prev, videoFile])
      }
    }
  }

  const removeImageUrl = (index: number) => {
    setImageUrls(imageUrls.filter((_, i) => i !== index))
  }

  const handleAddLink = () => {
    if (linkInput.trim()) {
      addImageUrl(linkInput.trim())
      setLinkInput("")
      setShowLinkInput(false)
    }
  }

  const handleLinkInputKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault()
      handleAddLink()
    }
  }

  // 判断文件类型
  const getFileType = (url: string): "image" | "video" | "audio" => {
    const ext = url.split(".").pop()?.toLowerCase().split("?")[0] || ""
    const imageExts = ["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg", "avif", "apng"]
    const videoExts = ["mp4", "webm", "mov", "avi", "mkv", "flv", "wmv", "m4v", "3gp"]
    const audioExts = ["mp3", "wav", "ogg", "flac", "aac", "m4a", "wma", "aiff"]
    if (imageExts.includes(ext)) return "image"
    if (videoExts.includes(ext)) return "video"
    if (audioExts.includes(ext)) return "audio"
    // 尝试从 URL 推断
    if (url.includes("/videos/")) return "video"
    if (url.includes("/audios/")) return "audio"
    return "image"
  }

  const [previewIndex, setPreviewIndex] = useState<number | null>(null)
  const [showLinkInput, setShowLinkInput] = useState(false)
  const [linkInput, setLinkInput] = useState("")
  const [showAspectRatioPopover, setShowAspectRatioPopover] = useState(false)
  const [showContentTypePopover, setShowContentTypePopover] = useState(false)

  const openPreviewAt = (index: number) => {
    if (index < 0 || index >= imageUrls.length) return
    if (previewImage) {
      // no object URL to revoke when previewing remote images, just clear state
      setPreviewImage(null)
    }
    const url = imageUrls[index]
    setPreviewImage(url)
    setPreviewIndex(index)
    if (typeof window !== "undefined") {
      document.body.classList.add("preview-open")
    }
  }

  const openPreview = (url: string) => {
    const idx = imageUrls.findIndex((u) => u === url)
    if (idx !== -1) openPreviewAt(idx)
  }

  const closePreview = () => {
    if (previewImage) {
      URL.revokeObjectURL(previewImage)
      setPreviewImage(null)
      if (typeof window !== "undefined") {
        document.body.classList.remove("preview-open")
      }
    }
    setPreviewIndex(null)
  }

  const openGeneratedPreview = (imageUrl: string, index: number, isVideo: boolean = false) => {
    setGeneratedPreviewImage(imageUrl)
    setGeneratedPreviewIndex(index)
    setGeneratedPreviewIsVideo(isVideo)
    if (typeof window !== "undefined") {
      document.body.classList.add("preview-open")
    }
  }

  const closeGeneratedPreview = () => {
    setGeneratedPreviewImage(null)
    setGeneratedPreviewIndex(null)
    if (typeof window !== "undefined") {
      document.body.classList.remove("preview-open")
    }
  }

  const closeResults = () => {
    setShowResults(false)
    // 清空输入和上传的图片
    setMessage("")
    setSelectedImages([])
    setImageUrls([])
    setGeneratedImages([])
    setIsEditMode(false)
    // 重置 textarea 高度
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
    }
  }

  const showGeneratedPrev = () => {
    if (generatedPreviewIndex == null) return
    const prev = (generatedPreviewIndex - 1 + generatedImages.length) % generatedImages.length
    setGeneratedPreviewImage(generatedImages[prev].url)
    setGeneratedPreviewIndex(prev)
    setGeneratedPreviewIsVideo(!!generatedImages[prev].isVideo)
  }

  const showGeneratedNext = () => {
    if (generatedPreviewIndex == null) return
    const next = (generatedPreviewIndex + 1) % generatedImages.length
    setGeneratedPreviewImage(generatedImages[next].url)
    setGeneratedPreviewIndex(next)
    setGeneratedPreviewIsVideo(!!generatedImages[next].isVideo)
  }

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items
    if (!items) return

    const files: File[] = []
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      const file = item.getAsFile()
      if (file) files.push(file)
    }
    if (files.length === 0) return

    // filter only image mime types
    const imageFiles = files.filter((f) => typeof f.type === "string" && f.type.startsWith("image/"))
    const invalidCount = files.length - imageFiles.length
    if (invalidCount > 0) {
      toast({
        title: t("operate.invalidImageFile") || "Only image files are supported",
        variant: "destructive",
      })
    }
    if (imageFiles.length === 0) return

    // prevent default paste behavior when images are present
    e.preventDefault()

    // require authentication for paste uploads
    if (status !== "authenticated") {
      setIsSignInDialogOpen(true)
      return
    }

    // filter by subscription max size
    const tooLarge = imageFiles.filter((f) => f.size > maxUploadBytes)
    const allowed = imageFiles.filter((f) => f.size <= maxUploadBytes)
    if (tooLarge.length > 0) {
      // Prompt upgrade dialog same as insufficient points flow
      setShowPurchaseDialog(true)
      return
    }
    if (allowed.length === 0) return

    // reuse the same upload workflow as file select
    setSelectedImages((prev) => [...prev, ...allowed])
    allowed.forEach((file) => {
      onImageUpload?.(file)
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      const localUrl = URL.createObjectURL(file)
      const fileType: "image" | "video" | "audio" = file.type.startsWith("video/") ? "video" : file.type.startsWith("audio/") ? "audio" : "image"
      setUploadingItems((prev) => [...prev, { id, filename: file.name, localUrl, status: "uploading", fileType, size: file.size }])

      ;(async () => {
        try {
          const reader = new FileReader()
          const dataUrl: string = await new Promise((resolve, reject) => {
            reader.onerror = () => reject(new Error("File read error"))
            reader.onload = () => resolve(String(reader.result))
            reader.readAsDataURL(file)
          })
          const match = dataUrl.match(/^data:(.+);base64,(.+)$/)
          if (!match) throw new Error("Invalid file data")
          const contentType = match[1]
          const base64 = match[2]

          const res = await fetch("/api/upload", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              filename: file.name,
              contentType,
              data: base64,
            }),
          })
          if (!res.ok) {
            console.error("Upload failed", await res.text())
            setUploadingItems((prev) => prev.map((it) => (it.id === id ? { ...it, status: "error" } : it)))
          } else {
            const json = await res.json()
            if (json?.url) {
              setUploadingItems((prev) =>
                prev.map((it) => (it.id === id ? { ...it, status: "done", url: json.url } : it))
              )
              setImageUrls((prev) => [...prev, json.url])
              try {
                URL.revokeObjectURL(localUrl)
              } catch {}
            } else {
              setUploadingItems((prev) => prev.map((it) => (it.id === id ? { ...it, status: "error" } : it)))
            }
          }
        } catch (err) {
          console.error("Upload error:", err)
          setUploadingItems((prev) => prev.map((it) => (it.id === id ? { ...it, status: "error" } : it)))
        }
      })()
    })
  }

  const characterCount = message.length
  const isNearLimit = characterCount > MAX_CHARACTERS * 0.9
  const touchStartX = useRef<number | null>(null)
  const touchEndX = useRef<number | null>(null)

  const showPrev = (e?: React.MouseEvent | TouchEvent) => {
    e?.stopPropagation()
    if (previewIndex == null) return
    const prev = (previewIndex - 1 + imageUrls.length) % imageUrls.length
    const url = imageUrls[prev]
    setPreviewImage(url)
    setPreviewIndex(prev)
  }

  const showNext = (e?: React.MouseEvent | TouchEvent) => {
    e?.stopPropagation()
    if (previewIndex == null) return
    const next = (previewIndex + 1) % imageUrls.length
    const url = imageUrls[next]
    setPreviewImage(url)
    setPreviewIndex(next)
  }

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
  }

  const onTouchEnd = (e: React.TouchEvent) => {
    touchEndX.current = e.changedTouches[0].clientX
    if (touchStartX.current != null && touchEndX.current != null) {
      const dx = touchEndX.current - touchStartX.current
      if (Math.abs(dx) > 50) {
        if (dx > 0) showPrev()
        else showNext()
      }
    }
    touchStartX.current = null
    touchEndX.current = null
  }

  return (
    <div className="w-full h-full flex items-center justify-center p-4 md:p-8 pb-16">
      <div className="w-full max-w-2xl px-2 md:px-0">
      <div className="relative">
        <div
            className={cn(
                "rounded-[28px]",
                "bg-background/95 backdrop-blur-md border border-border",
                "px-6 py-8",
                "focus-within:ring-2 focus-within:ring-primary/20",
                "transition-all duration-300",
                "shadow-2xl shadow-primary/5",
              )}
        >
              {/* 右上角积分预计 */}
              <div className="absolute top-2 right-3 flex items-center gap-1 px-2.5 py-1 bg-primary/10 border border-primary/20 rounded-full text-xs text-primary">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                </svg>
                <span>{pointsCost}</span>
              </div>
              {(uploadingItems.length > 0 || imageUrls.length > 0) && (
                <div className="mb-3 flex flex-wrap gap-2">
                  {/* 上传中的缩略图 */}
                  {uploadingItems.filter((it) => it.status !== "done").map((it) => {
                    return (
                      <div key={`upload-${it.id}`} className="relative w-20 h-20 rounded-lg border bg-muted overflow-hidden group cursor-pointer" onClick={() => it.url ? openPreview(it.url) : setPreviewImage(it.localUrl)}>
                        {it.fileType === "image" ? (
                          <img src={it.url || it.localUrl || "/placeholder.svg"} alt={it.filename} className="w-full h-full object-cover transition-transform group-hover:scale-105 opacity-90" />
                        ) : it.fileType === "video" ? (
                          <>
                            <video src={it.url || it.localUrl} className="w-full h-full object-cover opacity-60" preload="metadata" />
                            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                              <Play className="w-8 h-8 text-white" />
                            </div>
                          </>
                        ) : it.fileType === "audio" ? (
                          <>
                            <div className="w-full h-full flex items-center justify-center bg-muted opacity-60">
                              <Music className="w-8 h-8 text-muted-foreground" />
                            </div>
                            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                              <Play className="w-8 h-8 text-white" />
                            </div>
                          </>
                        ) : (
                          <img src={it.url || it.localUrl || "/placeholder.svg"} alt={it.filename} className="w-full h-full object-cover opacity-60" />
                        )}
                        {it.status === "uploading" && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                            <Loader2 className="w-5 h-5 animate-spin text-white" />
                          </div>
                        )}
                        {it.status === "error" && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-white text-xs">
                            {t("operate.uploadError") ?? "Upload failed"}
                          </div>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setUploadingItems((prev) => prev.filter((x) => x.id !== it.id))
                            if (it.url) {
                              setImageUrls((prev) => prev.filter((u) => u !== it.url))
                            }
                          }}
                          className="absolute top-1 right-1 w-5 h-5 bg-background/80 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive hover:text-destructive-foreground"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    )
                  })}

                  {/* 远端已上传缩略图 */}
                  {imageUrls.map((url, index) => {
                    const fileType = getFileType(url)
                    return (
                      <div key={`url-thumb-${index}`} className="relative w-20 h-20 rounded-lg border bg-muted overflow-hidden group cursor-pointer" onClick={() => openPreviewAt(index)}>
                        {fileType === "image" ? (
                          <img
                            src={url || "/placeholder.svg"}
                            alt={t("operate.preview", { index: index + 1 })}
                            className="w-full h-full object-cover transition-transform group-hover:scale-105"
                          />
                        ) : fileType === "video" ? (
                          <>
                            <video src={url} className="w-full h-full object-cover" preload="metadata" />
                            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                              <Play className="w-8 h-8 text-white" />
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="w-full h-full flex items-center justify-center bg-muted">
                              <Music className="w-8 h-8 text-muted-foreground" />
                            </div>
                            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                              <Play className="w-8 h-8 text-white" />
                            </div>
                          </>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            removeImageUrl(index)
                          }}
                          className="absolute top-1 right-1 w-5 h-5 bg-background/80 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive hover:text-destructive-foreground"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* 输入框 */}
              <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => {
              if (e.target.value.length <= MAX_CHARACTERS) {
                setMessage(e.target.value)
              }
            }}
            onKeyDown={handleKeyDown}
            placeholder={placeholderText}
            rows={1}
            disabled={isGenerating}
            className={cn(
              "w-full bg-transparent",
              "text-foreground placeholder:text-muted-foreground placeholder:text-sm",
              "resize-none outline-none",
              "text-base leading-7",
              "max-h-32 overflow-y-auto",
              "mb-4",
              isGenerating && "opacity-50 cursor-not-allowed",
            )}
            style={{
              minHeight: "48px",
              height: "auto",
            }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement
              target.style.height = "auto"
              target.style.height = target.scrollHeight + "px"
            }}
            onPaste={handlePaste}
              />

              {characterCount > 0 && (
                <div className="mb-3 flex justify-end">
                  <span
                    className={cn("text-xs transition-colors", isNearLimit ? "text-destructive" : "text-muted-foreground")}
                  >
                    {characterCount} / {MAX_CHARACTERS}
                  </span>
                </div>
              )}

              <div className="flex flex-row items-center gap-3 overflow-x-auto whitespace-nowrap">
                {/* 添加按钮菜单 */}
                <Popover open={showUploadPopover} onOpenChange={setShowUploadPopover}>
                  <PopoverTrigger asChild>
                    <button
                      className={cn(
                        "w-10 h-10 rounded-full flex-shrink-0",
                        "hover:bg-primary hover:shadow-lg hover:shadow-primary/20",
                        "transition-all duration-200",
                        "flex items-center justify-center"
                      )}
                      aria-label={t("operate.addImage")}
                    >
                      <Plus className="w-5 h-5 text-muted-foreground hover:text-white transition-colors" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent side="top" sideOffset={12} avoidCollisions={true} className="w-full md:w-56 p-3 bg-background border border-border shadow-xl" align="start">
                    <div className="text-xs text-muted-foreground mb-2 px-1 text-center">
                      {t("operate.uploadSizeInfo", { size: formatBytes(maxUploadBytes) })}
                    </div>
                    <div className="space-y-1">
                      <button
                        onClick={() => {
                          if (status !== "authenticated") {
                            setIsSignInDialogOpen(true)
                            return
                          }
                          fileInputRef.current?.click()
                          setShowUploadPopover(false)
                        }}
                        className="w-full flex items-center justify-center gap-2 px-3 py-1.5 text-sm rounded-full hover:bg-primary hover:text-primary-foreground border border-transparent hover:border-primary transition-all duration-200"
                      >
                        <FileUp className="w-4 h-4" />
                        {t("operate.uploadFile")}
                      </button>
                      <button
                        onClick={() => { setShowLinkInput(true); setShowUploadPopover(false) }}
                        className="w-full flex items-center justify-center gap-2 px-3 py-1.5 text-sm rounded-full hover:bg-primary hover:text-primary-foreground border border-transparent hover:border-primary transition-all duration-200"
                      >
                        <Link className="w-4 h-4" />
                        {t("operate.inputLink")}
                      </button>
                    </div>
                  </PopoverContent>
                </Popover>

                {/* 内容类型选择 */}
                <Popover>
                  <PopoverTrigger asChild>
                    <button className="h-9 px-3 rounded-full border border-border bg-background hover:bg-background/80 hover:border-primary/40 transition-all duration-200">
                      <div className="flex items-center gap-1.5">
                        {contentType === "image" ? <Image className="w-4 h-4" /> : <Video className="w-4 h-4" />}
                        <span className="hidden md:inline text-xs font-medium">{contentType === "image" ? t("operate.imageMode") : t("operate.videoMode")}</span>
                      </div>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent side="top" sideOffset={12} avoidCollisions={true} className="w-auto p-1.5 bg-secondary/80 backdrop-blur-sm border border-border shadow-xl" align="start">
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={() => setContentType("image")}
                        className={cn(
                          "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200",
                          contentType === "image"
                            ? "bg-primary text-primary-foreground"
                            : "hover:bg-primary/5"
                        )}
                      >
                        <Image className="w-4 h-4" />
                        {t("operate.imageMode")}
                      </button>
                      <button
                        onClick={() => setContentType("video")}
                        className={cn(
                          "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200",
                          contentType === "video"
                            ? "bg-primary text-primary-foreground"
                            : "hover:bg-primary/5"
                        )}
                      >
                        <Video className="w-4 h-4" />
                        {t("operate.videoMode")}
                      </button>
                    </div>
                  </PopoverContent>
                </Popover>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*,audio/*"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                />

                {/* 参数选择 */}
                {/* 设置按钮（合并比例和分辨率设置） */}
                <Popover open={showAspectRatioPopover} onOpenChange={setShowAspectRatioPopover}>
                  <PopoverTrigger asChild>
                    <button
                      className="w-10 h-10 md:w-auto md:h-9 px-0 md:px-3 rounded-full border border-border bg-background hover:bg-background/80 hover:border-primary/40 hover:shadow-md transition-all duration-200 flex items-center gap-1.5 flex-shrink-0 justify-center"
                      aria-label={t("operate.aspectRatio")}
                    >
                      <Settings2 className="w-4 h-4 text-primary" />
                      <span className="hidden md:inline text-sm font-medium text-center">
                        {                          contentType === "video" ? (
                            <>{selectedVideoModel === "happyhorse11" ? "HappyHorse 1.1" : selectedVideoModel === "wan27" ? "Wan 2.7" : selectedVideoModel === "kling30" ? "Kling 3.0" : selectedVideoModel === "klingV3Turbo" ? "Kling V3 Turbo" : selectedVideoModel === "seedance25" ? "Seedance 2.5" : selectedVideoModel === "seedance2fast" ? "Seedance 2.0 Fast" : selectedVideoModel === "seedance2mini" ? "Seedance 2.0 Mini" : selectedVideoModel === "seedance2" ? "Seedance 2.0" : selectedVideoModel === "veo3" ? "Veo 3.1 Quality" : selectedVideoModel === "veo3fast" ? "Veo 3.1 Fast" : selectedVideoModel === "veo3lite" ? "Veo 3.1 Lite" : selectedVideoModel === "geminiOmniVideo" ? "Gemini Omni" : selectedVideoModel === "minimaxH3" ? "MiniMax H3" : selectedVideoModel} · {videoAspectRatio} · {videoResolution}</>
                        ) : (
                          <>{selectedModel === "nanoBananaPro" ? "Nano Banana Pro" : selectedModel === "nanoBanana2" ? "Nano Banana 2" : selectedModel === "nanoBanana2Lite" ? "Nano Banana 2 Lite" : selectedModel === "gptImage2" ? "GPT Image 2" : selectedModel === "seedream5Pro" ? "Seedream 5.0 Pro" : "Seedream 5.0 Lite"} · {aspectRatio}{selectedModel === "nanoBanana2Lite" ? "" : ` · ${selectedModel === "seedream5Lite" || selectedModel === "seedream5Pro" ? quality : duration}`}</>
                        )}
                      </span>
                      <span className="md:hidden">
                        <Settings2 className="w-4 h-4 text-primary" />
                      </span>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent side="top" sideOffset={8} avoidCollisions={true} className="w-72 p-3 bg-background border border-border shadow-xl h-[400px] overflow-y-auto" align="start">
                    <div className="space-y-3">
                      {/* 模型选择 - 仅图片模式显示 */}
                      {contentType === "image" && (
                      <div className="space-y-2">
                        <div className="text-xs font-medium text-muted-foreground px-1">{t("operate.modelLabel")}</div>
                        <div className="flex flex-col gap-1.5">
                          {[
                            { key: "nanoBananaPro", label: "Nano Banana Pro" },
                            { key: "nanoBanana2", label: "Nano Banana 2" },
                            { key: "nanoBanana2Lite", label: "Nano Banana 2 Lite" },
                            { key: "gptImage2", label: "GPT Image 2" },
                            { key: "seedream5Lite", label: "Seedream 5.0 Lite" },
                            { key: "seedream5Pro", label: "Seedream 5.0 Pro" }
                          ].map((model) => (
                            <button
                              key={model.key}
                              onClick={() => setSelectedModel(model.key)}
                              className={cn(
                                "px-3 py-1.5 text-xs rounded-full border transition-all duration-200",
                                selectedModel === model.key
                                  ? "bg-primary text-primary-foreground border-primary"
                                  : "border-border hover:border-primary/40 hover:bg-primary/5"
                              )}
                            >
                              {model.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      )}

                      {/* 图片模型提示 */}
                      {contentType === "image" && (
                        <div className="text-xs text-muted-foreground px-1 leading-relaxed">
                          {t(`operate.imageModelHint.${selectedModel}`)}
                        </div>
                      )}

                      {/* 比例设置 - 仅图片模式显示 */}
                      {contentType === "image" && (
                      <div className="space-y-2">
                        <div className="text-xs font-medium text-muted-foreground px-1">{t("operate.aspectRatio")}</div>
                        <div className="flex flex-wrap gap-1.5">
                          {(selectedModel === "seedream5Lite" || selectedModel === "seedream5Pro"
                            ? ["1:1", "4:3", "3:4", "16:9", "9:16", "2:3", "3:2", "21:9"]
                            : selectedModel === "nanoBanana2Lite"
                            ? ["1:1", "1:4", "1:8", "2:3", "3:2", "3:4", "4:1", "4:3", "4:5", "5:4", "8:1", "9:16", "16:9", "21:9", "auto"]
                            : ["1:1", "2:3", "3:2", "4:3", "4:5", "9:16", "16:9"]).map((r) => (
                            <button
                              key={r}
                              onClick={() => setAspectRatio(r)}
                              className={cn(
                                "px-2.5 py-1 text-xs rounded-full border transition-all duration-200",
                                aspectRatio === r
                                  ? "bg-primary text-primary-foreground border-primary"
                                  : "border-border hover:border-primary/40 hover:bg-primary/5"
                              )}
                            >
                              {r}
                            </button>
                          ))}
                        </div>
                      </div>
                      )}

                      {/* 分辨率/质量设置 - 仅图片模式显示 */}
                      {contentType === "image" && (selectedModel === "seedream5Lite" || selectedModel === "seedream5Pro" ? (
                      <div className="space-y-2">
                        <div className="text-xs font-medium text-muted-foreground px-1">{t("operate.quality")}</div>
                        <div className="flex flex-wrap gap-1.5">
                          {["basic", "high"].map((q) => (
                            <button
                              key={q}
                              onClick={() => setQuality(q)}
                              className={cn(
                                "px-2.5 py-1 text-xs rounded-full border transition-all duration-200",
                                quality === q
                                  ? "bg-primary text-primary-foreground border-primary"
                                  : "border-border hover:border-primary/40 hover:bg-primary/5"
                              )}
                            >
                              {q}
                            </button>
                          ))}
                        </div>
                      </div>
                      ) : selectedModel === "nanoBanana2Lite" ? null : (
                      <div className="space-y-2">
                        <div className="text-xs font-medium text-muted-foreground px-1">{t("operate.resolution")}</div>
                        <div className="flex flex-wrap gap-1.5">
                          {["1K", "2K", "4K"].map((r) => (
                            <button
                              key={r}
                              onClick={() => setDuration(r)}
                              className={cn(
                                "px-2.5 py-1 text-xs rounded-full border transition-all duration-200",
                                duration === r
                                  ? "bg-primary text-primary-foreground border-primary"
                                  : "border-border hover:border-primary/40 hover:bg-primary/5"
                              )}
                            >
                              {r}
                            </button>
                          ))}
                        </div>
                      </div>
                      ))}

                      {/* 视频模式设置 */}
                      {contentType === "video" && (
                      <>
                        {/* 视频模型选择 */}
                        <div className="space-y-2">
                          <div className="text-xs font-medium text-muted-foreground px-1">{t("operate.modelLabel")}</div>
                          <div className="flex flex-col gap-1.5">
                            {[
                              { key: "seedance25", label: "Seedance 2.5" },
                              { key: "seedance2", label: "Seedance 2.0" },
                              { key: "seedance2fast", label: "Seedance 2.0 Fast" },
                              { key: "seedance2mini", label: "Seedance 2.0 Mini" },
                              { key: "kling30", label: "Kling 3.0" },
                              { key: "klingV3Turbo", label: "Kling V3 Turbo" },
                              { key: "veo3", label: "Veo 3.1 Quality" },
                              { key: "veo3fast", label: "Veo 3.1 Fast" },
                              { key: "veo3lite", label: "Veo 3.1 Lite" },
                              { key: "geminiOmniVideo", label: "Gemini Omni" },
                              { key: "wan27", label: "Wan 2.7" },
                              { key: "happyhorse", label: "HappyHorse 1.0" },
                              { key: "happyhorse11", label: "HappyHorse 1.1" },
                              { key: "minimaxH3", label: "MiniMax H3" },
                            ].map((model) => (
                              <button
                                key={model.key}
                                onClick={() => {
                                  setSelectedVideoModel(model.key)
                                  // 如果当前参数不在新模型的可用范围内，重置为默认值
                                  if (model.key === "seedance25") {
                                    // Seedance 2.5: 比例支持 "adaptive"，分辨率支持 "480p", "720p"，时长 4-30
                                    if (!["16:9", "9:16", "1:1", "4:3", "3:4", "21:9", "adaptive"].includes(videoAspectRatio)) {
                                      setVideoAspectRatio("16:9")
                                    }
                                    if (!["480p", "720p"].includes(videoResolution)) {
                                      setVideoResolution("720p")
                                    }
                                    if (videoDuration < 4 || videoDuration > 30) {
                                      setVideoDuration(5)
                                    }
                                  } else if (model.key === "seedance2fast") {
                                    // Seedance 2.0 Fast: 比例支持 "adaptive"，分辨率支持 "480p", "720p"，时长 4-15
                                    if (!["16:9", "9:16", "1:1", "4:3", "3:4", "21:9", "adaptive"].includes(videoAspectRatio)) {
                                      setVideoAspectRatio("16:9")
                                    }
                                    if (!["480p", "720p"].includes(videoResolution)) {
                                      setVideoResolution("720p")
                                    }
                                    if (videoDuration < 4 || videoDuration > 15) {
                                      setVideoDuration(5)
                                    }
                                  } else if (model.key === "seedance2mini") {
                                    // Seedance 2.0 Mini: 比例支持 16:9/9:16/1:1/4:3/3:4/21:9/adaptive；分辨率 480p/720p；时长 4-15s
                                    if (!["16:9", "9:16", "1:1", "4:3", "3:4", "21:9", "adaptive"].includes(videoAspectRatio)) {
                                      setVideoAspectRatio("16:9")
                                    }
                                    if (!["480p", "720p"].includes(videoResolution)) {
                                      setVideoResolution("720p")
                                    }
                                    if (videoDuration < 4 || videoDuration > 15) {
                                      setVideoDuration(5)
                                    }
                                  } else if (model.key === "wan27") {
                                    // Wan 2.7: 比例支持 "16:9", "9:16", "1:1", "4:3", "3:4"；分辨率支持 "720p", "1080p"；时长根据模式不同
                                    if (!["16:9", "9:16", "1:1", "4:3", "3:4"].includes(videoAspectRatio)) {
                                      setVideoAspectRatio("16:9")
                                    }
                                    if (!["720p", "1080p"].includes(videoResolution)) {
                                      setVideoResolution("720p")
                                    }
                                    // 文生/图生/首尾帧: 2-15s; 参考生/视频编辑: 2-10s
                                    const maxDuration = ["reference2video", "videoEdit"].includes(videoGenerateMode) ? 10 : 15
                                    if (videoDuration < 2 || videoDuration > maxDuration) {
                                      setVideoDuration(5)
                                    }
                                    // Wan 支持 reference2video 和 videoEdit 模式，无需重置
                                  } else if (model.key === "happyhorse") {
                                    // HappyHorse 1.0: 比例支持 "16:9", "9:16", "1:1", "4:3", "3:4"；分辨率支持 "720p", "1080p"；时长 3-15s
                                    if (!["16:9", "9:16", "1:1", "4:3", "3:4"].includes(videoAspectRatio)) {
                                      setVideoAspectRatio("16:9")
                                    }
                                    if (!["720p", "1080p"].includes(videoResolution)) {
                                      setVideoResolution("720p")
                                    }
                                    if (videoDuration < 3 || videoDuration > 15) {
                                      setVideoDuration(5)
                                    }
                                    // HappyHorse 不支持 reference2video 和 videoEdit 模式，重置为 text2video
                                    if (["reference2video", "videoEdit"].includes(videoGenerateMode)) {
                                      setVideoGenerateMode("text2video")
                                    }
                                  } else if (model.key === "happyhorse11") {
                                    // HappyHorse 1.1: 比例支持完整列表；分辨率支持 "720p", "1080p"；时长 3-15s
                                    if (!["16:9", "9:16", "1:1", "4:3", "3:4", "4:5", "5:4", "9:21", "21:9"].includes(videoAspectRatio)) {
                                      setVideoAspectRatio("16:9")
                                    }
                                    if (!["720p", "1080p"].includes(videoResolution)) {
                                      setVideoResolution("720p")
                                    }
                                    if (videoDuration < 3 || videoDuration > 15) {
                                      setVideoDuration(5)
                                    }
                                    // HappyHorse 1.1 仅支持 text2video / image2video / reference2video，重置不支持的模式
                                    if (["firstlast2video", "videoEdit"].includes(videoGenerateMode)) {
                                      setVideoGenerateMode("text2video")
                                    }
                                  } else if (model.key === "veo3" || model.key === "veo3fast" || model.key === "veo3lite") {
                                    // Veo 3.1 系列: 仅支持 16:9 和 9:16，分辨率仅支持 720p
                                    if (!["16:9", "9:16"].includes(videoAspectRatio)) {
                                      setVideoAspectRatio("16:9")
                                    }
                                    // Veo 暂时只支持 720p
                                    setVideoResolution("720p")
                                    // Veo 3.1 系列不支持 reference2video 模式，需要重置
                                    if (videoGenerateMode === "reference2video") {
                                      setVideoGenerateMode("text2video")
                                    }
                                  } else if (model.key === "geminiOmniVideo") {
                                    // Gemini Omni Video: 比例支持 "16:9", "9:16"；分辨率支持 "720p", "1080p", "4K"；时长仅支持 4/6/8/10s
                                    if (!["16:9", "9:16"].includes(videoAspectRatio)) {
                                      setVideoAspectRatio("16:9")
                                    }
                                    if (!["720p", "1080p", "4K"].includes(videoResolution)) {
                                      setVideoResolution("720p")
                                    }
                                    // Gemini Omni 只支持 4, 6, 8, 10 秒
                                    if (![4, 6, 8, 10].includes(videoDuration)) {
                                      setVideoDuration(8)
                                    }
                                    // Gemini Omni 支持 reference2video, text2video, image2video，不支持 videoEdit
                                    if (videoGenerateMode === "videoEdit") {
                                      setVideoGenerateMode("text2video")
                                    }
                                  } else if (model.key === "minimaxH3") {
                                    // MiniMax H3: 比例支持 "16:9", "4:3", "1:1", "3:4", "9:16", "21:9"；分辨率支持 "768p"/"2K"；时长 4-15s
                                    if (!["16:9", "4:3", "1:1", "3:4", "9:16", "21:9"].includes(videoAspectRatio)) {
                                      setVideoAspectRatio("16:9")
                                    }
                                    if (!["768p", "2K"].includes(videoResolution)) {
                                      setVideoResolution("768p")
                                    }
                                    if (videoDuration < 4 || videoDuration > 15) {
                                      setVideoDuration(6)
                                    }
                                    // MiniMax H3 支持 text2video, image2video, firstlast2video, reference2video
                                    if (videoGenerateMode === "videoEdit") {
                                      setVideoGenerateMode("text2video")
                                    }
                                  } else if (model.key === "kling30") {
                                    // Kling 3.0: 比例支持 "16:9", "9:16", "1:1"；分辨率支持 "Standard", "Pro", "4K"；时长 3-15s
                                    if (!["16:9", "9:16", "1:1"].includes(videoAspectRatio)) {
                                      setVideoAspectRatio("16:9")
                                    }
                                    if (!["Standard", "Pro", "4K"].includes(videoResolution)) {
                                      setVideoResolution("Standard")
                                    }
                                    if (videoDuration < 3 || videoDuration > 15) {
                                      setVideoDuration(5)
                                    }
                                    // Kling 3.0 只支持 text2video, image2video, firstlast2video，重置不支持的模式
                                    if (["reference2video", "videoEdit"].includes(videoGenerateMode)) {
                                      setVideoGenerateMode("text2video")
                                    }
                                  } else if (model.key === "klingV3Turbo") {
                                    // Kling V3 Turbo: 比例支持 "16:9", "9:16", "1:1"；分辨率支持 "720p", "1080p"；时长 3-15s
                                    if (!["16:9", "9:16", "1:1"].includes(videoAspectRatio)) {
                                      setVideoAspectRatio("16:9")
                                    }
                                    if (!["720p", "1080p"].includes(videoResolution)) {
                                      setVideoResolution("720p")
                                    }
                                    if (videoDuration < 3 || videoDuration > 15) {
                                      setVideoDuration(5)
                                    }
                                    // Kling V3 Turbo 仅支持 text2video, image2video，重置不支持的模式
                                    if (["firstlast2video", "reference2video", "videoEdit"].includes(videoGenerateMode)) {
                                      setVideoGenerateMode("text2video")
                                    }
                                  } else if (model.key === "wan27") {
                                    // Wan 2.7: 比例支持 "16:9", "9:16", "1:1", "4:3", "3:4"；分辨率支持 "720p", "1080p"；时长根据模式不同
                                    if (!["16:9", "9:16", "1:1", "4:3", "3:4"].includes(videoAspectRatio)) {
                                      setVideoAspectRatio("16:9")
                                    }
                                    if (!["720p", "1080p"].includes(videoResolution)) {
                                      setVideoResolution("720p")
                                    }
                                    // 文生/图生/首尾帧: 2-15s; 参考生/视频编辑: 2-10s
                                    const maxDuration = ["reference2video", "videoEdit"].includes(videoGenerateMode) ? 10 : 15
                                    if (videoDuration < 2 || videoDuration > maxDuration) {
                                      setVideoDuration(5)
                                    }
                                    // Wan 支持 reference2video 和 videoEdit 模式，无需重置
                                  } else if (model.key === "happyhorse") {
                                    // HappyHorse 1.0: 比例支持 "16:9", "9:16", "1:1", "4:3", "3:4"；分辨率支持 "720p", "1080p"；时长 3-15s
                                    if (!["16:9", "9:16", "1:1", "4:3", "3:4"].includes(videoAspectRatio)) {
                                      setVideoAspectRatio("16:9")
                                    }
                                    if (!["720p", "1080p"].includes(videoResolution)) {
                                      setVideoResolution("720p")
                                    }
                                    if (videoDuration < 3 || videoDuration > 15) {
                                      setVideoDuration(5)
                                    }
                                    // HappyHorse 不支持 reference2video 和 videoEdit 模式，重置为 text2video
                                    if (["reference2video", "videoEdit"].includes(videoGenerateMode)) {
                                      setVideoGenerateMode("text2video")
                                    }
                                  } else if (model.key === "veo3" || model.key === "veo3fast" || model.key === "veo3lite") {
                                    // Veo 3.1 系列: 仅支持 16:9 和 9:16，分辨率仅支持 720p
                                    if (!["16:9", "9:16"].includes(videoAspectRatio)) {
                                      setVideoAspectRatio("16:9")
                                    }
                                    // Veo 暂时只支持 720p
                                    setVideoResolution("720p")
                                    // Veo 3.1 系列不支持 reference2video 模式，需要重置
                                    if (videoGenerateMode === "reference2video") {
                                      setVideoGenerateMode("text2video")
                                    }
                                  } else {
                                    // Seedance 2.0: 比例不支持 "adaptive"，分辨率支持 "480p", "720p", "1080p"，时长 4-15
                                    if (videoAspectRatio === "adaptive") {
                                      setVideoAspectRatio("16:9")
                                    }
                                    if (!["480p", "720p", "1080p"].includes(videoResolution)) {
                                      setVideoResolution("720p")
                                    }
                                    if (videoDuration < 4 || videoDuration > 15) {
                                      setVideoDuration(5)
                                    }
                                  }
                                }}
                                className={cn(
                                  "px-3 py-1.5 text-xs rounded-full border transition-all duration-200",
                                  selectedVideoModel === model.key
                                    ? "bg-primary text-primary-foreground border-primary"
                                    : "border-border hover:border-primary/40 hover:bg-primary/5"
                                )}
                              >
                                {model.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* 视频生成模式选择 */}
                        <div className="space-y-2">
                          <div className="text-xs font-medium text-muted-foreground px-1">{t("operate.videoGenerateMode")}</div>
                          <div className="flex flex-wrap gap-1.5">
                            {[
                              { key: "text2video", label: t("operate.text2video") },
                              { key: "image2video", label: t("operate.image2video") },
                              { key: "firstlast2video", label: t("operate.firstlast2video") },
                              { key: "reference2video", label: t("operate.reference2video") },
                              { key: "videoEdit", label: t("operate.videoEdit") }
                              ].filter(mode => {
                                // Seedance 支持 text2video, image2video, firstlast2video, reference2video
                                if (selectedVideoModel.startsWith("seedance")) {
                                  return ["text2video", "image2video", "firstlast2video", "reference2video"].includes(mode.key)
                                }
                                // Wan 2.7 支持 text2video, image2video, firstlast2video, reference2video, videoEdit
                                if (selectedVideoModel === "wan27") {
                                  return true
                                }
                                // HappyHorse 1.0 支持 text2video, image2video, reference2video, videoEdit
                                if (selectedVideoModel === "happyhorse") {
                                  return ["text2video", "image2video", "reference2video", "videoEdit"].includes(mode.key)
                                }
                                // HappyHorse 1.1 支持 text2video, image2video, reference2video
                                if (selectedVideoModel === "happyhorse11") {
                                  return ["text2video", "image2video", "reference2video"].includes(mode.key)
                                }
                                // Kling 3.0 支持 text2video, image2video, firstlast2video
                                if (selectedVideoModel === "kling30") {
                                  return ["text2video", "image2video", "firstlast2video"].includes(mode.key)
                                }
                                // Kling V3 Turbo 仅支持 text2video, image2video
                                if (selectedVideoModel === "klingV3Turbo") {
                                  return ["text2video", "image2video"].includes(mode.key)
                                }
                                // Gemini Omni Video 支持 text2video, image2video, reference2video
                                if (selectedVideoModel === "geminiOmniVideo") {
                                  return ["text2video", "image2video", "reference2video"].includes(mode.key)
                                }
                                // MiniMax H3 支持 text2video, image2video, firstlast2video, reference2video
                                if (selectedVideoModel === "minimaxH3") {
                                  return ["text2video", "image2video", "firstlast2video", "reference2video"].includes(mode.key)
                                }
                                // Veo 模型支持 text2video, image2video, firstlast2video
                                if (selectedVideoModel.startsWith("veo")) {
                                  if (["text2video", "image2video", "firstlast2video"].includes(mode.key)) {
                                    return true
                                  }
                                  // Veo 3.1 Fast 额外支持 reference2video
                                  if (selectedVideoModel === "veo3fast" && mode.key === "reference2video") {
                                    return true
                                  }
                                  return false
                                }
                                return false
                              }).map((mode) => (
                              <button
                                key={mode.key}
                                onClick={() => {
                                  const newMode = mode.key as typeof videoGenerateMode
                                  // 切换模式时验证 videoDuration 是否在新模式的有效范围内
                                  if (selectedVideoModel === "wan27") {
                                    const maxDuration = ["reference2video", "videoEdit"].includes(newMode) ? 10 : 15
                                    const minDuration = 2
                                    if (videoDuration < minDuration || videoDuration > maxDuration) {
                                      setVideoDuration(Math.min(Math.max(videoDuration, minDuration), maxDuration))
                                    }
                                  } else if (selectedVideoModel === "happyhorse") {
                                    const minDuration = 3
                                    const maxDuration = 15
                                    if (videoDuration < minDuration || videoDuration > maxDuration) {
                                      setVideoDuration(Math.min(Math.max(videoDuration, minDuration), maxDuration))
                                    }
                                  } else if (selectedVideoModel === "happyhorse11") {
                                    const minDuration = 3
                                    const maxDuration = 15
                                    if (videoDuration < minDuration || videoDuration > maxDuration) {
                                      setVideoDuration(Math.min(Math.max(videoDuration, minDuration), maxDuration))
                                    }
                                  } else if (selectedVideoModel === "klingV3Turbo") {
                                    const minDuration = 3
                                    const maxDuration = 15
                                    if (videoDuration < minDuration || videoDuration > maxDuration) {
                                      setVideoDuration(Math.min(Math.max(videoDuration, minDuration), maxDuration))
                                    }
                                  }
                                  setVideoGenerateMode(newMode)
                                }}
                                className={cn(
                                  "px-3 py-1.5 text-xs rounded-full border transition-all duration-200",
                                  videoGenerateMode === mode.key
                                    ? "bg-primary text-primary-foreground border-primary"
                                    : "border-border hover:border-primary/40 hover:bg-primary/5"
                                )}
                              >
                                {mode.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* 参考生视频模式提示 - Seedance、Wan、HappyHorse 1.0 和 HappyHorse 1.1 模型显示 */}
                        {(selectedVideoModel.startsWith("seedance") || selectedVideoModel === "wan27" || selectedVideoModel === "happyhorse" || selectedVideoModel === "happyhorse11") && videoGenerateMode === 'reference2video' && (
                          <div className="text-xs text-muted-foreground px-1 leading-relaxed">
                            {selectedVideoModel === "seedance25" ? t("operate.seedance25ReferenceVideoHint") : selectedVideoModel === "wan27" ? t("operate.wanReferenceVideoHint") : selectedVideoModel === "happyhorse" ? t("operate.happyhorseReferenceVideoHint") : selectedVideoModel === "happyhorse11" ? (t("operate.happyhorse11ReferenceVideoHint") || t("operate.happyhorseReferenceVideoHint")) : t("operate.referenceVideoHint")}
                          </div>
                        )}

                        {/* 参考图生视频模式提示 - 仅 Veo 3.1 Fast、Gemini Omni 和 MiniMax H3 模型显示 */}
                        {videoGenerateMode === 'reference2video' && (selectedVideoModel === "veo3fast" || selectedVideoModel === "geminiOmniVideo" || selectedVideoModel === "minimaxH3") && (
                          <div className="text-xs text-muted-foreground px-1 leading-relaxed">
                            {selectedVideoModel === "veo3fast" ? t("operate.veoReferenceVideoHint") : selectedVideoModel === "minimaxH3" ? t("operate.minimaxH3ReferenceHint") : t("operate.geminiOmniReferenceHint")}
                          </div>
                        )}

                        {/* 视频编辑模式提示 - Wan 和 HappyHorse 模型显示 */}
                        {(selectedVideoModel === "wan27" || selectedVideoModel === "happyhorse") && videoGenerateMode === 'videoEdit' && (
                          <div className="text-xs text-muted-foreground px-1 leading-relaxed">
                            {selectedVideoModel === "wan27" ? t("operate.wanVideoEditHint") : t("operate.happyhorseVideoEditHint")}
                          </div>
                        )}

                        {/* 视频比例 */}
                        <div className="space-y-2">
                          <div className="text-xs font-medium text-muted-foreground px-1">{t("operate.aspectRatio")}</div>
                          <div className="flex flex-wrap gap-1.5">
                            {(selectedVideoModel === "seedance2fast" || selectedVideoModel === "seedance2mini" || selectedVideoModel === "seedance25"
                              ? ["16:9", "9:16", "1:1", "4:3", "3:4", "21:9", "adaptive"]      : selectedVideoModel === "happyhorse"
                              ? ["16:9", "9:16", "1:1", "4:3", "3:4"]
                              : selectedVideoModel === "happyhorse11"
                              ? ["16:9", "9:16", "1:1", "4:3", "3:4", "4:5", "5:4", "9:21", "21:9"]
                              : selectedVideoModel === "wan27"
                              ? ["16:9", "9:16", "1:1", "4:3", "3:4"]
                              : selectedVideoModel === "kling30" || selectedVideoModel === "klingV3Turbo"
                              ? ["16:9", "9:16", "1:1"]
                              : selectedVideoModel === "geminiOmniVideo"
                              ? ["16:9", "9:16"]
                              : selectedVideoModel === "minimaxH3"
                              ? ["16:9", "4:3", "1:1", "3:4", "9:16", "21:9"]
                              : selectedVideoModel.startsWith("veo")
                              ? ["16:9", "9:16"]
                              : ["16:9", "9:16", "1:1", "4:3", "3:4", "21:9"]
                            ).map((r) => (
                              <button
                                key={r}
                                onClick={() => setVideoAspectRatio(r)}
                                className={cn(
                                  "px-2.5 py-1 text-xs rounded-full border transition-all duration-200",
                                  videoAspectRatio === r
                                    ? "bg-primary text-primary-foreground border-primary"
                                    : "border-border hover:border-primary/40 hover:bg-primary/5"
                                )}
                              >
                                {r}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* 视频分辨率 */}
                        <div className="space-y-2">
                          <div className="text-xs font-medium text-muted-foreground px-1">{t("operate.resolution")}</div>
                          <div className="flex flex-wrap gap-1.5">
                            {(selectedVideoModel === "seedance2fast" || selectedVideoModel === "seedance2mini" || selectedVideoModel === "seedance25"
                              ? ["480p", "720p"]
                              : selectedVideoModel === "happyhorse" || selectedVideoModel === "happyhorse11" || selectedVideoModel === "wan27" || selectedVideoModel === "klingV3Turbo"
                              ? ["720p", "1080p"]
                              : selectedVideoModel === "kling30"
                              ? ["Standard", "Pro", "4K"]
                              : selectedVideoModel === "geminiOmniVideo"
                              ? ["720p", "1080p", "4K"]
                              : selectedVideoModel === "minimaxH3"
                              ? ["768p", "2K"]
                              : selectedVideoModel.startsWith("veo")
                              ? ["2K"]
                              : ["480p", "720p", "1080p"]
                            ).map((r) => (
                              <button
                                key={r}
                                onClick={() => setVideoResolution(r)}
                                className={cn(
                                  "px-2.5 py-1 text-xs rounded-full border transition-all duration-200",
                                  videoResolution === r
                                    ? "bg-primary text-primary-foreground border-primary"
                                    : "border-border hover:border-primary/40 hover:bg-primary/5"
                                )}
                              >
                                {r}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* 视频时长 - Veo/Gemini Omni 模型显示步进选择，其他显示滑块 */}
                        {selectedVideoModel === "geminiOmniVideo" ? (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between px-1">
                              <span className="text-xs font-medium text-muted-foreground">{t("operate.duration")}</span>
                              <span className="text-xs font-medium text-primary">{videoDuration}s</span>
                            </div>
                            <div className="flex gap-2">
                              {[4, 6, 8, 10].map((d) => (
                                <button
                                  key={d}
                                  onClick={() => setVideoDuration(d)}
                                  className={cn(
                                    "flex-1 py-2 text-xs rounded-lg border transition-all duration-200",
                                    videoDuration === d
                                      ? "bg-primary text-primary-foreground border-primary"
                                      : "border-border hover:border-primary/40 hover:bg-primary/5"
                                  )}
                                >
                                  {d}s
                                </button>
                              ))}
                            </div>
                          </div>
                        ) : selectedVideoModel.startsWith("veo") ? (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between px-1">
                              <span className="text-xs font-medium text-muted-foreground">{t("operate.duration")}</span>
                              <span className="text-xs font-medium text-primary">8s</span>
                            </div>
                            <div className="w-full h-2 bg-secondary rounded-full">
                              <div className="h-full bg-primary rounded-full" style={{ width: "100%" }} />
                            </div>
                          </div>
                        ) : (
                            <div className="space-y-2">
                            <div className="flex items-center justify-between px-1">
                              <span className="text-xs font-medium text-muted-foreground">{t("operate.duration")}</span>
                              <span className="text-xs font-medium text-primary">{videoDuration}s</span>
                            </div>
                            <input
                              type="range"
                              min={
                                selectedVideoModel === "happyhorse" || selectedVideoModel === "happyhorse11" || selectedVideoModel === "kling30" || selectedVideoModel === "klingV3Turbo"
                                  ? 3
                                  : selectedVideoModel === "wan27"
                                    ? 2
                                    : selectedVideoModel === "seedance25"
                                      ? 4
                                      : 4  // Veo, Gemini Omni Video 等默认最小 4s
                              }
                              max={
                                selectedVideoModel === "wan27" && ["reference2video", "videoEdit"].includes(videoGenerateMode)
                                  ? 10
                                  : selectedVideoModel === "geminiOmniVideo" && videoGenerateMode !== "text2video"
                                    ? 10  // Gemini Omni 参考生视频时长由模型决定
                                    : selectedVideoModel === "seedance25"
                                      ? 30  // Seedance 2.5 支持 4-30 秒
                                      : 15
                              }
                              step={selectedVideoModel === "geminiOmniVideo" ? "2" : "1"}
                              value={videoDuration}
                              onChange={(e) => {
                                const val = Number(e.target.value)
                                // Gemini Omni Video 只允许 4, 6, 8, 10 秒
                                if (selectedVideoModel === "geminiOmniVideo") {
                                  const allowedValues = [4, 6, 8, 10]
                                  const nearest = allowedValues.reduce((prev, curr) =>
                                    Math.abs(curr - val) < Math.abs(prev - val) ? curr : prev
                                  )
                                  setVideoDuration(nearest)
                                } else {
                                  setVideoDuration(val)
                                }
                              }}
                              className="w-full h-2 bg-secondary rounded-full appearance-none cursor-pointer accent-primary"
                            />
                            <div className="flex justify-between text-xs text-muted-foreground px-1">
                              <span>
                                {selectedVideoModel === "happyhorse" || selectedVideoModel === "happyhorse11" || selectedVideoModel === "kling30" || selectedVideoModel === "klingV3Turbo"
                                  ? "3s"
                                  : selectedVideoModel === "wan27"
                                    ? "2s"
                                    : "4s"}
                              </span>
                              <span>
                                {selectedVideoModel === "wan27" && ["reference2video", "videoEdit"].includes(videoGenerateMode)
                                  ? "10s"
                                  : selectedVideoModel === "geminiOmniVideo" && videoGenerateMode !== "text2video"
                                    ? "auto"
                                    : selectedVideoModel === "geminiOmniVideo"
                                      ? "10s"
                                      : selectedVideoModel === "seedance25"
                                        ? "30s"
                                        : "15s"}
                              </span>
                            </div>
                          </div>
                        )}

                        {/* 音频生成 - Seedance 和 Kling 3.0 模型显示 */}
                        {(selectedVideoModel.startsWith("seedance") || selectedVideoModel === "kling30") && (
                            <div className="space-y-2">
                              <div className="text-xs font-medium text-muted-foreground px-1">{t("operate.audioSetting") || "Generate Audio"}</div>
                              <div className="flex flex-wrap gap-1.5">
                                {[
                                  { key: "on", label: t("operate.on") || "On" },
                                  { key: "off", label: t("operate.off") || "Off" }
                                ].map((a) => (
                                <button
                                  key={a.key}
                                  onClick={() => setAudioSetting(a.key)}
                                  className={cn(
                                    "px-2.5 py-1 text-xs rounded-full border transition-all duration-200",
                                    audioSetting === a.key
                                      ? "bg-primary text-primary-foreground border-primary"
                                      : "border-border hover:border-primary/40 hover:bg-primary/5"
                                  )}
                                >
                                  {a.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                      )}

                      {/* 当前选择摘要 */}
                      <div className="pt-2 border-t border-border">
                        <div className="text-xs text-muted-foreground px-1">
                          {t("operate.currentSelection")}: <span className="text-foreground font-medium">
                            {contentType === "video" ? (
                              <>{selectedVideoModel === "happyhorse" ? "HappyHorse 1.0" : selectedVideoModel === "happyhorse11" ? "HappyHorse 1.1" : selectedVideoModel === "wan27" ? "Wan 2.7" : selectedVideoModel === "kling30" ? "Kling 3.0" : selectedVideoModel === "klingV3Turbo" ? "Kling V3 Turbo" : selectedVideoModel === "seedance25" ? "Seedance 2.5" : selectedVideoModel === "seedance2fast" ? "Seedance 2.0 Fast" : selectedVideoModel === "seedance2mini" ? "Seedance 2.0 Mini" : selectedVideoModel === "seedance2" ? "Seedance 2.0" : selectedVideoModel === "veo3" ? "Veo 3.1 Quality" : selectedVideoModel === "veo3fast" ? "Veo 3.1 Fast" : selectedVideoModel === "veo3lite" ? "Veo 3.1 Lite" : selectedVideoModel === "geminiOmniVideo" ? "Gemini Omni" : selectedVideoModel === "minimaxH3" ? "MiniMax H3" : selectedVideoModel} · {videoGenerateMode === "text2video" ? t("operate.text2video") : videoGenerateMode === "image2video" ? t("operate.image2video") : videoGenerateMode === "firstlast2video" ? t("operate.firstlast2video") : videoGenerateMode === "reference2video" ? t("operate.reference2video") : t("operate.videoEdit")} · {videoAspectRatio} · {videoResolution} · {selectedVideoModel.startsWith("veo") || selectedVideoModel === "geminiOmniVideo" ? "" : `${videoDuration}s`}</>
                            ) : (
                              <>{selectedModel === "nanoBananaPro" ? "Nano Banana Pro" : selectedModel === "nanoBanana2" ? "Nano Banana 2" : selectedModel === "nanoBanana2Lite" ? "Nano Banana 2 Lite" : selectedModel === "gptImage2" ? "GPT Image 2" : selectedModel === "seedream5Pro" ? "Seedream 5.0 Pro" : "Seedream 5.0 Lite"} · {aspectRatio}{selectedModel === "nanoBanana2Lite" ? "" : ` · ${selectedModel === "seedream5Lite" || selectedModel === "seedream5Pro" ? quality : duration}`}</>
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>

                {/* 右侧按钮组 */}
                <div className="flex flex-row items-center gap-2 md:ml-auto w-full md:w-auto overflow-x-auto whitespace-nowrap">

                  {/* 生成按钮 */}
                  <Button
                    onClick={handleSend}
                    disabled={(!message.trim() && selectedImages.length === 0 && imageUrls.length === 0) || isGenerating}
                    className={cn(
                      "inline-flex w-10 h-10 md:w-auto md:px-6 md:py-2 rounded-full flex-shrink-0 ml-auto md:ml-0",
                      "bg-primary hover:bg-primary/90",
                      "disabled:opacity-50 disabled:cursor-not-allowed",
                      "transition-all",
                      "shadow-lg shadow-primary/20",
                      "flex items-center justify-center gap-2"
                    )}
                    aria-label={t("operate.sendMessage")}
                  >
                    {isGenerating ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4" />
                    )}
                    <span className="hidden md:inline text-sm font-medium">
                      {isGenerating ? t("operate.generating") : t("operate.applyEdit")}
                    </span>
                  </Button>
            </div>

          </div>
        </div>
      </div>

      {/* 生成结果显示 */}
      {showResults && (isGenerating || generatedImages.length > 0) && (
        <div className="w-full max-w-2xl mt-6">
          <div className="rounded-[28px] bg-background/95 backdrop-blur-md border border-border p-6 shadow-2xl shadow-primary/5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">
                {isGenerating
                  ? (isEditMode
                    ? (contentType === "video" ? t("operate.editingVideoTitle") : t("operate.editingTitle"))
                    : (contentType === "video" ? t("operate.generatingVideoTitle") : t("operate.generatingTitle")))
                  : (generatedImages.some(img => img.isVideo)
                    ? t("operate.generatedVideos")
                    : t("operate.generatedImages"))
                }
              </h3>
              {!isGenerating && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={closeResults}
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>

            <div className="flex justify-center">
              {/* 加载占位图 */}
              {isGenerating ? (
                <div className="w-full max-w-sm">
                  <div className="relative aspect-square rounded-lg overflow-hidden border-2 border-dashed border-primary/30 bg-gradient-to-br from-muted/50 to-muted">
                    {/* 草图背景纹理 */}
                    <div className="absolute inset-0 opacity-10">
                      <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
                        <defs>
                          <pattern id="sketch-pattern" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
                            <path d="M0 10 L20 10 M10 0 L10 20" stroke="currentColor" strokeWidth="0.5" fill="none" opacity="0.5"/>
                          </pattern>
                        </defs>
                        <rect width="100%" height="100%" fill="url(#sketch-pattern)" />
                      </svg>
                    </div>

                    {/* 中心加载状态 */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                      <div className="relative">
                        <div className="w-16 h-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                        <Sparkles className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 text-primary animate-pulse" />
                      </div>
                      <div className="text-center space-y-1">
                        <p className="text-lg font-medium text-foreground">
                          {isEditMode ? t("operate.editingStatus") : t("operate.generatingStatus")}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {t("operate.pleaseWait" + (contentType === "video" ? "Video" : ""))}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className={cn(
                  "grid gap-4",
                  generatedImages.length === 1
                    ? "grid-cols-1 max-w-md"
                    : "grid-cols-1 md:grid-cols-2 max-w-2xl"
                )}>
                  {generatedImages.map((image, index) => (
                    <div key={index} className="flex flex-col items-center space-y-3">
                      <div
                        className="w-full max-w-sm rounded-lg overflow-hidden border bg-muted cursor-pointer hover:shadow-lg transition-shadow"
                        onClick={() => openGeneratedPreview(image.url, index, !!image.isVideo)}
                      >
                        {image.isVideo ? (
                          <video
                            src={image.url}
                            controls
                            autoPlay
                            loop
                            muted
                            playsInline
                            className="w-full h-auto object-contain hover:scale-105 transition-transform"
                            style={{ aspectRatio: 'auto', minHeight: '200px' }}
                          />
                        ) : (
                          <img
                            src={image.url}
                            alt={`Generated image ${index + 1}`}
                            className="w-full h-auto object-contain hover:scale-105 transition-transform"
                            style={{ aspectRatio: 'auto', minHeight: '200px' }}
                          />
                        )}
                      </div>
                      <div className="flex gap-2 w-full max-w-sm">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openGeneratedPreview(image.url, index, !!image.isVideo)}
                          className="flex-1"
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          {t("operate.preview")}
                        </Button>
                        <Button
                          size="sm"
                          disabled={downloadingImages.has(image.url)}
                          onClick={async () => {
                            const imageKey = image.url
                            const isVideo = !!image.isVideo
                            setDownloadingImages(prev => new Set(prev).add(imageKey))

                            try {
                              let downloadUrl = image.url

                              // 检查是否为KIE生成的图片，需要获取下载URL
                              if (image.url.includes('kie.ai') || image.url.includes('tempfile')) {
                                const downloadUrlResponse = await fetch('/api/ai/kie/download-url', {
                                  method: 'POST',
                                  headers: {
                                    'Content-Type': 'application/json',
                                  },
                                  body: JSON.stringify({ url: image.url }),
                                })

                                if (downloadUrlResponse.ok) {
                                  const downloadUrlData = await downloadUrlResponse.json()
                                  downloadUrl = downloadUrlData.downloadUrl
                                }
                                // 如果获取失败，使用原始URL
                              }

                              // 获取文件的blob数据
                              const response = await fetch(downloadUrl)
                              const blob = await response.blob()

                              // 创建blob URL
                              const blobUrl = URL.createObjectURL(blob)

                              // 创建下载链接，根据类型使用不同的文件名
                              const link = document.createElement('a')
                              link.href = blobUrl
                              link.download = isVideo
                                ? `generated-video-${index + 1}.mp4`
                                : `generated-image-${index + 1}.png`
                              document.body.appendChild(link)
                              link.click()
                              document.body.removeChild(link)

                              // 清理blob URL
                              URL.revokeObjectURL(blobUrl)

                              // 显示成功提示
                              toast({
                                title: isVideo ? (t("operate.videoDownloadSuccess") || "视频下载成功") : t("operate.downloadSuccess"),
                                description: isVideo ? (t("operate.videoDownloadSuccessDesc") || "视频已保存到本地") : t("operate.downloadSuccessDesc"),
                              })
                            } catch (error) {
                              console.error(isVideo ? '下载视频失败:' : '下载图片失败:', error)
                              toast({
                                title: isVideo ? t("operate.videoDownloadError") || "视频下载失败" : t("operate.downloadError"),
                                description: t("operate.downloadErrorDesc"),
                                variant: "destructive",
                              })

                              // 如果blob方式失败，回退到直接链接方式
                              const link = document.createElement('a')
                              link.href = image.url
                              link.download = isVideo
                                ? `generated-video-${index + 1}.mp4`
                                : `generated-image-${index + 1}.png`
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
                          }}
                          className="flex-1"
                        >
                          {downloadingImages.has(image.url) ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <Download className="w-4 h-4 mr-2" />
                          )}
                          {downloadingImages.has(image.url)
                            ? (t("operate.downloading") || "下载中...")
                            : t("operate.download")
                          }
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 链接输入模态框 */}
      <Dialog open={showLinkInput} onOpenChange={setShowLinkInput}>
        <DialogContent className="sm:max-w-lg p-0 overflow-hidden">
          <div className="p-6 pb-4">
            <DialogHeader className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Link className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <DialogTitle className="text-lg font-semibold">{t("operate.addLinkTitle")}</DialogTitle>
                  <p className="text-sm text-muted-foreground mt-1">{t("operate.addLinkDesc")}</p>
                </div>
              </div>
            </DialogHeader>
          </div>

          <div className="px-6 pb-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">{t("operate.linkLabel")}</label>
                <Input
                  placeholder={t("operate.linkPlaceholder")}
                  value={linkInput}
                  onChange={(e) => setLinkInput(e.target.value)}
                  onKeyDown={handleLinkInputKeyDown}
                  className="h-11"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowLinkInput(false)
                    setLinkInput("")
                  }}
                  className="px-4"
                >
                  {t("operate.cancel")}
                </Button>
                <Button
                  onClick={handleAddLink}
                  disabled={!linkInput.trim()}
                  className="px-6"
                >
                  <Link className="w-4 h-4 mr-2" />
                  {t("operate.addLink")}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 图片预览模态框 */}
      {previewImage && (
        <>
          {/* 全屏黑色背景遮罩 */}
          <div
            className="fixed inset-0 bg-black z-50"
            onClick={closePreview}
          />
          {/* 图片显示层 */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="relative max-w-5xl max-h-full flex items-center justify-center"
              onTouchStart={onTouchStart}
              onTouchEnd={onTouchEnd}
            >
              {(() => {
                const fileType = getFileType(previewImage)
                if (fileType === "image") {
                  return (
                    <img
                      src={previewImage}
                      alt={t("operate.previewImageAlt")}
                      className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                      onClick={(e) => e.stopPropagation()}
                    />
                  )
                } else if (fileType === "video") {
                  return (
                    <video
                      src={previewImage}
                      controls
                      autoPlay
                      className="max-w-full max-h-[90vh] rounded-lg shadow-2xl"
                      onClick={(e) => e.stopPropagation()}
                    />
                  )
                } else {
                  return (
                    <div
                      className="flex flex-col items-center justify-center bg-muted rounded-lg shadow-2xl p-8 min-w-64 min-h-64"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Music className="w-16 h-16 text-muted-foreground mb-4" />
                      <audio src={previewImage} controls autoPlay className="mt-4" />
                    </div>
                  )
                }
              })()}
              {selectedImages.length > 1 && (
                <>
                  <button
                    onClick={(e) => showPrev(e)}
                    className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-background/80 hover:bg-background shadow-md flex items-center justify-center"
                  >
                    <ChevronLeft className="w-5 h-5 text-foreground" />
                  </button>
                  <button
                    onClick={(e) => showNext(e)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-background/80 hover:bg-background shadow-md flex items-center justify-center"
                  >
                    <ChevronRight className="w-5 h-5 text-foreground" />
                  </button>
                </>
              )}
              <button
                onClick={closePreview}
                className="absolute top-4 right-4 w-12 h-12 bg-background/90 hover:bg-background rounded-full flex items-center justify-center text-foreground hover:text-primary transition-colors shadow-lg"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>
        </>
      )}

      {/* 生成图片预览模态框 */}
      {generatedPreviewImage && (
        <>
          {/* 全屏黑色背景遮罩 */}
          <div
            className="fixed inset-0 bg-black z-50"
            onClick={closeGeneratedPreview}
          />
          {/* 图片显示层 */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="relative w-full h-full max-w-[90vw] max-h-[90vh] flex items-center justify-center"
            >
              {generatedPreviewIsVideo ? (
                <video
                  src={generatedPreviewImage!}
                  controls
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <img
                  src={generatedPreviewImage!}
                  alt="Generated image preview"
                  className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                  onClick={(e) => e.stopPropagation()}
                />
              )}
              {generatedImages.length > 1 && (
                <>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      showGeneratedPrev()
                    }}
                    className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-background/80 hover:bg-background shadow-md flex items-center justify-center"
                  >
                    <ChevronLeft className="w-5 h-5 text-foreground" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      showGeneratedNext()
                    }}
                    className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-background/80 hover:bg-background shadow-md flex items-center justify-center"
                  >
                    <ChevronRight className="w-5 h-5 text-foreground" />
                  </button>
                </>
              )}
              <button
                onClick={closeGeneratedPreview}
                className="absolute top-4 right-4 w-12 h-12 bg-background/90 hover:bg-background rounded-full flex items-center justify-center text-foreground hover:text-primary transition-colors shadow-lg"
              >
                <X className="w-6 h-6" />
              </button>
              {generatedPreviewIndex !== null && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/50 text-white px-3 py-1 rounded-full text-sm">
                  {generatedPreviewIndex + 1} / {generatedImages.length}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      </div>

      {/* 积分不足购买弹窗 */}
      <Dialog open={showPurchaseDialog}>
        <DialogContent className="sm:max-w-lg p-0 overflow-hidden" onPointerDownOutside={(e) => e.preventDefault()}>
          <div className="p-6 pb-4">
            <DialogHeader className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <DialogTitle className="text-lg font-semibold">{t("operate.upgradeTitle")}</DialogTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    {purchaseReason === 'points'
                      ? t("operate.pointsDialogMessage", { points: currentPoints ?? 0 })
                      : purchaseReason === 'quota'
                        ? t("operate.uploadQuotaMessage", { limit: formatBytes(maxUploadBytes) })
                        : t("operate.subscriptionDialogMessage")
                    }
                  </p>
                </div>
              </div>
            </DialogHeader>
          </div>

          <div className="px-6 pb-6">
            <div className="space-y-4">
              <div className="flex items-center justify-end gap-3 pt-2">
                <PricingDialog>
                  <Button
                    autoFocus
                    className="px-6 flex items-center gap-2"
                  >
                    <Sparkles className="w-4 h-4" />
                    {t("operate.upgrade") ?? "Upgrade"}
                  </Button>
                </PricingDialog>
                <Button
                  variant="ghost"
                  onClick={() => setShowPurchaseDialog(false)}
                  className="px-4"
                >
                  {t("operate.cancel")}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      {/* 订阅弹窗（使用PricingDialog组件） */}
      <PricingDialog>
        <button
          className="hidden"
          aria-hidden="true"
        >
          {t("operate.upgrade")}
        </button>
      </PricingDialog>


      <SignInDialog open={isSignInDialogOpen} onOpenChange={setIsSignInDialogOpen} />

      {/* 错误提示弹窗 */}
      <Dialog open={showErrorDialog} onOpenChange={setShowErrorDialog}>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden" onPointerDownOutside={(e) => e.preventDefault()}>
          <div className="p-6 pb-4">
            <DialogHeader className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 flex items-center justify-center rounded-full bg-destructive/10">
                  <AlertCircle className="w-5 h-5 text-destructive" />
                </div>
                <div>
                  <DialogTitle className="text-lg font-semibold">{t("operate.error")}</DialogTitle>
                  <p className="text-sm text-muted-foreground mt-1">{errorDialogMessage}</p>
                </div>
              </div>
            </DialogHeader>
          </div>
          <div className="px-6 pb-6">
            <Button
              onClick={() => setShowErrorDialog(false)}
              className="w-full"
            >
              {t("operate.ok")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
