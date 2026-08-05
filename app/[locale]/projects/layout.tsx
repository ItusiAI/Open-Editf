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

  const t = await getTranslations({ locale, namespace: 'metadata.projects' })
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || ''
  const currentUrl = getFullUrl('/projects', locale)

  return {
    title: t('title'),
    description: t('description'),
    keywords: locale === 'zh'
      ? 'AI项目,图片历史,视频历史,编辑记录,AI创作,创意作品集,AI艺术画廊,生成记录,项目管理,数字作品,AI图像库,创作历史,作品管理,数字艺术收藏'
      : 'AI projects,image history,video history,edit records,AI creation,creative portfolio,AI art gallery,generation records,project management,digital artwork,AI image library,creative history,artwork management,digital art collection',
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
      languages: getAlternateLinks('/projects'),
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

export default function ProjectsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
