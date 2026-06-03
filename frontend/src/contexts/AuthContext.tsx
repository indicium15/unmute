import { useEffect, useState, type ReactNode } from "react"
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
} from "firebase/auth"
import { auth } from "@/lib/firebase"
import { AuthContext, type ApprovalStatus, type AuthContextType } from "./auth-context"

// Set VITE_AUTH_ENABLED=false to run without authentication (demo / open-access mode).
// All existing auth code remains intact; flip the flag to re-enable.
const AUTH_ENABLED = import.meta.env.VITE_AUTH_ENABLED !== "false"

const BYPASS_CONTEXT: AuthContextType = {
  user: { uid: "demo" } as unknown as import("firebase/auth").User,
  loading: false,
  approvalStatus: "approved",
  isAdmin: false,
  signupRejected: false,
  login: async () => {},
  signup: async () => {},
  loginWithGoogle: async () => {},
  logout: async () => {},
}

function NoAuthProvider({ children }: { children: ReactNode }) {
  return <AuthContext.Provider value={BYPASS_CONTEXT}>{children}</AuthContext.Provider>
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000"

async function getAdminClaim(firebaseUser: import("firebase/auth").User): Promise<boolean> {
  try {
    const result = await firebaseUser.getIdTokenResult()
    return result.claims["admin"] === true
  } catch {
    return false
  }
}

async function syncUserRegistration(
  firebaseUser: import("firebase/auth").User
): Promise<{ status: ApprovalStatus }> {
  const token = await firebaseUser.getIdToken()
  const res = await fetch(`${API_BASE_URL}/api/auth/register`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  })
  if (res.status === 403) {
    await firebaseUser.delete()
    throw Object.assign(new Error("not_allowed"), { code: "auth/email-not-allowed" })
  }
  if (!res.ok) return { status: "unknown" }
  const data = await res.json()
  return { status: (data.status as ApprovalStatus) ?? "unknown" }
}

async function validatePasswordStrength(email: string, password: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/auth/validate-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  })

  if (res.ok) return

  let detail = "Password does not meet backend strength requirements."
  try {
    const data = await res.json()
    if (typeof data?.detail === "string" && data.detail.trim()) {
      detail = data.detail
    }
  } catch {
    // Ignore parse errors and keep default message.
  }

  throw Object.assign(new Error(detail), { code: "auth/weak-password-backend" })
}

function RealAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<import("firebase/auth").User | null>(null)
  const [loading, setLoading] = useState(true)
  const [approvalStatus, setApprovalStatus] = useState<ApprovalStatus>("unknown")
  const [isAdmin, setIsAdmin] = useState(false)
  const [signupRejected, setSignupRejected] = useState(false)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.debug("[Auth][state-change] received", {
        hasUser: !!firebaseUser,
        uid: firebaseUser?.uid ?? null,
        pathname: window.location.pathname,
      })
      if (firebaseUser) {
        try {
          const [{ status }, adminClaim] = await Promise.all([
            syncUserRegistration(firebaseUser),
            getAdminClaim(firebaseUser),
          ])
          console.debug("[Auth][state-change] resolved", {
            hasUser: true,
            uid: firebaseUser.uid,
            status,
            isAdmin: adminClaim,
            pathname: window.location.pathname,
          })
          setUser(firebaseUser)
          setApprovalStatus(status)
          setIsAdmin(adminClaim)
          setSignupRejected(false)
        } catch (err: unknown) {
          console.debug("[Auth][state-change] resolve-error", {
            hasUser: true,
            uid: firebaseUser.uid,
            code: err instanceof Error ? (err as { code?: string }).code ?? "unknown" : "unknown",
            pathname: window.location.pathname,
          })
          if (err instanceof Error && (err as { code?: string }).code === "auth/email-not-allowed") {
            setUser(null)
            setApprovalStatus("unknown")
            setIsAdmin(false)
            setSignupRejected(true)
          } else {
            setUser(firebaseUser)
            setApprovalStatus("unknown")
            setIsAdmin(false)
          }
        }
      } else {
        console.debug("[Auth][state-change] signed-out", {
          hasUser: false,
          pathname: window.location.pathname,
        })
        setUser(null)
        setApprovalStatus("unknown")
        setIsAdmin(false)
      }
      setLoading(false)
    })
    return unsubscribe
  }, [])

  const login = async (email: string, password: string) => {
    console.debug("[Auth][login] attempt", { email })
    setSignupRejected(false)
    await signInWithEmailAndPassword(auth, email, password)
  }

  const signup = async (email: string, password: string) => {
    setSignupRejected(false)
    await validatePasswordStrength(email, password)
    await createUserWithEmailAndPassword(auth, email, password)
  }

  const loginWithGoogle = async () => {
    console.debug("[Auth][login-google] attempt")
    setSignupRejected(false)
    const provider = new GoogleAuthProvider()
    await signInWithPopup(auth, provider)
  }

  const logout = async () => {
    console.debug("[Auth][logout] attempt", { pathname: window.location.pathname })
    setSignupRejected(false)
    await signOut(auth)
  }

  return (
    <AuthContext.Provider value={{ user, loading, approvalStatus, isAdmin, signupRejected, login, signup, loginWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function AuthProvider({ children }: { children: ReactNode }) {
  return AUTH_ENABLED ? <RealAuthProvider>{children}</RealAuthProvider> : <NoAuthProvider>{children}</NoAuthProvider>
}
