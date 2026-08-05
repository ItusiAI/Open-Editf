"use client"

import { useState, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"
import { useTranslations, useLocale } from "next-intl"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { ChatSidebar } from "@/components/chat-sidebar"
import { ChatInterface } from "@/components/chat-interface"
import { TooltipProvider } from "@/components/ui/tooltip"
import { MessageSquare } from "lucide-react"
import { SignInDialog } from "@/components/auth/signin-dialog"

interface ChatLayoutClientProps {
  sessionId?: string
}

export function ChatLayoutClient({ sessionId }: ChatLayoutClientProps) {
  const { data: session, status } = useSession()
  const t = useTranslations("metadata.chat")
  const locale = useLocale()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [sessions, setSessions] = useState<{ id: string; title: string; type?: string }[]>([])
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(sessionId ?? null)
  const [showSignInDialog, setShowSignInDialog] = useState(false)
  const [initialPrompt, setInitialPrompt] = useState<string | null>(null)
  const [initialContentType, setInitialContentType] = useState<"image" | "video">("image")
  const [initialModel, setInitialModel] = useState<string | undefined>()
  const [initialAspectRatio, setInitialAspectRatio] = useState<string | undefined>()
  const [initialResolution, setInitialResolution] = useState<string | undefined>()
  const [initialVideoDuration, setInitialVideoDuration] = useState<number | undefined>()
  const [initialVideoGenerateMode, setInitialVideoGenerateMode] = useState<string | undefined>()

  // 同步 URL 中的 sessionId
  useEffect(() => {
    if (sessionId) {
      setCurrentSessionId(sessionId)
    }
  }, [sessionId])

  useEffect(() => {
    const prompt = searchParams?.get("prompt")
    if (!prompt) return

    setInitialPrompt(prompt)
    const mode = searchParams.get("mode")
    const model = searchParams.get("model")
    const aspectRatio = searchParams.get("aspectRatio")
    const resolution = searchParams.get("resolution")
    const duration = searchParams.get("duration")
    const videoMode = searchParams.get("videoMode")

    setInitialContentType(mode === "video" ? "video" : "image")
    setInitialModel(model || undefined)
    setInitialAspectRatio(aspectRatio || undefined)
    setInitialResolution(resolution || undefined)
    setInitialVideoDuration(duration ? Number(duration) : undefined)
    setInitialVideoGenerateMode(videoMode || undefined)
  }, [searchParams])

  // 更新浏览器标题
  useEffect(() => {
    if (currentSessionId) {
      const session = sessions.find((s) => s.id === currentSessionId)
      if (session) {
        document.title = `${session.title} - Editf`
      }
    } else {
      document.title = t("title")
    }
  }, [currentSessionId, sessions, t])

  const fetchSessions = useCallback(async () => {
    if (status !== "authenticated") return
    try {
      const res = await fetch("/api/chat/sessions")
      if (res.ok) {
        const json = await res.json()
        setSessions(json.data || [])
      }
    } catch (err) {
      console.error("fetch sessions error:", err)
    }
  }, [status])

  useEffect(() => {
    if (status === "authenticated") fetchSessions()
  }, [status, fetchSessions])

  const createSession = async () => {
    if (status !== "authenticated") {
      setShowSignInDialog(true)
      return
    }
    try {
      const res = await fetch("/api/chat/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale }),
      })
      if (res.ok) {
        const json = await res.json()
        const newSession = json.data
        setSessions((prev) => [newSession, ...prev])
        router.push(`/${locale}/chat/${newSession.id}`)
      }
    } catch (err) {
      console.error("create session error:", err)
    }
  }

  const onSessionCreated = (newSession: { id: string; title: string; type?: string }) => {
    setSessions((prev) => {
      if (prev.find((s) => s.id === newSession.id)) return prev
      return [newSession, ...prev]
    })
    setCurrentSessionId(newSession.id)
  }

  const deleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      const res = await fetch(`/api/chat/sessions/${sessionId}`, { method: "DELETE" })
      if (res.ok) {
        setSessions((prev) => prev.filter((s) => s.id !== sessionId))
        if (currentSessionId === sessionId) {
          setCurrentSessionId(null)
          router.push(`/${locale}/chat`)
        }
      }
    } catch (err) {
      console.error("delete session error:", err)
    }
  }

  const selectSession = (sessionId: string) => {
    router.push(`/${locale}/chat/${sessionId}`)
  }

  return (
    <TooltipProvider>
    <div className="flex h-dvh min-h-0 overflow-hidden bg-background">
      <button
        className="md:hidden fixed left-3 top-3 z-40 w-10 h-10 rounded-full bg-secondary/10 flex items-center justify-center"
        onClick={() => setMobileOpen(true)}
        aria-label={t("sidebar.openChatList")}
      >
        <MessageSquare className="w-5 h-5 text-primary" />
      </button>

      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <div
        className={mobileOpen ? "fixed left-0 top-0 h-screen z-40 md:hidden" : "hidden md:block"}
      >
        <ChatSidebar
          sessions={sessions}
          currentSessionId={currentSessionId}
          onSelectSession={selectSession}
          onDeleteSession={deleteSession}
          onNewSession={createSession}
          mobileOpen={mobileOpen}
          onClose={() => setMobileOpen(false)}
        />
      </div>

      <div className="flex min-h-0 flex-1 flex-col ml-0 md:ml-56 pt-10 md:pt-0">
        <div className="flex min-h-0 flex-1 flex-col max-w-2xl w-full mx-auto px-2 md:px-0">
          <ChatInterface
            currentSessionId={currentSessionId}
            onSessionCreated={onSessionCreated}
            initialPrompt={initialPrompt ?? undefined}
            initialContentType={initialContentType}
            initialModel={initialModel}
            initialAspectRatio={initialAspectRatio}
            initialResolution={initialResolution}
            initialVideoDuration={initialVideoDuration}
            initialVideoGenerateMode={initialVideoGenerateMode}
          />
        </div>
      </div>

      <SignInDialog open={showSignInDialog} onOpenChange={setShowSignInDialog} />
    </div>
    </TooltipProvider>
  )
}
