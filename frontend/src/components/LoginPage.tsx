import { useState, useEffect } from "react"
import { FirebaseError } from "firebase/app"
import { useAuth } from "@/contexts/useAuth"

type Mode = "login" | "signup"

function firebaseErrorMessage(err: unknown, mode: Mode): string {
  const code = err instanceof FirebaseError ? err.code : "unknown"
  if (code === "auth/too-many-requests") return "Too many attempts. Try again later."
  if (code === "auth/network-request-failed") return "Network error. Check your connection."
  if (code === "auth/invalid-email") return "That email address doesn't look valid."
  if (code === "auth/email-already-in-use") return "An account with this email already exists."
  if (code === "auth/weak-password") return "Password must be at least 6 characters."
  if (mode === "login") return "Invalid email or password."
  return "Sign-up failed. Please try again."
}

export function LoginPage() {
  const { login, signup, signupRejected } = useAuth()
  const [mode, setMode] = useState<Mode>("login")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [signedUp, setSignedUp] = useState(false)

  useEffect(() => {
    if (signupRejected) {
      setError("Your email is not authorized to access this app. Please contact an admin.")
      setSignedUp(false)
      setMode("signup")
    }
  }, [signupRejected])

  const switchMode = (next: Mode) => {
    setMode(next)
    setError("")
    setPassword("")
    setConfirmPassword("")
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (mode === "signup" && password !== confirmPassword) {
      setError("Passwords do not match.")
      return
    }

    setIsLoading(true)
    try {
      if (mode === "login") {
        await login(email, password)
      } else {
        await signup(email, password)
        setSignedUp(true)
      }
    } catch (err) {
      setError(firebaseErrorMessage(err, mode))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-white flex flex-col" style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-100 shadow-sm">
        <div className="max-w-[1152px] mx-auto px-6 h-16 flex items-center">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-[14px] bg-[#6176f7] shadow flex items-center justify-center flex-shrink-0">
              <img src="/home/icon-logo.svg" alt="" className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[14px] font-semibold leading-5 text-[#6176f7]">SgSL</p>
              <p className="text-[12px] font-normal leading-4 text-[#6a7282]">Singapore Sign Language</p>
            </div>
          </div>
        </div>
      </nav>

      {/* Form area */}
      <div className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm">
          {signedUp ? (
            /* Post-signup pending screen */
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-amber-50 border-2 border-amber-200 flex items-center justify-center mx-auto mb-5">
                <svg className="w-8 h-8 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
              </div>
              <h2 className="text-[22px] font-bold text-[#101828] mb-2">Account created — pending approval</h2>
              <p className="text-[14px] text-[#6a7282] leading-relaxed mb-6">
                Your account is awaiting admin approval. You'll be able to log in once an admin has approved your access.
              </p>
              <button
                onClick={() => { setSignedUp(false); setMode("login") }}
                className="text-[14px] font-medium text-[#6176f7] hover:underline"
              >
                Back to sign in
              </button>
            </div>
          ) : (
            <>
              <div className="text-center mb-8">
                <h1 className="text-[30px] font-bold leading-9 text-[#101828]">
                  {mode === "login" ? "Sign in to SgSL" : "Create an account"}
                </h1>
                <p className="mt-2 text-[14px] text-[#6a7282]">
                  {mode === "login"
                    ? "Welcome back. Enter your details to continue."
                    : "Sign up to request access to the SgSL app."}
                </p>
              </div>

              <div className="bg-white border border-gray-100 rounded-2xl shadow-lg p-6">
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[12px] font-medium text-[#4a5565]">Email address</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoComplete="email"
                      className="w-full px-4 py-3 rounded-[12px] bg-gray-50 border border-gray-200 text-[#101828] text-[14px] outline-none focus:border-[#6176f7] focus:ring-2 focus:ring-[#6176f7]/15 transition-all placeholder:text-[#99a1af]"
                      placeholder="you@example.com"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[12px] font-medium text-[#4a5565]">Password</label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete={mode === "login" ? "current-password" : "new-password"}
                      className="w-full px-4 py-3 rounded-[12px] bg-gray-50 border border-gray-200 text-[#101828] text-[14px] outline-none focus:border-[#6176f7] focus:ring-2 focus:ring-[#6176f7]/15 transition-all placeholder:text-[#99a1af]"
                      placeholder="••••••••"
                    />
                  </div>

                  {mode === "signup" && (
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[12px] font-medium text-[#4a5565]">Confirm password</label>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        autoComplete="new-password"
                        className="w-full px-4 py-3 rounded-[12px] bg-gray-50 border border-gray-200 text-[#101828] text-[14px] outline-none focus:border-[#6176f7] focus:ring-2 focus:ring-[#6176f7]/15 transition-all placeholder:text-[#99a1af]"
                        placeholder="••••••••"
                      />
                    </div>
                  )}

                  {error && (
                    <p className="text-[13px] text-red-600 bg-red-50 border border-red-200 rounded-[10px] px-3 py-2.5">
                      {error}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="mt-1 w-full py-3 rounded-[12px] bg-[#6176f7] text-white font-semibold text-[14px] shadow hover:bg-[#5068f0] hover:-translate-y-px transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-y-0 active:scale-[0.98]"
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
                </form>

                <div className="mt-4 pt-4 border-t border-gray-100 text-center">
                  {mode === "login" ? (
                    <p className="text-[13px] text-[#6a7282]">
                      Don't have an account?{" "}
                      <button
                        onClick={() => switchMode("signup")}
                        className="font-medium text-[#6176f7] hover:underline"
                      >
                        Sign up
                      </button>
                    </p>
                  ) : (
                    <p className="text-[13px] text-[#6a7282]">
                      Already have an account?{" "}
                      <button
                        onClick={() => switchMode("login")}
                        className="font-medium text-[#6176f7] hover:underline"
                      >
                        Sign in
                      </button>
                    </p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-5">
        <p className="text-center text-[12px] text-[#99a1af]">© 2026 SGSL Learn. All rights reserved.</p>
      </footer>
    </div>
  )
}
