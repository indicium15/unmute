import { useCallback, useEffect, useState } from "react"
import { API_BASE_URL, PAGE_SIZE, authHeaders, throwIfNotOk } from "./api"
import type { UserRecord } from "./types"

export function useAdminUserList() {
  const [users, setUsers] = useState<UserRecord[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)

  const fetchUsers = useCallback(async (pageNum: number) => {
    setIsLoading(true)
    setError(null)
    try {
      const headers = await authHeaders()
      const res = await fetch(
        `${API_BASE_URL}/api/admin/users?limit=${PAGE_SIZE}&offset=${pageNum * PAGE_SIZE}`,
        { headers }
      )
      await throwIfNotOk(res)
      const data = (await res.json()) as { users: UserRecord[]; has_more: boolean }
      setUsers(data.users)
      setHasMore(data.has_more)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch users")
      setUsers([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchUsers(0)
  }, [fetchUsers])

  const handlePage = (delta: number) => {
    const next = page + delta
    setPage(next)
    fetchUsers(next)
  }

  return { users, setUsers, isLoading, error, setError, page, hasMore, fetchUsers, handlePage }
}
