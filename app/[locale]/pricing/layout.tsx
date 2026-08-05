import type React from "react"
import { getTranslations } from 'next-intl/server'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"

interface PricingLayoutProps {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}

export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const locales = ['en', 'zh']
  if (!locales.includes(locale)) {
    notFound()
  }

  const t = await getTranslations({ locale, namespace: 'metadata.pricing' })
  
  return {
    title: t('title'),
    description: t('description')
  }
}

export default async function PricingLayout({ children, params }: PricingLayoutProps) {
  const { locale } = await params
  const locales = ['en', 'zh']
  if (!locales.includes(locale)) {
    notFound()
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main>{children}</main>
      <Footer />
    </div>
  )
}
