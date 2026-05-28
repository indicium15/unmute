import { useState, useCallback, useEffect } from "react"
import { InputPanel } from "@/components/InputPanel"
import { OutputPanel } from "@/components/OutputPanel"
import { LoginPage } from "@/components/LoginPage"
import { AdminPage } from "@/components/AdminPage"
import { LearningPage } from "@/components/LearningPage"
import { DictionaryPage } from "@/components/DictionaryPage"
import { HomePage } from "@/components/HomePage"
import { AppNavbar, type NavMode } from "@/components/AppNavbar"
import { useTranslation, type TranslationResult } from "@/hooks/useTranslation"
import { useSignPlayback } from "@/hooks/useSignPlayback"
import { useAuth } from "@/contexts/useAuth"
import { Shield, GraduationCap, Home, BookOpen } from "lucide-react"
import { cn } from "@/lib/utils"

type AppMode = NavMode

const NAV_ITEMS = [
  { mode: "translate" as AppMode, path: "/translate", label: "Home", Icon: Home },
  { mode: "dictionary" as AppMode, path: "/dictionary", label: "Dictionary", Icon: BookOpen },
  { mode: "learn" as AppMode, path: "/learn", label: "Learn SgSL", Icon: GraduationCap },
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
  const { user, loading, logout, approvalStatus, isAdmin } = useAuth()
  const [mode, setModeState] = useState<AppMode>(() => modeFromPath(window.location.pathname))
  const effectiveMode: AppMode = mode === "admin" && !isAdmin ? "translate" : mode
  const { result, setResult, isLoading, error, translate } = useTranslation()
  const { isPlaying, currentToken, currentGifUrl, currentPlaybackKey, playSequence, stopPlayback } = useSignPlayback()
  const [hasAttemptedTranslation, setHasAttemptedTranslation] = useState(false)

  useEffect(() => {
    if (window.location.pathname === "/" || !isKnownPath(window.location.pathname)) {
      window.history.replaceState(null, "", "/translate")
    }

    const handlePopState = () => setModeState(modeFromPath(window.location.pathname))
    window.addEventListener("popstate", handlePopState)
    return () => window.removeEventListener("popstate", handlePopState)
  }, [])

  const handleTranslate = useCallback(async (text: string) => {
    stopPlayback()
    const translationResult = await translate(text)
    if (translationResult && translationResult.plan.length > 0) {
      playSequence(translationResult.plan)
    }
    return translationResult
  }, [translate, playSequence, stopPlayback])

  const handleLandingTranslate = useCallback(async (text: string) => {
    setHasAttemptedTranslation(true)
    if (!text) return
    stopPlayback()
    const translationResult = await translate(text)
    if (translationResult && translationResult.plan.length > 0) {
      playSequence(translationResult.plan)
    }
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

  const setMode = (nextMode: AppMode) => {
    const nextPath = pathForMode(nextMode)
    if (window.location.pathname !== nextPath) {
      window.history.pushState(null, "", nextPath)
    }
    if (nextMode !== "translate") {
      setHasAttemptedTranslation(false)
    }
    setModeState(nextMode)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-[#6176f7] border-t-transparent animate-spin" />
          <p className="text-[#6a7282] text-sm">Loading…</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <LoginPage />
  }

  if (!isAdmin && approvalStatus === "pending") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white px-4">
        <div className="max-w-sm w-full text-center">
          <div className="w-16 h-16 rounded-full bg-amber-50 border-2 border-amber-200 flex items-center justify-center mx-auto mb-5">
            <svg className="w-8 h-8 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>
          <h2 className="text-2xl font-semibold text-[#101828] mb-2">Pending approval</h2>
          <p className="text-sm text-[#6a7282] leading-relaxed mb-6">
            Your account is awaiting admin approval. You'll receive access once an admin reviews your request.
          </p>
          <button
            onClick={logout}
            className="text-sm text-[#6a7282] hover:text-[#4a5565] transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    )
  }

  if (!isAdmin && approvalStatus === "revoked") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white px-4">
        <div className="max-w-sm w-full text-center">
          <div className="w-16 h-16 rounded-full bg-red-50 border-2 border-red-200 flex items-center justify-center mx-auto mb-5">
            <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 715.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          </div>
          <h2 className="text-2xl font-semibold text-[#101828] mb-2">Access revoked</h2>
          <p className="text-sm text-[#6a7282] leading-relaxed mb-6">
            Your access to this application has been revoked. Please contact an admin if you believe this is a mistake.
          </p>
          <button
            onClick={logout}
            className="text-sm text-[#6a7282] hover:text-[#4a5565] transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    )
  }

  if (effectiveMode === "dictionary") {
    return (
      <DictionaryPage
        onNavigate={(dest) => setMode(dest === "home" ? "translate" : dest)}
        onSignOut={logout}
        isAdmin={isAdmin}
      />
    )
  }

  if (effectiveMode === "learn") {
    return (
      <LearningPage
        onNavigate={(dest) => setMode(dest === "home" ? "translate" : dest)}
        onSignOut={logout}
        isAdmin={isAdmin}
      />
    )
  }

  if (effectiveMode === "translate" && !hasAttemptedTranslation) {
    return (
      <HomePage
        onNavigate={(dest) => setMode(dest)}
        onTranslate={handleLandingTranslate}
        onVoiceResult={(voiceResult) => {
          setHasAttemptedTranslation(true)
          handleVoiceResult(voiceResult)
        }}
        onLogout={logout}
        isAdmin={isAdmin}
      />
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#f9fafb]">
      <AppNavbar
        activeMode={effectiveMode}
        onNavigate={setMode}
        onLogout={logout}
        isAdmin={isAdmin}
      />

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

        {effectiveMode === "admin" && (
          <div className="animate-fade-in-up">
            <AdminPage />
          </div>
        )}
      </main>

      <nav className="sm:hidden fixed bottom-0 inset-x-0 z-50 bg-white/95 backdrop-blur-md border-t border-gray-100 shadow-[0_-1px_8px_rgba(0,0,0,0.06)]">
        <div className="flex overflow-x-auto">
          {(isAdmin ? [...NAV_ITEMS, { mode: "admin" as AppMode, path: "/admin", label: "Admin", Icon: Shield }] : NAV_ITEMS).map(({ mode: m, label, Icon }) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={cn(
                "min-w-[72px] flex-1 flex flex-col items-center justify-center gap-1 py-3 transition-all duration-200",
                effectiveMode === m ? "text-[#6176f7]" : "text-[#6a7282]"
              )}
            >
              <Icon className={cn("w-5 h-5 transition-transform duration-200", effectiveMode === m && "scale-110")} />
              <span className="text-[10px] font-medium tracking-wide">{label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  )
}

export default App
