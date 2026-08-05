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

  const t = await getTranslations({ locale, namespace: 'metadata.chat' })
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || ''
  const currentUrl = getFullUrl('/chat', locale)

  return {
    title: t('title'),
    description: t('description'),
    keywords: locale === 'zh'
      ? 'AI图片生成,AI图片编辑,AI对话生成,智能聊天创作,文本生成图片,图片风格转换,图像增强,AI绘画,智能编辑,AI艺术创作,图片修复,照片编辑,创意工具,数字艺术,对话式AI创作,AI绘图'
      : 'AI image generation,AI image editing,AI chat generation,smart chat creation,text to image,image style transfer,image enhancement,AI painting,intelligent editing,AI art creation,image restoration,photo editing,creative tools,digital art,conversational AI creation,AI drawing',
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
      languages: getAlternateLinks('/chat'),
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

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
