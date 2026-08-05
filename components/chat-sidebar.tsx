"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useTheme } from "next-themes"
import { useLocale } from "next-intl"
import { useRouter, usePathname } from "next/navigation"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { SignInDialog } from "@/components/auth/signin-dialog"
import {
  Plus, MessageSquare, Globe, Sun, Moon, User, Trash2, Sparkles, Timer,
  Image as ImageIcon, Video,
} from "lucide-react"
import Image from "next/image"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { PricingDialog } from "@/components/pricing-dialog"
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip"
import { signOut } from "next-auth/react"

interface ChatSidebarProps {
  sessions: { id: string; title: string; type?: string }[]
  currentSessionId: string | null
  onSelectSession: (id: string) => void
  onDeleteSession: (id: string, e: React.MouseEvent) => void
  onNewSession: () => void
  mobileOpen?: boolean
  onClose?: () => void
}

export function ChatSidebar({
  sessions,
  currentSessionId,
  onSelectSession,
  onDeleteSession,
  onNewSession,
  mobileOpen,
  onClose,
}: ChatSidebarProps) {
  const { data: session, status } = useSession()
  const { theme, setTheme } = useTheme()
  const locale = useLocale()
  const router = useRouter()
  const pathname = usePathname()
  const tHome = useTranslations("home")
  const tPricing = useTranslations("pricing")
  const [mounted, setMounted] = useState(false)
  const [showSignInDialog, setShowSignInDialog] = useState(false)

  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 })

  useEffect(() => {
    setMounted(true)
    const endDate = new Date('2026-04-30T23:59:59')
    const calculateTimeLeft = () => {
      const now = new Date()
      const difference = endDate.getTime() - now.getTime()
      if (difference > 0) {
        const days = Math.floor(difference / (1000 * 60 * 60 * 24))
        const hours = Math.floor((difference / (1000 * 60 * 60)) % 24)
        const minutes = Math.floor((difference / 1000 / 60) % 60)
        const seconds = Math.floor((difference / 1000) % 60)
        return { days, hours, minutes, seconds }
      }
      return { days: 0, hours: 0, minutes: 0, seconds: 0 }
    }
    setTimeLeft(calculateTimeLeft())
    const timer = setInterval(() => setTimeLeft(calculateTimeLeft()), 1000)
    return () => clearInterval(timer)
  }, [])

  const switchLocale = (newLocale: string) => {
    if (!pathname) return
    const newPath = pathname.replace(`/${locale}`, `/${newLocale}`)
    const hash = typeof window !== "undefined" ? window.location.hash : ""
    router.push(newPath + hash)
  }

  const handleLogout = async () => {
    await signOut({ callbackUrl: window.location.pathname })
  }

  return (
    <TooltipProvider>
      <div className="fixed left-0 top-0 h-screen w-56 bg-background/95 backdrop-blur-md flex flex-col z-10">
        {/* mobile close button */}
        {mobileOpen && (
          <button
            onClick={() => {
              onClose?.()
              if (typeof document !== "undefined") document.body.style.overflow = ""
            }}
            className="md:hidden absolute top-3 right-3 w-8 h-8 rounded-full bg-background/80 flex items-center justify-center z-50"
            aria-label={tHome("sidebar.close")}
          >
            <svg className="w-4 h-4 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M6 18L18 6M6 6l12 12" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
        {/* Logo + 语言/主题 */}
        <div className="flex items-center justify-between pt-12 px-4 pb-6 flex-shrink-0">
          <div className="flex items-center gap-3">
            <Image src="/logo.png" alt="Editf" width={32} height={32} className="object-contain" />
            <h1 className="text-xl font-bold text-primary">Editf</h1>
          </div>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-primary hover:bg-secondary/50 transition-all duration-200 p-2"
                >
                  <Globe className="h-4 w-4 text-primary" />
                  <span className="sr-only">{tHome("sidebar.switchLanguage")}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-32 bg-background border border-border shadow-xl">
                <DropdownMenuItem
                  onClick={() => switchLocale("zh")}
                  className={cn(
                    "hover:bg-secondary/50 hover:text-primary cursor-pointer justify-center",
                    locale === "zh" && "bg-primary/10 text-primary border border-primary/20 rounded-full px-3 py-1 mx-1"
                  )}
                >
                  {tHome("sidebar.chinese")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => switchLocale("en")}
                  className={cn(
                    "hover:bg-secondary/50 hover:text-primary cursor-pointer justify-center",
                    locale === "en" && "bg-primary/10 text-primary border border-primary/20 rounded-full px-3 py-1 mx-1"
                  )}
                >
                  {tHome("sidebar.english")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {mounted && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className="text-muted-foreground hover:text-primary hover:bg-secondary/50 transition-all duration-200 p-2"
              >
                <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0 text-primary" />
                <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100 text-primary" />
                  <span className="sr-only">{tHome("sidebar.toggleTheme")}</span>
              </Button>
            )}
          </div>
        </div>

        <div className="px-4 pb-3 flex-shrink-0">
          <Button onClick={onNewSession} className="w-full gap-2">
            <Plus className="w-4 h-4" />
            <span>{tHome("sidebar.newChat")}</span>
          </Button>
        </div>

        {/* 会话列表 */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="p-2 space-y-1">
            {sessions.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">
                {tHome("sidebar.noChats")}
              </p>
            )}
            {sessions.map((s) => {
              const IconComponent = s.type === "video" ? Video : s.type === "image" ? ImageIcon : MessageSquare
              return (
                <Tooltip key={s.id}>
                  <TooltipTrigger asChild>
                    <div
                      onClick={() => onSelectSession(s.id)}
                      className={cn(
                        "group relative flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors text-sm",
                        currentSessionId === s.id
                          ? "bg-primary/10 text-primary"
                          : "hover:bg-muted text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <IconComponent className="w-4 h-4 flex-shrink-0" />
                      <span className="flex-1 truncate">{s.title}</span>
                      <button
                        onClick={(e) => onDeleteSession(s.id, e)}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:text-destructive transition-opacity flex-shrink-0"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-xs">
                    <p>{s.title}</p>
                  </TooltipContent>
                </Tooltip>
              )
            })}
          </div>
        </ScrollArea>

        {/* 升级提示卡：在用户名上方显示（仅针对未订阅用户） */}
        {session && !(((session as any).user?.isSubscribed) || ((session as any).user?.subscription?.status === "active")) && (
          <div className="px-4 py-3 flex-shrink-0">
            <div className="rounded-lg border border-border bg-secondary/5 p-3 shadow-sm">
              <div className="flex items-start gap-2">
                <div className="text-primary mt-0.5">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-foreground text-sm">{tHome("sidebar.upgradeTitle")}</p>
                </div>
              </div>
              <div className="mt-1">
                <p className="text-xs text-muted-foreground leading-snug">
                  {tHome("sidebar.upgradeDesc")}
                </p>
              </div>
              <div className="mt-2">
                <PricingDialog>
                  <button className="w-full bg-primary text-primary-foreground py-1.5 rounded-full shadow-md hover:bg-primary/90 text-center text-sm">
                    {tHome("sidebar.upgradeBtn")}
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
              <div className="flex items-center gap-3">
                <Avatar className="w-8 h-8">
                  <AvatarImage src={session.user.image || ""} />
                  <AvatarFallback>
                    {session.user.name?.[0] || session.user.email?.[0] || "U"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {session.user.name ?? tHome("sidebar.user")}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {session.user.email}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => {
                    if (typeof window !== "undefined") {
                      window.open(`/${locale}/profile`, "_blank")
                    }
                  }}
                >
                  <User className="w-3 h-3 mr-1" />
                  {tHome("sidebar.profile")}
                </Button>
                <Button variant="outline" size="sm" onClick={handleLogout} className="px-2">
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <polyline points="16 17 21 12 16 7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <line x1="21" y1="12" x2="9" y2="12" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Button>
              </div>
            </div>
          ) : (
            <Button onClick={() => setShowSignInDialog(true)} className="w-full flex items-center justify-center">
              <User className="w-5 h-5 mr-1 text-foreground" />
              <span className="text-sm font-medium text-foreground">{tHome("sidebar.login")}</span>
            </Button>
          )}
        </div>
      </div>

      <SignInDialog open={showSignInDialog} onOpenChange={setShowSignInDialog} />
    </TooltipProvider>
  )
}
