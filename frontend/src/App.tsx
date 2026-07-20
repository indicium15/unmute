import { useState, useCallback, useEffect } from "react"
import { TranslatePage } from "@/components/TranslatePage"
import { LoginPage } from "@/components/LoginPage"
import { AdminPage } from "@/components/AdminPage"
import { LearningPage } from "@/components/LearningPage"
import { DictionaryPage } from "@/components/DictionaryPage"
import { HomePage } from "@/components/HomePage"
import { AppNavbar, type NavMode } from "@/components/AppNavbar"
import { useTranslation, type TranslationResult } from "@/hooks/useTranslation"
import { useAuth } from "@/contexts/useAuth"
import { Shield, GraduationCap, Home, BookOpen, Languages } from "lucide-react"
import { cn } from "@/lib/utils"

type AppMode = NavMode | "login"

const NAV_ITEMS = [
  { mode: "home" as AppMode, path: "/home", label: "Home", Icon: Home },
  { mode: "translate" as AppMode, path: "/translate", label: "Translate", Icon: Languages },
  { mode: "dictionary" as AppMode, path: "/dictionary", label: "Dictionary", Icon: BookOpen },
  { mode: "learn" as AppMode, path: "/learn", label: "Learn SgSL", Icon: GraduationCap },
]

function modeFromPath(pathname: string): AppMode {
  if (pathname === "/login") return "login"
  if (pathname === "/translate") return "translate"
  const mode = NAV_ITEMS.find((item) => item.path === pathname)?.mode
  if (mode) return mode
  if (pathname === "/admin") return "admin"
  return "home"
}

function pathForMode(mode: AppMode) {
  if (mode === "login") return "/login"
  if (mode === "admin") return "/admin"
  if (mode === "translate") return "/translate"
  return NAV_ITEMS.find((item) => item.mode === mode)?.path ?? "/home"
}

function isKnownPath(pathname: string) {
  return pathname === "/login" || pathname === "/admin" || pathname === "/translate" || NAV_ITEMS.some((item) => item.path === pathname)
}

