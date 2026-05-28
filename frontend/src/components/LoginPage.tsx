import { useState } from "react"
import { FirebaseError } from "firebase/app"
import { useAuth } from "@/contexts/useAuth"
import { KeyRound } from "lucide-react"

function firebaseErrorMessage(err: unknown): string {
  const code = err instanceof FirebaseError ? err.code : "unknown"
  if (code === "auth/too-many-requests") return "Too many attempts. Try again later."
  if (code === "auth/network-request-failed") return "Network error. Check your connection."
  if (code === "auth/invalid-email") return "That email address doesn't look valid."
  if (code === "auth/email-already-in-use") return "An account with this email already exists."
  if (code === "auth/popup-closed-by-user") return ""
  return "Invalid email or password."
}

type Mode = "login" | "signup"

export function LoginPage() {
  const { login, signup, loginWithGoogle } = useAuth()
  const [mode, setMode] = useState<Mode>("login")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)

  const canSubmit = email.trim() !== "" && password !== ""

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    setError("")
    setIsLoading(true)
    try {
      if (mode === "login") {
        await login(email, password)
      } else {
        await signup(email, password)
      }
    } catch (err) {
      const msg = firebaseErrorMessage(err)
      if (msg) setError(msg)
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoogle = async () => {
    setError("")
    setIsGoogleLoading(true)
    try {
      await loginWithGoogle()
    } catch (err) {
      const msg = firebaseErrorMessage(err)
      if (msg) setError(msg)
    } finally {
      setIsGoogleLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-white flex flex-col" style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-100 shadow-sm">
        <div className="max-w-[1152px] mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-[14px] bg-[#6176f7] shadow flex items-center justify-center flex-shrink-0">
              <img src="/home/icon-logo.svg" alt="" className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[14px] font-semibold leading-5 text-[#6176f7]">Kinnect</p>
              <p className="text-[12px] font-normal leading-4 text-[#6a7282]">Singapore Sign Language</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <span className="px-4 py-2 text-[14px] text-[#4a5565] rounded-[10px]">Home</span>
            <span className="px-4 py-2 text-[14px] text-[#4a5565] rounded-[10px]">Dictionary</span>
            <span className="px-3 py-2 text-[14px] font-medium text-white bg-[#6176f7] rounded-[10px] shadow-sm">
              Learn SgSL
            </span>
          </div>
        </div>
      </nav>

      {/* Main gradient section */}
      <div
        className="flex-1 flex flex-col items-center justify-center px-6 py-16 gap-5"
        style={{ background: "linear-gradient(101.39deg, #6176f7 53.22%, #ffe0f0 101.56%)" }}
      >
        <h1 className="text-[30px] font-bold leading-9 text-white text-center">Learn SgSL</h1>
        <p className="text-[14px] text-white/80 text-center max-w-lg">
          Access structured lessons to learn and track your progress.
        </p>

        {/* Illustration */}
        <div className="h-[108px] w-[467px] max-w-full overflow-hidden">
          <img
            src="/home/people-signing.png"
            alt="People using sign language"
            className="w-full h-auto object-cover object-top"
          />
        </div>

        {/* Auth card */}
        <div className="bg-white border border-gray-100 rounded-[16px] shadow drop-shadow-sm p-6 w-full max-w-[464px]">
          {/* Card header */}
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-[14px] bg-[#6176f7]/10 flex items-center justify-center flex-shrink-0">
              <KeyRound className="w-5 h-5 text-[#6176f7]" />
            </div>
            <div>
              <h2 className="text-[18px] font-semibold text-[#101828] leading-[27px]">
                {mode === "login" ? "Sign In" : "Create Account"}
              </h2>
              <p className="text-[12px] text-[#6a7282] leading-4">
                {mode === "login" ? "Login to start or resume lessons" : "Sign up to get started"}
              </p>
            </div>
          </div>

          {/* Google button */}
          <button
            type="button"
            onClick={handleGoogle}
            disabled={isGoogleLoading || isLoading}
            className="w-full flex items-center justify-center gap-3 py-3 rounded-[14px] border border-[#e5e7eb] bg-white text-[#101828] text-[14px] font-medium transition-all duration-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed mb-4"
          >
            {isGoogleLoading ? (
              <span className="w-4 h-4 rounded-full border-2 border-gray-300 border-t-gray-600 animate-spin" />
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
            )}
            Continue with Google
          </button>

          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px bg-[#e5e7eb]" />
            <span className="text-[12px] text-[#99a1af]">or</span>
            <div className="flex-1 h-px bg-[#e5e7eb]" />
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[14px] font-medium text-[#364153]">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full px-4 py-3 rounded-[14px] bg-[#f9fafb] border border-[#e5e7eb] text-[#101828] text-[16px] outline-none focus:border-[#6176f7] focus:ring-2 focus:ring-[#6176f7]/15 transition-all placeholder:text-[#99a1af]"
                placeholder="you@example.com"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[14px] font-medium text-[#364153]">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                className="w-full px-4 py-3 rounded-[14px] bg-[#f9fafb] border border-[#e5e7eb] text-[#101828] text-[16px] outline-none focus:border-[#6176f7] focus:ring-2 focus:ring-[#6176f7]/15 transition-all placeholder:text-[#99a1af]"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p className="text-[13px] text-red-600 bg-red-50 border border-red-200 rounded-[10px] px-3 py-2.5">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={isLoading || isGoogleLoading || !canSubmit}
              className="w-full py-3 rounded-[14px] bg-[#6176f7] text-white font-medium text-[14px] transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed enabled:hover:bg-[#5068f0] enabled:hover:-translate-y-px active:enabled:scale-[0.98]"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                  {mode === "login" ? "Signing in…" : "Creating account…"}
                </span>
              ) : (
                mode === "login" ? "Sign In" : "Create Account"
              )}
            </button>

            <p className="text-center text-[13px] text-[#6a7282]">
              {mode === "login" ? (
                <>No account?{" "}
                  <button type="button" onClick={() => { setMode("signup"); setError("") }} className="text-[#6176f7] font-medium hover:underline">
                    Sign up
                  </button>
                </>
              ) : (
                <>Already have an account?{" "}
                  <button type="button" onClick={() => { setMode("login"); setError("") }} className="text-[#6176f7] font-medium hover:underline">
                    Sign in
                  </button>
                </>
              )}
            </p>
          </form>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-[#f9fafb] border-t border-gray-100">
        <div className="max-w-[1152px] mx-auto px-6 pt-10 pb-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 mb-8">
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-[10px] bg-[#6176f7] flex items-center justify-center flex-shrink-0">
                  <img src="/home/icon-logo-footer.svg" alt="" className="w-4 h-4" />
                </div>
                <p className="text-[16px] font-semibold text-[#1e2939]">Kinnect</p>
              </div>
              <p className="text-[14px] text-[#6a7282] leading-relaxed">
                Empowering communication through Singapore Sign Language making SgSL accessible to everyone.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <p className="text-[14px] font-semibold text-[#364153]">Explore</p>
              <div className="flex flex-col gap-2">
                <p className="text-[14px] text-[#6a7282]">Home</p>
                <p className="text-[14px] text-[#6a7282]">SgSL Dictionary</p>
                <p className="text-[14px] text-[#6a7282]">Learn SgSL</p>
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <p className="text-[14px] font-semibold text-[#364153]">About</p>
              <p className="text-[14px] text-[#6a7282] leading-relaxed">
                Singapore Sign Language (SgSL) is the natural language used by the Deaf community in Singapore.
              </p>
            </div>
          </div>
          <div className="border-t border-gray-200 pt-5 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-[12px] text-[#99a1af]">© 2026 Kinnect. All rights reserved.</p>
            <div className="flex items-center gap-1 text-[12px] text-[#99a1af]">
              <span>Made with</span>
              <img src="/home/icon-heart.svg" alt="♥" className="w-3 h-3" />
              <span>for the Deaf community in Singapore</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
