import { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { getFullUrl, getAlternateLinks } from '@/lib/url'
import { notFound } from 'next/navigation'

const locales = ['en', 'zh']

export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params

  if (!locales.includes(locale)) {
    notFound()
  }

  const t = await getTranslations({ locale, namespace: 'metadata.editor' })
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || ''
  const currentUrl = getFullUrl('/editor', locale)

  return {
    title: t('title'),
    description: t('description'),
    keywords: locale === 'zh'
      ? 'AI图片编辑,图片生成,人工智能,图像处理,艺术创作,AI绘画,智能编辑,图片修复,风格转换,图像增强,创意工具,数字艺术,设计工具,文本生成图片,图像放大,照片编辑,AI艺术创作'
      : 'AI image editor,image generation,artificial intelligence,image processing,art creation,AI painting,intelligent editing,image restoration,style transfer,image enhancement,creative tools,digital art,design tools,text to image,image upscaling,photo editing,AI art creation',
    authors: [{ name: 'Editf Team' }],
    creator: 'Editf',
    publisher: 'Editf',
    formatDetection: {
      email: false,
      address: false,
      telephone: false,
    },
    manifest: '/manifest.json',
    icons: {
      icon: '/favicon.ico',
      shortcut: '/favicon.ico',
      apple: '/favicon.ico',
    },
    metadataBase: baseUrl ? new URL(baseUrl) : null,
    alternates: baseUrl ? {
      canonical: currentUrl,
      languages: getAlternateLinks('/editor'),
    } : undefined,
    openGraph: {
      type: 'website',
      locale: locale === 'zh' ? 'zh_CN' : 'en_US',
      url: currentUrl,
      title: t('title'),
      description: t('description'),
      siteName: 'Editf',
      images: baseUrl ? [
        {
          url: `${baseUrl}/images/home-og.png`,
          width: 1200,
          height: 630,
          alt: t('title'),
        },
      ] : [],
    },
    twitter: {
      card: 'summary_large_image',
      title: t('title'),
      description: t('description'),
      creator: '@zyailive',
      images: baseUrl ? [`${baseUrl}/images/home-og.png`] : [],
    },
  }
}

export default function EditorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
