import { redirect } from "next/navigation"
import LandingPage from "@/components/landing/landing-page"

interface PageProps {
  params: Promise<{ locale: string }>
}

export default async function HomePage({ params }: PageProps) {
  const { locale } = await params
  const validLocales = ['en', 'zh']
  
  if (!validLocales.includes(locale)) {
    redirect("/en")
  }
  
  return <LandingPage locale={locale} />
}
