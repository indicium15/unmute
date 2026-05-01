import { useState, useCallback, useEffect } from "react"
import { InputPanel } from "@/components/InputPanel"
import { OutputPanel } from "@/components/OutputPanel"
import { LoginPage } from "@/components/LoginPage"
import { AdminPage } from "@/components/AdminPage"
import { LearningPage } from "@/components/LearningPage"
import { AboutPage } from "@/components/AboutPage"
import { ReleaseNotesPage } from "@/components/ReleaseNotesPage"
import { useTranslation, type TranslationResult } from "@/hooks/useTranslation"
import { useSignPlayback } from "@/hooks/useSignPlayback"
import { useAuth } from "@/contexts/useAuth"
import { Button } from "@/components/ui/button"
import { MessageSquare, LogOut, Shield, GraduationCap, Info, Github, Newspaper } from "lucide-react"
import { cn } from "@/lib/utils"

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000"
const GITHUB_URL = "https://github.com/indicium15/unmute"

type AppMode = "translate" | "learn" | "release-notes" | "about" | "admin"

const NAV_ITEMS = [
  { mode: "translate" as AppMode, path: "/translate", label: "Translate", Icon: MessageSquare },
  { mode: "learn" as AppMode, path: "/learn", label: "Learn", Icon: GraduationCap },
  { mode: "release-notes" as AppMode, path: "/release-notes", label: "Release Notes", Icon: Newspaper },
  { mode: "about" as AppMode, path: "/about", label: "About", Icon: Info },
]

function modeFromPath(pathname: string): AppMode {
  const mode = NAV_ITEMS.find((item) => item.path === pathname)?.mode
  if (mode) return mode
  if (pathname === "/admin") return "admin"
  return "translate"
}

function pathForMode(mode: AppMode) {
  if (mode === "admin") return "/admin"
  return NAV_ITEMS.find((item) => item.mode === mode)?.path ?? "/translate"
}

function isKnownPath(pathname: string) {
  return pathname === "/admin" || NAV_ITEMS.some((item) => item.path === pathname)
}

