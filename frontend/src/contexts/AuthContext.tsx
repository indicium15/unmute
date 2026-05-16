import { useEffect, useState, type ReactNode } from "react"
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "firebase/auth"
import { auth } from "@/lib/firebase"
import { AuthContext, type ApprovalStatus } from "./auth-context"

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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<import("firebase/auth").User | null>(null)
  const [loading, setLoading] = useState(true)
  const [approvalStatus, setApprovalStatus] = useState<ApprovalStatus>("unknown")
  const [isAdmin, setIsAdmin] = useState(false)
  const [signupRejected, setSignupRejected] = useState(false)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const [{ status }, adminClaim] = await Promise.all([
            syncUserRegistration(firebaseUser),
            getAdminClaim(firebaseUser),
          ])
          setUser(firebaseUser)
          setApprovalStatus(status)
          setIsAdmin(adminClaim)
          setSignupRejected(false)
        } catch (err: unknown) {
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
        setUser(null)
        setApprovalStatus("unknown")
        setIsAdmin(false)
      }
      setLoading(false)
    })
    return unsubscribe
  }, [])

  const login = async (email: string, password: string) => {
    setSignupRejected(false)
    await signInWithEmailAndPassword(auth, email, password)
  }

  const signup = async (email: string, password: string) => {
    setSignupRejected(false)
    await createUserWithEmailAndPassword(auth, email, password)
  }

  const logout = async () => {
    setSignupRejected(false)
    await signOut(auth)
  }

  return (
    <AuthContext.Provider value={{ user, loading, approvalStatus, isAdmin, signupRejected, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
