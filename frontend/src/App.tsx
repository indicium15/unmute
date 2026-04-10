import { useState, useCallback, useEffect } from "react"
import { Header } from "@/components/Header"
import { InputPanel } from "@/components/InputPanel"
import { OutputPanel } from "@/components/OutputPanel"
import { VideoCall } from "@/components/VideoCall"
import { LoginPage } from "@/components/LoginPage"
import { AdminPage } from "@/components/AdminPage"
import { useTranslation, type TranslationResult } from "@/hooks/useTranslation"
import { useSignPlayback } from "@/hooks/useSignPlayback"
import { useAuth } from "@/contexts/AuthContext"
import type { AvatarController } from "@/lib/avatar-controller"
import { Button } from "@/components/ui/button"
import { Video, MessageSquare, LogOut, Shield } from "lucide-react"

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000"

type AppMode = "translate" | "video" | "admin"

function App() {
  const { user, loading, logout } = useAuth()
  const [mode, setMode] = useState<AppMode>("translate")
  const [isAdmin, setIsAdmin] = useState(false)
  const [avatar, setAvatar] = useState<AvatarController | null>(null)
  const { result, setResult, isLoading, translate } = useTranslation()
  const { isPlaying, currentToken, currentGifUrl, playSequence, stopPlayback } = useSignPlayback({ avatar })

  // Check admin status whenever the authenticated user changes
  useEffect(() => {
    if (!user) {
      setIsAdmin(false)
      if (mode === "admin") setMode("translate")
      return
    }
    user.getIdToken().then((token) =>
      fetch(`${API_BASE_URL}/api/admin/check`, {
        headers: { Authorization: `Bearer ${token}` },
      })
    ).then((r) => r.json())
     .then((data: { is_admin?: boolean }) => setIsAdmin(data.is_admin === true))
     .catch(() => setIsAdmin(false))
  }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleTranslate = useCallback(async (text: string) => {
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
    if (result && result.plan.length > 0) {
      playSequence(result.plan)
    }
  }, [result, playSequence])

  const handleAvatarReady = useCallback((controller: AvatarController) => {
    setAvatar(controller)
  }, [])

  // Auto-play when result changes
  useEffect(() => {
    if (result && result.plan.length > 0 && avatar && !isPlaying) {
      // Only auto-play if not already playing (avoid duplicate plays)
    }
  }, [result, avatar, isPlaying])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg-warm)]">
        <p className="text-text-muted text-sm">Loading...</p>
      </div>
    )
  }

  if (!user) {
    return <LoginPage />
  }

  return (
    <div className="min-h-screen flex flex-col items-center py-12 px-6 max-w-[1400px] mx-auto w-full">
      <Header />
      
      {/* Mode Switcher + Logout */}
      <div className="flex items-center gap-4 mb-8 animate-fade-in" style={{ animationDelay: "0.1s" }}>
      <div className="inline-flex gap-1.5 p-1.5 bg-[var(--bg-cream)] rounded-[20px] border border-[var(--border-soft)]">
        <Button
          variant="ghost"
          onClick={() => setMode("translate")}
          className={mode === "translate"
            ? "bg-bg-card text-accent-terracotta shadow-soft font-medium px-6 py-3.5 rounded-[14px]"
            : "text-text-secondary hover:text-text-primary hover:bg-white/50 px-6 py-3.5 rounded-[14px]"
          }
        >
          <MessageSquare className="w-5 h-5 mr-2" />
          Translate
        </Button>
        <Button
          variant="ghost"
          onClick={() => setMode("video")}
          className={mode === "video"
            ? "bg-bg-card text-accent-terracotta shadow-soft font-medium px-6 py-3.5 rounded-[14px]"
            : "text-text-secondary hover:text-text-primary hover:bg-white/50 px-6 py-3.5 rounded-[14px]"
          }
        >
          <Video className="w-5 h-5 mr-2" />
          Video Call
        </Button>
        {isAdmin && (
          <Button
            variant="ghost"
            onClick={() => setMode("admin")}
            className={mode === "admin"
              ? "bg-bg-card text-accent-terracotta shadow-soft font-medium px-6 py-3.5 rounded-[14px]"
              : "text-text-secondary hover:text-text-primary hover:bg-white/50 px-6 py-3.5 rounded-[14px]"
            }
          >
            <Shield className="w-5 h-5 mr-2" />
            Admin
          </Button>
        )}
      </div>
      <Button
        variant="ghost"
        onClick={logout}
        className="text-text-muted hover:text-text-secondary px-3 py-3.5 rounded-[14px]"
        title="Sign out"
      >
        <LogOut className="w-4 h-4" />
      </Button>
      </div>

      {mode === "translate" ? (
        <main className="w-full grid grid-cols-1 lg:grid-cols-[1fr_1.5fr] gap-8 animate-fade-in-up" style={{ animationDelay: "0.2s" }}>
          <InputPanel
            onTranslate={handleTranslate}
            onVoiceResult={handleVoiceResult}
            isLoading={isLoading}
            result={result}
          />
          <OutputPanel
            plan={result?.plan || []}
            currentToken={currentToken}
            currentGifUrl={currentGifUrl}
            isPlaying={isPlaying}
            onReplay={handleReplay}
            onAvatarReady={handleAvatarReady}
          />
        </main>
      ) : mode === "video" ? (
        <main className="w-full max-w-6xl animate-fade-in-up" style={{ animationDelay: "0.2s" }}>
          <VideoCall />
        </main>
      ) : (
        <main className="w-full max-w-6xl">
          <AdminPage />
        </main>
      )}
    </div>
  )
}

export default App
