// ========== 模型和参数配置 ==========
// 所有图片和视频模型的配置，统一管理

// 图片模型配置
export const imageModelConfigs = [
  { key: 'nanoBananaPro', label: 'Nano Banana Pro' },
  { key: 'nanoBanana2', label: 'Nano Banana 2' },
  { key: 'nanoBanana2Lite', label: 'Nano Banana 2 Lite' },
  { key: 'gptImage2', label: 'GPT Image 2' },
  { key: 'seedream5Lite', label: 'Seedream 5.0 Lite' },
  { key: 'seedream5Pro', label: 'Seedream 5.0 Pro' },
] as const

// 图片模式
export const imageModes = [
  { key: 'generate', label: '生成' },
  { key: 'edit', label: '编辑' },
] as const

// 视频模式
export const videoModes = [
  { key: 'text2video', label: '文生视频' },
  { key: 'image2video', label: '图生视频' },
  { key: 'firstlast2video', label: '首尾帧' },
  { key: 'reference2video', label: '参考生视频' },
  { key: 'videoEdit', label: '视频编辑' },
] as const

// 各模型支持的视频模式
export const videoModelSupportedModes: Record<string, readonly string[]> = {
  seedance2: ['text2video', 'image2video', 'firstlast2video', 'reference2video', 'videoEdit'],
  seedance2fast: ['text2video', 'image2video', 'firstlast2video', 'reference2video'],
  seedance2mini: ['text2video', 'image2video', 'firstlast2video', 'reference2video'],
  veo3: ['text2video', 'image2video', 'firstlast2video', 'videoEdit'],
  veo3fast: ['text2video', 'image2video', 'firstlast2video', 'reference2video'],
  veo3lite: ['text2video', 'image2video', 'firstlast2video', 'videoEdit'],
  geminiOmniVideo: ['text2video', 'image2video', 'reference2video'],
  wan27: ['text2video', 'image2video', 'firstlast2video', 'reference2video', 'videoEdit'],
  happyhorse: ['text2video', 'image2video', 'reference2video', 'videoEdit'],
  happyhorse11: ['text2video', 'image2video', 'reference2video'],
  kling30: ['text2video', 'image2video', 'firstlast2video'],
  klingV3Turbo: ['text2video', 'image2video'],
  minimaxH3: ['text2video', 'image2video', 'firstlast2video', 'reference2video'],
}

// 获取视频模型支持的模式
export function getVideoModelSupportedModes(modelKey: string): readonly string[] {
  return videoModelSupportedModes[modelKey] || ['text2video']
}

// 图片比例配置
export const imageAspectRatios = ['1:1', '2:3', '3:2', '4:3', '4:5', '9:16', '16:9'] as const

// 预览用的图片比例（包括 Seedream 支持的比例）
export const previewAspectRatios = ['1:1', '4:3', '3:4', '16:9', '9:16', '2:3', '3:2', '21:9'] as const

// Seedream 5.0 支持的比例
export const seedreamAspectRatios = ['1:1', '4:3', '3:4', '16:9', '9:16', '2:3', '3:2', '21:9'] as const

// Nano Banana 2 Lite 支持的比例 (含 auto)
export const nanoBanana2LiteAspectRatios = ['1:1', '1:4', '1:8', '2:3', '3:2', '3:4', '4:1', '4:3', '4:5', '5:4', '8:1', '9:16', '16:9', '21:9', 'auto'] as const

// 图片分辨率配置
export const imageResolutions = ['1K', '2K', '4K'] as const

// 图片质量选项 (Seedream 专用)
export const imageQualities = ['basic', 'high'] as const

// 图片模型参数限制
export interface ImageModelConstraints {
  aspectRatios: readonly string[]
  useQuality?: boolean // Seedream 使用 quality 而非 resolution
}

export const imageModelConstraints: Record<string, ImageModelConstraints> = {
  nanoBananaPro: {
    aspectRatios: imageAspectRatios,
  },
  nanoBanana2: {
    aspectRatios: imageAspectRatios,
  },
  gptImage2: {
    aspectRatios: imageAspectRatios,
  },
  seedream5Lite: {
    aspectRatios: seedreamAspectRatios,
    useQuality: true,
  },
  seedream5Pro: {
    aspectRatios: seedreamAspectRatios,
    useQuality: true,
  },
  nanoBanana2Lite: {
    aspectRatios: nanoBanana2LiteAspectRatios,
  },
}

// 获取图片模型的可用比例
export function getImageModelAspectRatios(modelKey: string): readonly string[] {
  return imageModelConstraints[modelKey]?.aspectRatios || imageAspectRatios
}

// 判断图片模型是否使用 quality 而非 resolution
export function useImageQuality(modelKey: string): boolean {
  return imageModelConstraints[modelKey]?.useQuality || false
}

// 视频模型配置
export const videoModelConfigs = [
  { key: 'seedance2', label: 'Seedance 2.0' },
  { key: 'seedance2fast', label: 'Seedance 2.0 Fast' },
  { key: 'seedance2mini', label: 'Seedance 2.0 Mini' },
  { key: 'kling30', label: 'Kling 3.0' },
  { key: 'veo3', label: 'Veo 3.1 Quality' },
  { key: 'veo3fast', label: 'Veo 3.1 Fast' },
  { key: 'veo3lite', label: 'Veo 3.1 Lite' },
  { key: 'geminiOmniVideo', label: 'Gemini Omni' },
  { key: 'wan27', label: 'Wan 2.7' },
  { key: 'happyhorse', label: 'HappyHorse 1.0' },
  { key: 'happyhorse11', label: 'HappyHorse 1.1' },
  { key: 'klingV3Turbo', label: 'Kling V3 Turbo' },
  { key: 'minimaxH3', label: 'MiniMax H3' },
] as const

