"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useTheme } from "next-themes"
import { useRouter, usePathname } from "next/navigation"
import { useLocale } from "next-intl"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { PricingDialog } from "@/components/pricing-dialog"
import { SignInDialog } from "@/components/auth/signin-dialog"
import { Edit, FolderOpen, LogOut, User, Sun, Moon, Globe, Sparkles } from "lucide-react"
import { signOut } from "next-auth/react"
import Image from "next/image"
import { useTranslations } from "next-intl"

interface SidebarProps {
  mobileOpen?: boolean
  onClose?: () => void
  onContentChange?: (content: 'editor' | 'projects') => void
  currentContent?: 'editor' | 'projects'
}

export function Sidebar({ mobileOpen, onClose, onContentChange, currentContent }: SidebarProps) {
  const { data: session, status } = useSession()
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [showLoginDialog, setShowLoginDialog] = useState(false)
  const router = useRouter()
  const pathname = usePathname()
  const locale = useLocale()
  const t = useTranslations("home")
  const tPricing = useTranslations("pricing")
  
  // 限时优惠倒计时
  
  useEffect(() => {
    setMounted(true)
  }, [])

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark")
  }

  const switchLocale = (newLocale: string) => {
    if (!pathname) return
    const newPath = pathname.replace(`/${locale}`, `/${newLocale}`)
    const hash = typeof window !== 'undefined' ? window.location.hash : ''
    router.push(newPath + hash)
  }


  const handleLogout = async () => {
    await signOut({ callbackUrl: window.location.pathname })
  }

  const navigationItems = [
    {
      id: "editor",
      href: `/${locale}/editor`,
      icon: Edit,
      active: pathname === `/${locale}/editor` || pathname === `/${locale}` || pathname === "/"
    },
    {
      id: "projects",
      href: `/${locale}/projects`,
      icon: FolderOpen,
      active: pathname === `/${locale}/projects`
    }
  ]

  return (
    <>
      <div
        className={
          mobileOpen
            ? "fixed left-0 top-0 h-screen w-56 bg-background/95 backdrop-blur-md flex flex-col z-50"
            : "hidden md:fixed md:left-0 md:top-0 md:h-screen md:w-56 md:bg-background/95 md:backdrop-blur-md md:flex md:flex-col md:z-10"
        }
      >
        {/* mobile close button */}
        {mobileOpen && (
            <button
            onClick={() => {
              onClose?.()
              if (typeof document !== "undefined") document.body.style.overflow = ""
            }}
            className="md:hidden absolute top-3 right-3 w-8 h-8 rounded-full bg-background/80 flex items-center justify-center z-60"
            aria-label={t("sidebar.close")}
          >
            <svg className="w-4 h-4 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M6 18L18 6M6 6l12 12" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
        {/* Logo Section */}
        <div className="flex items-center justify-between pt-12 px-4 pb-6 flex-shrink-0">
          <div className="flex items-center gap-3">
            <Image
              src="/logo.png"
              alt="Editf"
              width={32}
              height={32}
              className="object-contain"
            />
            <h1 className="text-xl font-bold text-primary">{t("sidebar.title")}</h1>
          </div>

          {/* Theme and Language Controls */}
          <div className="flex items-center gap-2">
            {/* Language Switcher */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-primary hover:bg-secondary/50 transition-all duration-200 p-2"
                >
                  <Globe className="h-4 w-4 text-primary" />
                  <span className="sr-only">{t("sidebar.switchLanguage")}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-32 bg-background border border-border shadow-xl">
                <DropdownMenuItem
                  onClick={() => switchLocale("zh")}
                  className={`hover:bg-secondary/50 hover:text-primary cursor-pointer justify-center ${
                    locale === "zh"
                      ? "bg-primary/10 text-primary border border-primary/20 rounded-full px-3 py-1 mx-1"
                      : ""
                  }`}
                >
                  {t("sidebar.chinese")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => switchLocale("en")}
                  className={`hover:bg-secondary/50 hover:text-primary cursor-pointer justify-center ${
                    locale === "en"
                      ? "bg-primary/10 text-primary border border-primary/20 rounded-full px-3 py-1 mx-1"
                      : ""
                  }`}
                >
                  {t("sidebar.english")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Theme Toggle */}
            {mounted && (
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleTheme}
                className="text-muted-foreground hover:text-primary hover:bg-secondary/50 transition-all duration-200 p-2"
              >
                <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0 text-primary" />
                <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100 text-primary" />
                <span className="sr-only">{t("sidebar.toggleTheme")}</span>
              </Button>
            )}
          </div>
        </div>

        {/* Navigation Section */}
        <div className="flex-1 p-4 overflow-y-auto">
          <nav className="space-y-4">
            {navigationItems.map((item) => {
              const Icon = item.icon
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    router.push(item.href)
                    onClose?.()
                  }}
                  className={`
                    w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors text-base
                    ${item.active
                      ? "bg-primary/10 text-primary border border-primary/20"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }
                  `}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-base font-medium">{item.id === "editor" ? t("sidebar.nav.editor") : t("sidebar.nav.projects")}</span>
                </button>
              )
            })}
          </nav>
        </div>

        {/* User Section */}
        
        {/* 升级提示卡：在用户名上方显示（仅针对未订阅用户） */}
        {session && !(((session as any).user?.isSubscribed) || ((session as any).user?.subscription?.status === "active")) && (
          <div className="p-4">
            <div className="rounded-lg border border-border bg-secondary/5 p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="text-primary">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-foreground">{t("sidebar.upgradeTitle")}</p>
                </div>
              </div>
              <div className="mt-1">
                <p className="text-sm text-muted-foreground leading-snug">
                  {t("sidebar.upgradeDesc")}
                </p>
              </div>
              <div className="mt-3">
                <PricingDialog>
                  <button
                    className="w-full bg-primary text-primary-foreground py-2 rounded-full shadow-md hover:bg-primary/90 text-center"
                  >
                    {t("sidebar.upgradeBtn")}
                  </button>
                </PricingDialog>
              </div>
            </div>
          </div>
        )}
        <div className="p-4 flex-shrink-0">
          {status === "loading" ? (
            <div className="animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-muted rounded-full"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-muted rounded"></div>
                  <div className="h-2 bg-muted rounded w-3/4"></div>
                </div>
              </div>
            </div>
          ) : session?.user ? (
            <div className="space-y-3">
              {/* User Info */}
              <div className="flex items-center gap-3">
                <Avatar className="w-8 h-8">
                  <AvatarImage src={session.user.image || ""} />
                  <AvatarFallback>
                    {session.user.name?.[0] || session.user.email?.[0] || "U"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {session.user.name ?? t("sidebar.user")}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {session.user.email}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => {
                    if (typeof window !== "undefined") {
                      const url = `/${locale}/profile`
                      window.open(url, "_blank")
                    }
                  }}
                >
                  <User className="w-3 h-3 mr-1" />
                  {t("sidebar.profile")}
                </Button>
              <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLogout}
                  className="px-2"
                >
                  <LogOut className="w-3 h-3" />
                </Button>
              </div>
            </div>
          ) : (
            <Button
              onClick={() => setShowLoginDialog(true)}
              className="w-full flex items-center justify-center"
            >
              <User className="w-5 h-5 mr-1 text-foreground" />
              <span className="text-sm font-medium text-foreground">{t("sidebar.login")}</span>
            </Button>
          )}
        </div>
        {/* collapse handle removed */}
      </div>

      {/* Login Dialog */}
      <SignInDialog
        open={showLoginDialog}
        onOpenChange={setShowLoginDialog}
      />
    </>
  )
}