function App() {
  const { user, loading, logout } = useAuth()
  const [mode, setModeState] = useState<AppMode>(() => modeFromPath(window.location.pathname))
  const [_isAdmin, setIsAdmin] = useState(false)
  // Derive so we never need to call setState synchronously inside an effect
  const isAdmin = user ? _isAdmin : false
  const effectiveMode: AppMode = mode === "admin" && !isAdmin ? "translate" : mode
  const { result, setResult, isLoading, error, translate } = useTranslation()
  const { isPlaying, currentToken, currentGifUrl, currentPlaybackKey, playSequence, stopPlayback } = useSignPlayback()

  useEffect(() => {
    if (window.location.pathname === "/" || !isKnownPath(window.location.pathname)) {
      window.history.replaceState(null, "", "/translate")
    }

    const handlePopState = () => setModeState(modeFromPath(window.location.pathname))
    window.addEventListener("popstate", handlePopState)
    return () => window.removeEventListener("popstate", handlePopState)
  }, [])

  useEffect(() => {
    if (!user) return
    user.getIdToken().then((token) =>
      fetch(`${API_BASE_URL}/api/admin/check`, {
        headers: { Authorization: `Bearer ${token}` },
      })
    ).then((r) => r.json())
     .then((data: { is_admin?: boolean }) => setIsAdmin(data.is_admin === true))
     .catch(() => setIsAdmin(false))
  }, [user])

  const handleTranslate = useCallback(async (text: string) => {
    stopPlayback()
    const translationResult = await translate(text)
    if (translationResult && translationResult.plan.length > 0) {
      playSequence(translationResult.plan)
    }
    return translationResult
  }, [translate, playSequence, stopPlayback])

  const handleVoiceResult = useCallback((voiceResult: TranslationResult) => {
    stopPlayback()
    setResult(voiceResult)
    if (voiceResult.plan.length > 0) {
      playSequence(voiceResult.plan)
    }
  }, [setResult, playSequence, stopPlayback])

  const handleReplay = useCallback(() => {
    if (result && result.plan.length > 0) playSequence(result.plan)
  }, [result, playSequence])

  const navItems = isAdmin
    ? [...NAV_ITEMS, { mode: "admin" as AppMode, path: "/admin", label: "Admin", Icon: Shield }]
    : NAV_ITEMS

  const isActiveMode = (m: AppMode) => m === effectiveMode
  const setMode = (nextMode: AppMode) => {
    const nextPath = pathForMode(nextMode)
    if (window.location.pathname !== nextPath) {
      window.history.pushState(null, "", nextPath)
    }
    setModeState(nextMode)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-warm">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-accent-terracotta border-t-transparent animate-spin" />
          <p className="text-text-muted text-sm">Loading…</p>
        </div>
      </div>
    )
  }

  if (!user) return <LoginPage />

  return (
    <div className="min-h-screen flex flex-col bg-bg-warm">
      <div className="sticky top-0 z-40 bg-bg-warm/90 backdrop-blur-md border-b border-border-soft">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <span className="font-serif text-2xl font-bold leading-none flex-shrink-0">
            un<span className="text-gradient">mute</span>
          </span>

          <nav className="hidden sm:flex items-center gap-1 p-1 bg-bg-input rounded-[14px] border border-border-soft">
            {navItems.map(({ mode: m, label, Icon }) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={cn(
                  "inline-flex items-center gap-2 px-4 py-2 rounded-[10px] text-sm font-medium transition-all duration-200",
                  isActiveMode(m)
                    ? "bg-bg-card text-accent-terracotta shadow-[0_1px_8px_rgba(0,0,0,0.4)]"
                    : "text-text-muted hover:text-text-secondary hover:bg-bg-card/50"
                )}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-1 flex-shrink-0">
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center w-9 h-9 rounded-[10px] text-text-muted hover:text-text-secondary hover:bg-bg-input transition-all duration-200"
              title="View on GitHub"
            >
              <Github className="w-4 h-4" />
            </a>
            <Button
              variant="ghost"
              size="icon"
              onClick={logout}
              title="Sign out"
              className="text-text-muted hover:text-text-secondary w-9 h-9"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      <main className="flex-1 max-w-[1440px] mx-auto w-full px-4 sm:px-6 pt-5 pb-24 sm:pb-8">
        {effectiveMode === "translate" && (
          <div className="animate-fade-in-up">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-stretch">
              <InputPanel
                onTranslate={handleTranslate}
                onVoiceResult={handleVoiceResult}
                isLoading={isLoading}
                error={error}
                result={result}
              />
              <OutputPanel
                plan={result?.plan || []}
                currentToken={currentToken}
                currentGifUrl={currentGifUrl}
                currentPlaybackKey={currentPlaybackKey}
                isPlaying={isPlaying}
                onReplay={handleReplay}
                logDocId={result?.log_doc_id}
              />
            </div>
          </div>
        )}

        {effectiveMode === "learn" && (
          <div className="animate-fade-in-up">
            <LearningPage />
          </div>
        )}

        {effectiveMode === "about" && (
          <div className="animate-fade-in-up">
            <AboutPage />
          </div>
        )}

        {effectiveMode === "release-notes" && (
          <div className="animate-fade-in-up">
            <ReleaseNotesPage />
          </div>
        )}

        {effectiveMode === "admin" && (
          <div className="animate-fade-in-up">
            <AdminPage />
          </div>
        )}
      </main>

      <nav className="sm:hidden fixed bottom-0 inset-x-0 z-50 bg-bg-card/95 backdrop-blur-md border-t border-border-soft">
        <div className="flex overflow-x-auto">
          {navItems.map(({ mode: m, label, Icon }) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={cn(
                "min-w-[72px] flex-1 flex flex-col items-center justify-center gap-1 py-3 transition-all duration-200",
                isActiveMode(m) ? "text-accent-terracotta" : "text-text-muted"
              )}
            >
              <Icon className={cn("w-5 h-5 transition-transform duration-200", isActiveMode(m) && "scale-110")} />
              <span className="text-[10px] font-medium tracking-wide">{label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  )
}

export default App
