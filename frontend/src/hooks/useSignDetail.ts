import { useState, useEffect } from "react"
import { auth } from "@/lib/firebase"
import type { SignDetail } from "@/components/signs/types"

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000"

async function authHeaders(): Promise<Record<string, string>> {
  const user = auth.currentUser
  if (!user) return {}
  const token = await user.getIdToken()
  return { Authorization: `Bearer ${token}` }
}

export function useSignDetail(token: string | undefined) {
  const [detail, setDetail] = useState<SignDetail | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!token) {
      setDetail(null)
      return
    }
    let cancelled = false
    setLoading(true)
    ;(async () => {
      try {
        const headers = await authHeaders()
        const res = await fetch(`${API_BASE_URL}/api/learning/sign/${encodeURIComponent(token)}`, { headers })
        if (!res.ok) {
          if (!cancelled) setDetail(null)
          return
        }
        const data: SignDetail = await res.json()
        if (!cancelled) setDetail(data)
      } catch (err) {
        console.error(err)
        if (!cancelled) setDetail(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [token])

  return { detail, loading }
}
