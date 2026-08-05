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

  const t = await getTranslations({ locale, namespace: 'metadata.prompts' })
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || ''
  const currentUrl = getFullUrl('/prompts', locale)

  return {
    title: t('title'),
    description: t('description'),
    keywords: locale === 'zh'
      ? 'AI Prompt,AI灵感库,Prompt模板,AI创作提示词,图片生成提示词,视频生成提示词,AI绘图模板,创意提示词'
      : 'AI Prompt,AI Inspiration Library,Prompt Templates,AI Creation Prompts,Image Generation Prompts,Video Generation Prompts,AI Drawing Templates,Creative Prompts',
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
      languages: getAlternateLinks('/prompts'),
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

export default function PromptsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
