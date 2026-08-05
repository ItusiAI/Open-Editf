"use client"

import { useState, useEffect } from "react"
import { useTranslations } from "next-intl"
import { Sidebar } from "@/components/sidebar"

interface AppLayoutProps {
  children: React.ReactNode
}

export function AppLayout({ children }: AppLayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const t = useTranslations("home")

  useEffect(() => {
    if (!mobileOpen && typeof document !== "undefined") {
      document.body.style.overflow = ""
    }
  }, [mobileOpen])

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
      />

      {/* mobile menu button */}
      <button
        className="md:hidden fixed left-3 top-3 z-40 w-10 h-10 rounded-full bg-secondary/10 flex items-center justify-center"
        onClick={() => {
          setMobileOpen(true)
          // lock body scroll
          if (typeof document !== "undefined") {
            document.body.style.overflow = "hidden"
          }
        }}
        aria-label={t("sidebar.open")}
      >
        <svg className="w-5 h-5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M3 12h18" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M3 6h18" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M3 18h18" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* mobile overlay when sidebar open */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 md:hidden"
        onClick={() => {
          setMobileOpen(false)
        }}
          aria-hidden
        />
      )}

      <div className="flex-1 grid place-items-start min-h-screen ml-0 md:ml-56 pt-10">
        {children}
      </div>
    </div>
  )
}
