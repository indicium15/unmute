import { useState, useEffect } from "react"
import { API_BASE_URL, authHeaders } from "@/lib/api"
import type { SignDetail } from "@/components/signs/types"

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