// 视频时长配置 (1-15秒)
export const videoDurations = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15'] as const

// 视频分辨率配置
export const videoResolutions = ['480p', '720p', '1080p', '4K'] as const

// 视频画面比例
export const videoAspectRatios = ['1:1', '4:3', '3:4', '16:9', '9:16', '21:9', 'adaptive'] as const

// Kling 3.0 特殊分辨率
export const klingResolutions = ['Standard', 'Pro', '4K'] as const

// 视频模型参数限制
export interface VideoModelConstraints {
  aspectRatios: readonly string[]
  resolutions: readonly string[]
  durationRange: { min: number; max: number; allowedValues?: number[] }
  supportedModes?: readonly string[]
}

export const videoModelConstraints: Record<string, VideoModelConstraints> = {
  seedance2: {
    aspectRatios: ['1:1', '4:3', '3:4', '16:9', '9:16', '21:9', 'adaptive'],
    resolutions: ['480p', '720p', '1080p', '4K'],
    durationRange: { min: 1, max: 15 },
  },
  seedance2fast: {
    aspectRatios: ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9', 'adaptive'],
    resolutions: ['480p', '720p'],
    durationRange: { min: 4, max: 15 },
  },
  seedance2mini: {
    aspectRatios: ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9', 'adaptive'],
    resolutions: ['480p', '720p'],
    durationRange: { min: 4, max: 15 },
  },
  veo3: {
    aspectRatios: ['16:9', '9:16'],
    resolutions: ['720p'],
    durationRange: { min: 1, max: 15 },
    supportedModes: ['text2video', 'image2video', 'firstlast2video', 'videoEdit'],
  },
  veo3fast: {
    aspectRatios: ['16:9', '9:16'],
    resolutions: ['720p'],
    durationRange: { min: 1, max: 15 },
    supportedModes: ['text2video', 'image2video', 'firstlast2video', 'reference2video'],
  },
  veo3lite: {
    aspectRatios: ['16:9', '9:16'],
    resolutions: ['720p'],
    durationRange: { min: 1, max: 15 },
    supportedModes: ['text2video', 'image2video', 'firstlast2video', 'videoEdit'],
  },
  geminiOmniVideo: {
    aspectRatios: ['16:9', '9:16'],
    resolutions: ['720p', '1080p', '4K'],
    durationRange: { min: 4, max: 10, allowedValues: [4, 6, 8, 10] },
    supportedModes: ['text2video', 'image2video', 'reference2video'],
  },
  wan27: {
    aspectRatios: ['16:9', '9:16', '1:1', '4:3', '3:4'],
    resolutions: ['720p', '1080p'],
    durationRange: { min: 2, max: 15 },
    supportedModes: ['text2video', 'image2video', 'firstlast2video', 'reference2video', 'videoEdit'],
  },
  happyhorse: {
    aspectRatios: ['16:9', '9:16', '1:1', '4:3', '3:4'],
    resolutions: ['720p', '1080p'],
    durationRange: { min: 3, max: 15 },
    supportedModes: ['text2video', 'image2video', 'reference2video', 'videoEdit'],
  },
  happyhorse11: {
    aspectRatios: ['16:9', '9:16', '1:1', '4:3', '3:4', '4:5', '5:4', '9:21', '21:9'],
    resolutions: ['720p', '1080p'],
    durationRange: { min: 3, max: 15 },
    supportedModes: ['text2video', 'image2video', 'reference2video'],
  },
  kling30: {
    aspectRatios: ['16:9', '9:16', '1:1'],
    resolutions: ['Standard', 'Pro', '4K'],
    durationRange: { min: 3, max: 15 },
    supportedModes: ['text2video', 'image2video', 'firstlast2video'],
  },
  klingV3Turbo: {
    aspectRatios: ['16:9', '9:16', '1:1'],
    resolutions: ['720p', '1080p'],
    durationRange: { min: 3, max: 15 },
    supportedModes: ['text2video', 'image2video'],
  },
  minimaxH3: {
    aspectRatios: ['16:9', '4:3', '1:1', '3:4', '9:16', '21:9'],
    resolutions: ['2K'],
    durationRange: { min: 4, max: 15, allowedValues: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15] },
    supportedModes: ['text2video', 'image2video', 'firstlast2video', 'reference2video'],
  },
}

// 获取模型的可用分辨率
export function getModelResolutions(modelKey: string): readonly string[] {
  return videoModelConstraints[modelKey]?.resolutions || videoResolutions
}

// 获取模型的可用时长范围
export function getModelDurationRange(modelKey: string): { min: number; max: number; allowedValues?: number[] } {
  return videoModelConstraints[modelKey]?.durationRange || { min: 1, max: 15 }
}

// 获取模型的可用比例
export function getModelAspectRatios(modelKey: string): readonly string[] {
  return videoModelConstraints[modelKey]?.aspectRatios || videoAspectRatios
}

// 获取给定时长范围内的可用时长选项
export function getAvailableDurations(modelKey: string): string[] {
  const range = getModelDurationRange(modelKey)
  // 如果模型有 allowedValues，使用它
  if (range.allowedValues && range.allowedValues.length > 0) {
    return range.allowedValues.map(String)
  }
  return videoDurations.filter(d => {
    const num = parseInt(d)
    return num >= range.min && num <= range.max
  })
}