function App() {
  const { user, loading, logout, approvalStatus, isAdmin } = useAuth()
  const [mode, setModeState] = useState<AppMode>(() => modeFromPath(window.location.pathname))
  const effectiveMode: AppMode = mode === "admin" && !isAdmin ? "home" : mode
  const { result, setResult, isLoading, error, retryAfter, translate } = useTranslation()
  const [pendingInput, setPendingInput] = useState<string | undefined>(undefined)
  const [pendingDictionaryToken, setPendingDictionaryToken] = useState<string | undefined>(undefined)

  useEffect(() => {
    if (window.location.pathname === "/" || !isKnownPath(window.location.pathname)) {
      window.history.replaceState(null, "", "/home")
    }

    const handlePopState = () => setModeState(modeFromPath(window.location.pathname))
    window.addEventListener("popstate", handlePopState)
    return () => window.removeEventListener("popstate", handlePopState)
  }, [])

  // When user signs out, always redirect to home from protected pages.
  useEffect(() => {
    if (!loading && !user && (mode === "admin" || mode === "learn")) {
      window.history.replaceState(null, "", "/home")
      setModeState("home")
    }
  }, [user, loading, mode])

  // Once authenticated, leave /login and continue to translate flow.
  useEffect(() => {
    if (!loading && user && mode === "login") {
      window.history.replaceState(null, "", "/translate")
      setModeState("translate")
    }
  }, [user, loading, mode])

  const handleTranslate = useCallback(async (text: string) => {
    return translate(text)
  }, [translate])

  const handleHomeTranslate = useCallback((text: string) => {
    if (!text.trim()) return
    setPendingInput(text.trim())
    const nextPath = "/translate"
    if (window.location.pathname !== nextPath) {
      window.history.pushState(null, "", nextPath)
    }
    setModeState("translate")
  }, [])

  const handleVoiceResult = useCallback((voiceResult: TranslationResult) => {
    setResult(voiceResult)
  }, [setResult])

  const handleHomeVoiceResult = useCallback((voiceResult: TranslationResult) => {
    setResult(voiceResult)
    if (voiceResult.transcription) {
      setPendingInput(voiceResult.transcription)
    }
    const nextPath = "/translate"
    if (window.location.pathname !== nextPath) {
      window.history.pushState(null, "", nextPath)
    }
    setModeState("translate")
  }, [setResult])

  const handleViewSignInDictionary = useCallback((token: string) => {
    setPendingDictionaryToken(token)
    const nextPath = "/dictionary"
    if (window.location.pathname !== nextPath) {
      window.history.pushState(null, "", nextPath)
    }
    setModeState("dictionary")
  }, [])

  const setMode = (nextMode: AppMode) => {
    // Redirect unauthenticated users to login for protected pages (only the
    // lessons page and admin require login; translate/dictionary are open)
    if ((nextMode === "admin" || nextMode === "learn") && !user) {
      const nextPath = "/login"
      if (window.location.pathname !== nextPath) {
        window.history.pushState(null, "", nextPath)
      }
      setModeState("login")
      return
    }
    const nextPath = pathForMode(nextMode)
    if (window.location.pathname !== nextPath) {
      window.history.pushState(null, "", nextPath)
    }
    setModeState(nextMode)
  }

  const handleLogout = useCallback(async () => {
    await logout()
  }, [logout])

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

  const authAction = user ? handleLogout : () => setMode("login")

  if (effectiveMode === "home") {
    return (
      <HomePage
        onNavigate={(dest) => setMode(dest)}
        onTranslate={handleHomeTranslate}
        onVoiceResult={user ? handleHomeVoiceResult : undefined}
        onLogout={authAction}
        isAdmin={isAdmin}
        isLoggedIn={!!user}
      />
    )
  }

  if (effectiveMode === "login") {
    return <LoginPage />
  }

  // Only the lessons ("learn") page and Admin require login; Translate and
  // Dictionary are accessible without an account.
  const requiresAuth = effectiveMode === "learn" || effectiveMode === "admin"

  if (requiresAuth && !user) {
    return <LoginPage />
  }

  if (requiresAuth && !isAdmin && approvalStatus === "pending") {
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
            onClick={handleLogout}
            className="text-sm text-[#6a7282] hover:text-[#4a5565] transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    )
  }

  if (requiresAuth && !isAdmin && approvalStatus === "revoked") {
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
            onClick={handleLogout}
            className="text-sm text-[#6a7282] hover:text-[#4a5565] transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    )
  }

  if (effectiveMode === "learn") {
    return (
      <LearningPage
        onNavigate={(dest) => setMode(dest === "home" ? "home" : dest)}
        onSignOut={authAction}
        isAdmin={isAdmin}
        isLoggedIn={!!user}
      />
    )
  }

  if (effectiveMode === "dictionary") {
    return (
      <DictionaryPage
        onNavigate={(dest) => setMode(dest === "home" ? "home" : dest)}
        onSignOut={authAction}
        isAdmin={isAdmin}
        isLoggedIn={!!user}
        initialToken={pendingDictionaryToken}
        onInitialTokenConsumed={() => setPendingDictionaryToken(undefined)}
      />
    )
  }

  if (effectiveMode === "translate") {
    return (
      <TranslatePage
        onNavigate={(dest) => setMode(dest === "home" ? "home" : dest)}
        onSignOut={authAction}
        isAdmin={isAdmin}
        isLoggedIn={!!user}
        result={result}
        isLoading={isLoading}
        error={error}
        retryAfter={retryAfter}
        onTranslate={handleTranslate}
        onVoiceResult={handleVoiceResult}
        initialText={pendingInput}
        onInitialTextConsumed={() => setPendingInput(undefined)}
        onViewSignInDictionary={handleViewSignInDictionary}
      />
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#f9fafb]">
      <AppNavbar
        activeMode={effectiveMode}
        onNavigate={setMode}
        onLogout={handleLogout}
        isAdmin={isAdmin}
        isLoggedIn={!!user}
      />

      <main className="flex-1 max-w-[1440px] mx-auto w-full px-4 sm:px-6 pt-5 pb-24 sm:pb-8">
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
