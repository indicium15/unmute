import { useState } from "react"
import { Card } from "@/components/ui/card"
import { API_BASE_URL, authHeaders, throwIfNotOk } from "./api"
import { formatTimestamp } from "./format"
import { PanelHeader } from "./PanelHeader"
import { PaginationFooter } from "./PaginationFooter"
import { useAdminUserList } from "./useAdminUserList"
import type { UserRecord } from "./types"

const STATUS_STYLES: Record<UserRecord["status"], string> = {
  pending: "bg-amber-50 text-amber-700 border border-amber-200",
  approved: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  revoked: "bg-red-50 text-red-600 border border-red-200",
}

export function UsersPanel() {
  const { users, setUsers, isLoading, error, setError, page, hasMore, fetchUsers, handlePage } =
    useAdminUserList()
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const handleAction = async (uid: string, action: "revoke") => {
    setActionLoading(uid)
    try {
      const headers = await authHeaders()
      const res = await fetch(`${API_BASE_URL}/api/admin/users/${uid}/${action}`, {
        method: "POST",
        headers,
      })
      await throwIfNotOk(res)
      setUsers((prev) => prev.map((u) => (u.id === uid ? { ...u, status: "revoked" } : u)))
    } catch (e) {
      setError(e instanceof Error ? e.message : `Failed to ${action} user`)
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <div>
      <PanelHeader
        title="User Management"
        subtitle="Revoke access for registered users"
        isLoading={isLoading}
        onRefresh={() => fetchUsers(page)}
      />

      <Card
        className="overflow-hidden border border-[var(--color-border-soft)] rounded-[var(--radius-card)] p-0"
        style={{ boxShadow: "var(--shadow-soft)" }}
      >
        {isLoading ? (
          <div className="p-16 text-center">
            <p className="text-text-muted text-sm">Loading…</p>
          </div>
        ) : error ? (
          <div className="p-16 text-center">
            <p className="text-text-muted text-sm">{error}</p>
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
                  {["Email", "Status", "Registered", "Actions"].map((h) => (
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
                {users.map((u) => (
                  <tr
                    key={u.id}
                    className="border-b border-[var(--color-border-soft)] hover:bg-[var(--color-bg-cream)] transition-colors"
                  >
                    <td className="py-3 px-4 text-sm text-text-primary max-w-[240px] truncate">
                      {u.email ?? <span className="text-text-muted italic">no email</span>}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_STYLES[u.status]}`}>
                        {u.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs text-text-muted whitespace-nowrap">
                      {formatTimestamp(u.registered_at)}
                    </td>
                    <td className="py-3 px-4">
                      {u.status !== "revoked" && (
                        <button
                          onClick={() => handleAction(u.id, "revoke")}
                          disabled={actionLoading === u.id}
                          className="text-xs font-medium px-3 py-1.5 rounded-[8px] bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition-colors disabled:opacity-50"
                        >
                          {actionLoading === u.id ? "Revoking…" : "Revoke"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!isLoading && !error && users.length > 0 && (
          <PaginationFooter page={page} itemCount={users.length} hasMore={hasMore} onPageChange={handlePage} />
        )}
      </Card>
    </div>
  )
}
