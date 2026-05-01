import { useState } from "react"
import { FirebaseError } from "firebase/app"
import { useAuth } from "@/contexts/useAuth"

export function LoginPage() {
  const { login } = useAuth()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)
    try {
      await login(email, password)
    } catch (err) {
      const code = err instanceof FirebaseError ? err.code : "unknown"
      if (code === "auth/too-many-requests") {
        setError("Too many attempts. Try again later.")
      } else if (code === "auth/network-request-failed") {
        setError("Network error. Check your connection.")
      } else if (code === "auth/invalid-email") {
        setError("That email address doesn't look valid.")
      } else {
        setError("Invalid email or password.")
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-5 bg-bg-warm relative overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full bg-accent-terracotta/8 blur-[120px]" />
      </div>

      <div className="w-full max-w-sm relative z-10">
        {/* Logo */}
        <div className="text-center mb-10 animate-fade-in-down">
          <div className="text-[10px] font-medium tracking-[0.3em] uppercase text-text-muted mb-3">
            Singapore Sign Language Translator
          </div>
          <h1 className="font-serif text-[5rem] font-bold text-text-primary tracking-tight leading-none">
            un<span className="text-gradient">mute</span>
          </h1>
        </div>

        {/* Form card */}
        <div
          className="bg-bg-card rounded-[20px] border border-border-soft p-7 animate-slide-up"
          style={{ boxShadow: "0 24px 64px rgba(0,0,0,0.5), 0 0 0 1px rgba(237,220,195,0.04)" }}
        >
          <p className="text-sm text-text-secondary mb-6 text-center">Sign in to continue</p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-text-muted uppercase tracking-widest">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full px-4 py-3 rounded-[12px] bg-bg-input border border-border-soft text-text-primary text-sm outline-none focus:border-accent-terracotta focus:ring-2 focus:ring-accent-terracotta/15 transition-all placeholder:text-text-muted"
                placeholder="you@example.com"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-text-muted uppercase tracking-widest">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full px-4 py-3 rounded-[12px] bg-bg-input border border-border-soft text-text-primary text-sm outline-none focus:border-accent-terracotta focus:ring-2 focus:ring-accent-terracotta/15 transition-all placeholder:text-text-muted"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p className="text-xs text-red-400 bg-red-950/40 border border-red-800/30 rounded-[10px] px-3 py-2.5 animate-fade-in">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="mt-1 w-full py-3 rounded-[12px] bg-gradient-accent text-white font-semibold text-sm shadow-[0_4px_20px_rgba(217,112,64,0.35)] hover:shadow-[0_6px_28px_rgba(217,112,64,0.45)] hover:-translate-y-px transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-y-0 active:scale-[0.98]"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  Signing in…
                </span>
              ) : (
                "Sign In"
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
