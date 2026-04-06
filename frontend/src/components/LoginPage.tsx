import { useState } from "react"
import { FirebaseError } from "firebase/app"
import { useAuth } from "@/contexts/AuthContext"

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
        setError("Network error. Check your connection and try again.")
      } else if (code === "auth/invalid-email") {
        setError("That email address doesn’t look valid.")
      } else {
        setError("Invalid email or password. Please try again.")
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-[var(--color-bg-warm)]">
      <div className="w-full max-w-sm">
        {/* Logo / Title */}
        <div className="text-center mb-10 animate-fade-in-down">
          <div className="text-xs font-medium tracking-[0.25em] uppercase text-text-muted mb-3">
            Singapore Sign Language
          </div>
          <h1 className="font-serif text-6xl font-semibold text-text-primary tracking-tight leading-none">
            un<span className="text-gradient">mute</span>
          </h1>
          <p className="font-sans text-base text-text-secondary mt-3">
            Sign in to continue
          </p>
        </div>

        {/* Card */}
        <div
          className="bg-[var(--color-bg-card)] rounded-[var(--radius-card)] border border-[var(--color-border-soft)] p-8 animate-fade-in-up"
          style={{ boxShadow: "var(--shadow-warm)" }}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-[var(--radius-input)] bg-[var(--color-bg-input)] border border-[var(--color-border-warm)] text-text-primary text-sm outline-none focus:border-[var(--color-accent-terracotta)] transition-colors"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-[var(--radius-input)] bg-[var(--color-bg-input)] border border-[var(--color-border-warm)] text-text-primary text-sm outline-none focus:border-[var(--color-accent-terracotta)] transition-colors"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p className="text-sm text-red-500">{error}</p>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-6 rounded-[var(--radius-button)] bg-[var(--color-accent-terracotta)] text-white font-medium text-sm hover:bg-[var(--color-accent-warm)] transition-colors disabled:opacity-60 disabled:cursor-not-allowed mt-2"
            >
              {isLoading ? "Signing in..." : "Sign In"}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
