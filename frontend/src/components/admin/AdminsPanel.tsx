import { useEffect, useState } from "react"
import { ShieldCheck } from "lucide-react"
import { auth } from "@/lib/firebase"
import { Card } from "@/components/ui/card"
import { API_BASE_URL, authHeaders, throwIfNotOk } from "./api"
import { PanelHeader } from "./PanelHeader"
import { PaginationFooter } from "./PaginationFooter"
import { useAdminUserList } from "./useAdminUserList"

export function AdminsPanel() {
  const { users, setUsers, isLoading, error, setError, page, hasMore, fetchUsers, handlePage } =
    useAdminUserList()
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [currentUid, setCurrentUid] = useState<string | null>(null)

  useEffect(() => {
    const user = auth.currentUser
    if (user) setCurrentUid(user.uid)
  }, [])

  const handleAdminToggle = async (uid: string, grantAdmin: boolean) => {
    setActionLoading(uid)
    setError(null)
    try {
      const headers = await authHeaders()
      const action = grantAdmin ? "grant-admin" : "revoke-admin"
      const res = await fetch(`${API_BASE_URL}/api/admin/users/${uid}/${action}`, {
        method: "POST",
        headers,
      })
      await throwIfNotOk(res)
      setUsers((prev) => prev.map((u) => (u.id === uid ? { ...u, is_admin: grantAdmin } : u)))
    } catch (e) {
      setError(e instanceof Error ? e.message : `Failed to ${grantAdmin ? "grant" : "revoke"} admin`)
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <div>
      <PanelHeader
        title="Admin Access"
        subtitle="Control which users have admin privileges"
        isLoading={isLoading}
        onRefresh={() => fetchUsers(page)}
      />

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-[10px] px-3 py-2.5 mb-4">
          {error}
        </p>
      )}

      <Card
        className="overflow-hidden border border-[var(--color-border-soft)] rounded-[var(--radius-card)] p-0"
        style={{ boxShadow: "var(--shadow-soft)" }}
      >
        {isLoading ? (
          <div className="p-16 text-center">
            <p className="text-text-muted text-sm">Loading…</p>
          </div>
        ) : users.length === 0 ? (
          <div className="p-16 text-center">
            <p className="text-text-muted text-sm">No users found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[var(--color-border-soft)]">
                  {["Email", "Role", "Actions"].map((h) => (
                    <th
                      key={h}
                      className="py-3 px-4 text-xs uppercase tracking-widest text-text-muted font-medium whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const isSelf = u.id === currentUid
                  const isAdmin = u.is_admin === true
                  return (
                    <tr
                      key={u.id}
                      className="border-b border-[var(--color-border-soft)] hover:bg-[var(--color-bg-cream)] transition-colors"
                    >
                      <td className="py-3 px-4 text-sm text-text-primary max-w-[280px] truncate">
                        {u.email ?? <span className="text-text-muted italic">no email</span>}
                        {isSelf && (
                          <span className="ml-2 text-xs text-text-muted italic">(you)</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {isAdmin ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-[var(--color-accent-soft)] text-[var(--color-accent-terracotta)] border border-[var(--color-accent-soft)]">
                            <ShieldCheck className="w-3 h-3" /> Admin
                          </span>
                        ) : (
                          <span className="text-xs text-text-muted">User</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {!isSelf && (
                          isAdmin ? (
                            <button
                              onClick={() => handleAdminToggle(u.id, false)}
                              disabled={actionLoading === u.id}
                              className="text-xs font-medium px-3 py-1.5 rounded-[8px] bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition-colors disabled:opacity-50"
                            >
                              {actionLoading === u.id ? "Revoking…" : "Revoke Admin"}
                            </button>
                          ) : (
                            <button
                              onClick={() => handleAdminToggle(u.id, true)}
                              disabled={actionLoading === u.id}
                              className="text-xs font-medium px-3 py-1.5 rounded-[8px] bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100 transition-colors disabled:opacity-50"
                            >
                              {actionLoading === u.id ? "Granting…" : "Grant Admin"}
                            </button>
                          )
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {!isLoading && users.length > 0 && (
          <PaginationFooter page={page} itemCount={users.length} hasMore={hasMore} onPageChange={handlePage} />
        )}
      </Card>
    </div>
  )
}
