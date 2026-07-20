import { useState, useEffect, useCallback } from "react"
import { ChevronDown, ChevronRight, ChevronLeft, RefreshCw, ThumbsUp, ThumbsDown, Users, FileText, ShieldCheck, BarChart2, Coins } from "lucide-react"
import { auth } from "@/lib/firebase"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000"
const PAGE_SIZE = 25

async function authHeaders(): Promise<Record<string, string>> {
  const user = auth.currentUser
  if (!user) return {}
  const token = await user.getIdToken()
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` }
}

type AdminTab = "dashboard" | "usage" | "users" | "admins" | "logs"
type LogTab = "translation" | "transcription" | "feedback"

interface TranslationLog {
  id: string
  // Historical records only - translation_logs no longer stores who made the
  // request (the translate page doesn't require login).
  user_id?: string
  user_email?: string | null
  timestamp: string
  query_type: "text" | "voice"
  input_text: string
  detected_language: string | null
  gemini_gloss: string[]
  gemini_unmatched: string[]
  gemini_notes: string | null
  output_tokens: string[]
  output_sign_names: string[]
  render_plan_count: number
}

interface TranscriptionLog {
  id: string
  // Historical records only - transcription_logs no longer stores who made
  // the request (the translate page doesn't require login).
  user_id?: string
  user_email?: string | null
  timestamp: string
  transcription: string
  detected_language: string | null
}

interface FeedbackLog {
  id: string
  // Optional - feedback can now be submitted anonymously since the translate
  // page is accessible without login.
  user_id?: string
  user_email?: string | null
  timestamp: string
  rating: "positive" | "negative"
  translation_log_id: string | null
  comment: string | null
}

function formatTimestamp(ts: string): string {
  try {
    return new Date(ts).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    })
  } catch {
    return ts
  }
}

function truncate(s: string | null | undefined, n = 60): string {
  if (!s) return ""
  return s.length > n ? s.slice(0, n) + "…" : s
}

// ── Translation log row ────────────────────────────────────────────────────

function TranslationRow({ log }: { log: TranslationLog }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <>
      <tr
        className="border-b border-[var(--color-border-soft)] hover:bg-[var(--color-bg-cream)] cursor-pointer transition-colors"
        onClick={() => setExpanded((e) => !e)}
      >
        <td className="py-3 px-4 text-xs text-text-muted whitespace-nowrap">
          {formatTimestamp(log.timestamp)}
        </td>
        <td className="py-3 px-4 text-sm text-text-secondary max-w-[160px] truncate">
          {log.user_email ?? "—"}
        </td>
        <td className="py-3 px-4">
          <span
            className={`text-xs font-medium px-2 py-0.5 rounded-full ${
              log.query_type === "voice"
                ? "bg-[var(--color-accent-soft)] text-[var(--color-accent-terracotta)]"
                : "bg-[var(--color-bg-cream)] text-text-secondary border border-[var(--color-border-warm)]"
            }`}
          >
            {log.query_type}
          </span>
        </td>
        <td className="py-3 px-4 text-sm text-text-primary max-w-[220px]">
          {truncate(log.input_text)}
        </td>
        <td className="py-3 px-4 text-xs text-text-muted">{log.detected_language ?? "—"}</td>
        <td className="py-3 px-4 text-xs text-text-secondary">
          {(log.gemini_gloss ?? []).length} tokens
        </td>
        <td className="py-3 px-4 text-xs text-text-secondary">
          {log.render_plan_count} signs
        </td>
        <td className="py-3 px-4 text-text-muted">
          {expanded ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </td>
      </tr>

      {expanded && (
        <tr className="bg-[var(--color-bg-cream)]">
          <td colSpan={8} className="px-6 py-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-sm">
              <Field label="Full Input" value={log.input_text} />
              {log.user_id && <Field label="User ID" value={log.user_id} mono />}
              <Field
                label="Gemini Gloss"
                value={(log.gemini_gloss ?? []).join(", ") || "—"}
              />
              {(log.gemini_unmatched ?? []).length > 0 && (
                <Field
                  label="Unmatched Tokens"
                  value={(log.gemini_unmatched ?? []).join(", ")}
                  accent
                />
              )}
              {log.gemini_notes && (
                <div className="md:col-span-2">
                  <Field label="Gemini Notes" value={log.gemini_notes} />
                </div>
              )}
              <Field
                label="Output Tokens"
                value={(log.output_tokens ?? []).join(", ") || "—"}
              />
              <Field
                label="Output Sign Names"
                value={(log.output_sign_names ?? []).join(", ") || "—"}
              />
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

// ── Transcription log row ──────────────────────────────────────────────────

function TranscriptionRow({ log }: { log: TranscriptionLog }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <>
      <tr
        className="border-b border-[var(--color-border-soft)] hover:bg-[var(--color-bg-cream)] cursor-pointer transition-colors"
        onClick={() => setExpanded((e) => !e)}
      >
        <td className="py-3 px-4 text-xs text-text-muted whitespace-nowrap">
          {formatTimestamp(log.timestamp)}
        </td>
        <td className="py-3 px-4 text-sm text-text-secondary max-w-[180px] truncate">
          {log.user_email ?? "—"}
        </td>
        <td className="py-3 px-4 text-sm text-text-primary max-w-[360px]">
          {truncate(log.transcription, 80)}
        </td>
        <td className="py-3 px-4 text-xs text-text-muted">
          {log.detected_language ?? "—"}
        </td>
        <td className="py-3 px-4 text-text-muted">
          {expanded ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </td>
      </tr>

      {expanded && (
        <tr className="bg-[var(--color-bg-cream)]">
          <td colSpan={5} className="px-6 py-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-sm">
              <Field label="Full Transcription" value={log.transcription} />
              {log.user_id && <Field label="User ID" value={log.user_id} mono />}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

// ── Feedback log row ───────────────────────────────────────────────────────

function FeedbackRow({ log }: { log: FeedbackLog }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <>
      <tr
        className="border-b border-[var(--color-border-soft)] hover:bg-[var(--color-bg-cream)] cursor-pointer transition-colors"
        onClick={() => setExpanded((e) => !e)}
      >
        <td className="py-3 px-4 text-xs text-text-muted whitespace-nowrap">
          {formatTimestamp(log.timestamp)}
        </td>
        <td className="py-3 px-4 text-sm text-text-secondary max-w-[180px] truncate">
          {log.user_email ?? "—"}
        </td>
        <td className="py-3 px-4">
          {log.rating === "positive" ? (
            <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200">
              <ThumbsUp className="w-3 h-3" /> Helpful
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-[var(--color-accent-soft)] text-[var(--color-accent-terracotta)] border border-[var(--color-accent-soft)]">
              <ThumbsDown className="w-3 h-3" /> Not helpful
            </span>
          )}
        </td>
        <td className="py-3 px-4 text-sm text-text-primary max-w-[280px]">
          {log.comment ? truncate(log.comment, 80) : <span className="text-text-muted italic">No comment</span>}
        </td>
        <td className="py-3 px-4 text-xs text-text-muted font-mono">
          {log.translation_log_id ? truncate(log.translation_log_id, 12) : "—"}
        </td>
        <td className="py-3 px-4 text-text-muted">
          {expanded ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </td>
      </tr>

      {expanded && (
        <tr className="bg-[var(--color-bg-cream)]">
          <td colSpan={6} className="px-6 py-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-sm">
              {log.comment && <Field label="Full Comment" value={log.comment} />}
              {log.user_id && <Field label="User ID" value={log.user_id} mono />}
              {log.translation_log_id && (
                <Field label="Translation Log ID" value={log.translation_log_id} mono />
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

// ── Small display helper ───────────────────────────────────────────────────

function Field({
  label,
  value,
  mono = false,
  accent = false,
}: {
  label: string
  value: string
  mono?: boolean
  accent?: boolean
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-widest text-text-muted mb-1">{label}</p>
      <p
        className={`${mono ? "font-mono text-xs" : "text-sm"} ${
          accent
            ? "text-[var(--color-accent-terracotta)]"
            : "text-text-primary"
        } break-all`}
      >
        {value}
      </p>
    </div>
  )
}

// ── Dashboard panel ────────────────────────────────────────────────────────

interface DashboardStats {
  total_users: number
  queries_last_30_days: number
  active_users_30d: number
  queries_by_day: { date: string; count: number }[]
}

function QueryBarChart({ data }: { data: { date: string; count: number }[] }) {
  const maxCount = Math.max(...data.map((d) => d.count), 1)
  const chartH = 120
  const barW = 100 / data.length

  // Week boundary labels at indices 0, 7, 14, 21, 29
  const labelIndices = [0, 7, 14, 21, 29]

  return (
    <div>
      <svg
        viewBox={`0 0 100 ${chartH}`}
        preserveAspectRatio="none"
        className="w-full"
        style={{ height: chartH }}
      >
        {data.map((d, i) => {
          const barH = (d.count / maxCount) * chartH * 0.88
          const x = i * barW + barW * 0.12
          const w = barW * 0.76
          return (
            <rect
              key={d.date}
              x={x}
              y={chartH - barH}
              width={w}
              height={Math.max(barH, 0)}
              rx="0.8"
              fill="var(--color-accent-terracotta)"
              opacity={0.72}
            />
          )
        })}
      </svg>
      {/* X-axis labels */}
      <div className="relative w-full mt-2" style={{ height: 18 }}>
        {labelIndices.map((i) => {
          if (!data[i]) return null
          const label = new Date(data[i].date + "T00:00:00").toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          })
          return (
            <span
              key={i}
              className="absolute text-[10px] text-text-muted -translate-x-1/2"
              style={{ left: `${((i + 0.5) / data.length) * 100}%` }}
            >
              {label}
            </span>
          )
        })}
      </div>
    </div>
  )
}

function DashboardPanel() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchStats = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const headers = await authHeaders()
      const res = await fetch(`${API_BASE_URL}/api/admin/stats`, { headers })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as { detail?: string }).detail ?? `HTTP ${res.status}`)
      }
      setStats(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch stats")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h2 className="font-serif text-3xl font-semibold text-text-primary">Dashboard</h2>
          <p className="text-sm text-text-muted mt-1">Overview of users and query activity</p>
        </div>
        <Button
          variant="ghost"
          onClick={fetchStats}
          disabled={isLoading}
          className="text-text-muted hover:text-text-secondary px-3 py-2 rounded-[14px] mt-1"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {isLoading ? (
        <div className="p-16 text-center">
          <p className="text-text-muted text-sm">Loading…</p>
        </div>
      ) : error ? (
        <div className="p-16 text-center">
          <p className="text-red-500 text-sm">{error}</p>
        </div>
      ) : stats ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            {[
              { label: "Total Users", value: stats.total_users },
              { label: "Queries (last 30 days)", value: stats.queries_last_30_days },
              { label: "Active Users (30d)", value: stats.active_users_30d },
            ].map(({ label, value }) => (
              <Card
                key={label}
                className="border border-[var(--color-border-soft)] rounded-[var(--radius-card)] p-5"
                style={{ boxShadow: "var(--shadow-soft)" }}
              >
                <p className="text-xs uppercase tracking-widest text-text-muted mb-2">{label}</p>
                <p className="font-serif text-4xl font-semibold text-text-primary">
                  {value.toLocaleString()}
                </p>
              </Card>
            ))}
          </div>

          <Card
            className="border border-[var(--color-border-soft)] rounded-[var(--radius-card)] p-6"
            style={{ boxShadow: "var(--shadow-soft)" }}
          >
            <p className="text-sm font-medium text-text-secondary mb-5">
              Queries per day — last 30 days
            </p>
            {stats.queries_by_day.some((d) => d.count > 0) ? (
              <QueryBarChart data={stats.queries_by_day} />
            ) : (
              <p className="text-text-muted text-sm text-center py-8">No query data yet</p>
            )}
          </Card>
        </>
      ) : null}
    </div>
  )
}

// ── Token usage panel ───────────────────────────────────────────────────────
// We don't have direct access to the Azure OpenAI usage/billing dashboard, so
// this approximates token spend from usage figures the API returns inline on
// each translate/transcribe request.

interface UsageDay {
  date: string
  input_tokens: number
  output_tokens: number
  total_tokens: number
}

interface TokenUsageStats {
  total_input_tokens: number
  total_output_tokens: number
  total_tokens: number
  by_endpoint: Record<string, { input_tokens: number; output_tokens: number; total_tokens: number }>
  usage_by_day: UsageDay[]
}

function UsageBarChart({ data }: { data: UsageDay[] }) {
  const maxCount = Math.max(...data.map((d) => d.total_tokens), 1)
  const chartH = 120
  const barW = 100 / data.length
  const labelIndices = [0, 7, 14, 21, 29]

  return (
    <div>
      <svg
        viewBox={`0 0 100 ${chartH}`}
        preserveAspectRatio="none"
        className="w-full"
        style={{ height: chartH }}
      >
        {data.map((d, i) => {
          const barH = (d.total_tokens / maxCount) * chartH * 0.88
          const x = i * barW + barW * 0.12
          const w = barW * 0.76
          return (
            <rect
              key={d.date}
              x={x}
              y={chartH - barH}
              width={w}
              height={Math.max(barH, 0)}
              rx="0.8"
              fill="var(--color-accent-terracotta)"
              opacity={0.72}
            />
          )
        })}
      </svg>
      <div className="relative w-full mt-2" style={{ height: 18 }}>
        {labelIndices.map((i) => {
          if (!data[i]) return null
          const label = new Date(data[i].date + "T00:00:00").toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          })
          return (
            <span
              key={i}
              className="absolute text-[10px] text-text-muted -translate-x-1/2"
              style={{ left: `${((i + 0.5) / data.length) * 100}%` }}
            >
              {label}
            </span>
          )
        })}
      </div>
    </div>
  )
}

function UsagePanel() {
  const [stats, setStats] = useState<TokenUsageStats | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchStats = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const headers = await authHeaders()
      const res = await fetch(`${API_BASE_URL}/api/admin/token-usage`, { headers })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as { detail?: string }).detail ?? `HTTP ${res.status}`)
      }
      setStats(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch token usage")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h2 className="font-serif text-3xl font-semibold text-text-primary">Token Usage</h2>
          <p className="text-sm text-text-muted mt-1">
            Approximate LLM token spend (translate + transcribe) — we don't have direct access to the
            Azure usage dashboard, so this is tracked from per-request usage figures.
          </p>
        </div>
        <Button
          variant="ghost"
          onClick={fetchStats}
          disabled={isLoading}
          className="text-text-muted hover:text-text-secondary px-3 py-2 rounded-[14px] mt-1"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {isLoading ? (
        <div className="p-16 text-center">
          <p className="text-text-muted text-sm">Loading…</p>
        </div>
      ) : error ? (
        <div className="p-16 text-center">
          <p className="text-red-500 text-sm">{error}</p>
        </div>
      ) : stats ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            {[
              { label: "Input Tokens (30d)", value: stats.total_input_tokens },
              { label: "Output Tokens (30d)", value: stats.total_output_tokens },
              { label: "Total Tokens (30d)", value: stats.total_tokens },
            ].map(({ label, value }) => (
              <Card
                key={label}
                className="border border-[var(--color-border-soft)] rounded-[var(--radius-card)] p-5"
                style={{ boxShadow: "var(--shadow-soft)" }}
              >
                <p className="text-xs uppercase tracking-widest text-text-muted mb-2">{label}</p>
                <p className="font-serif text-4xl font-semibold text-text-primary">
                  {value.toLocaleString()}
                </p>
              </Card>
            ))}
          </div>

          <Card
            className="border border-[var(--color-border-soft)] rounded-[var(--radius-card)] p-6 mb-8"
            style={{ boxShadow: "var(--shadow-soft)" }}
          >
            <p className="text-sm font-medium text-text-secondary mb-5">
              Tokens per day — last 30 days
            </p>
            {stats.usage_by_day.some((d) => d.total_tokens > 0) ? (
              <UsageBarChart data={stats.usage_by_day} />
            ) : (
              <p className="text-text-muted text-sm text-center py-8">No usage data yet</p>
            )}
          </Card>

          {Object.keys(stats.by_endpoint).length > 0 && (
            <Card
              className="overflow-hidden border border-[var(--color-border-soft)] rounded-[var(--radius-card)] p-0"
              style={{ boxShadow: "var(--shadow-soft)" }}
            >
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-[var(--color-border-soft)]">
                    {["Endpoint", "Input Tokens", "Output Tokens", "Total Tokens"].map((h) => (
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
                  {Object.entries(stats.by_endpoint).map(([endpoint, usage]) => (
                    <tr key={endpoint} className="border-b border-[var(--color-border-soft)]">
                      <td className="py-3 px-4 text-sm text-text-primary capitalize">{endpoint}</td>
                      <td className="py-3 px-4 text-sm text-text-secondary">{usage.input_tokens.toLocaleString()}</td>
                      <td className="py-3 px-4 text-sm text-text-secondary">{usage.output_tokens.toLocaleString()}</td>
                      <td className="py-3 px-4 text-sm text-text-secondary">{usage.total_tokens.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </>
      ) : null}
    </div>
  )
}

// ── User management panel ──────────────────────────────────────────────────

interface UserRecord {
  id: string
  uid: string
  email: string | null
  status: "pending" | "approved" | "revoked"
  registered_at: string
  approved_at?: string
  approved_by?: string
  is_admin?: boolean
}

const STATUS_STYLES: Record<UserRecord["status"], string> = {
  pending: "bg-amber-50 text-amber-700 border border-amber-200",
  approved: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  revoked: "bg-red-50 text-red-600 border border-red-200",
}

function UsersPanel() {
  const [users, setUsers] = useState<UserRecord[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const fetchUsers = useCallback(async (pageNum: number) => {
    setIsLoading(true)
    setError(null)
    try {
      const headers = await authHeaders()
      const res = await fetch(
        `${API_BASE_URL}/api/admin/users?limit=${PAGE_SIZE}&offset=${pageNum * PAGE_SIZE}`,
        { headers }
      )
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as { detail?: string }).detail ?? `HTTP ${res.status}`)
      }
      const data = await res.json() as { users: UserRecord[]; has_more: boolean }
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

  const handleAction = async (uid: string, action: "revoke") => {
    setActionLoading(uid)
    try {
      const headers = await authHeaders()
      const res = await fetch(`${API_BASE_URL}/api/admin/users/${uid}/${action}`, {
        method: "POST",
        headers,
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as { detail?: string }).detail ?? `HTTP ${res.status}`)
      }
      setUsers((prev) =>
        prev.map((u) => (u.id === uid ? { ...u, status: "revoked" } : u))
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : `Failed to ${action} user`)
    } finally {
      setActionLoading(null)
    }
  }

  const handlePage = (delta: number) => {
    const next = page + delta
    setPage(next)
    fetchUsers(next)
  }

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h2 className="font-serif text-3xl font-semibold text-text-primary">User Management</h2>
          <p className="text-sm text-text-muted mt-1">
            Revoke access for registered users
          </p>
        </div>
        <Button
          variant="ghost"
          onClick={() => fetchUsers(page)}
          disabled={isLoading}
          className="text-text-muted hover:text-text-secondary px-3 py-2 rounded-[14px] mt-1"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
        </Button>
      </div>

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
          <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--color-border-soft)]">
            <span className="text-xs text-text-muted">
              Showing {page * PAGE_SIZE + 1}–{page * PAGE_SIZE + users.length}
            </span>
            <div className="flex gap-1.5">
              <Button
                variant="ghost"
                size="sm"
                disabled={page === 0}
                onClick={() => handlePage(-1)}
                className="px-2.5 py-1.5 rounded-[10px] text-text-muted hover:text-text-secondary disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="flex items-center px-2 text-xs text-text-muted">Page {page + 1}</span>
              <Button
                variant="ghost"
                size="sm"
                disabled={!hasMore}
                onClick={() => handlePage(1)}
                className="px-2.5 py-1.5 rounded-[10px] text-text-muted hover:text-text-secondary disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}

// ── Admin access management panel ─────────────────────────────────────────

function AdminsPanel() {
  const [users, setUsers] = useState<UserRecord[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [currentUid, setCurrentUid] = useState<string | null>(null)

  useEffect(() => {
    const user = auth.currentUser
    if (user) setCurrentUid(user.uid)
  }, [])

  const fetchUsers = useCallback(async (pageNum: number) => {
    setIsLoading(true)
    setError(null)
    try {
      const headers = await authHeaders()
      const res = await fetch(
        `${API_BASE_URL}/api/admin/users?limit=${PAGE_SIZE}&offset=${pageNum * PAGE_SIZE}`,
        { headers }
      )
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as { detail?: string }).detail ?? `HTTP ${res.status}`)
      }
      const data = await res.json() as { users: UserRecord[]; has_more: boolean }
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
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as { detail?: string }).detail ?? `HTTP ${res.status}`)
      }
      setUsers((prev) =>
        prev.map((u) => (u.id === uid ? { ...u, is_admin: grantAdmin } : u))
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : `Failed to ${grantAdmin ? "grant" : "revoke"} admin`)
    } finally {
      setActionLoading(null)
    }
  }

  const handlePage = (delta: number) => {
    const next = page + delta
    setPage(next)
    fetchUsers(next)
  }

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h2 className="font-serif text-3xl font-semibold text-text-primary">Admin Access</h2>
          <p className="text-sm text-text-muted mt-1">
            Control which users have admin privileges
          </p>
        </div>
        <Button
          variant="ghost"
          onClick={() => fetchUsers(page)}
          disabled={isLoading}
          className="text-text-muted hover:text-text-secondary px-3 py-2 rounded-[14px] mt-1"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
        </Button>
      </div>

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
          <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--color-border-soft)]">
            <span className="text-xs text-text-muted">
              Showing {page * PAGE_SIZE + 1}–{page * PAGE_SIZE + users.length}
            </span>
            <div className="flex gap-1.5">
              <Button
                variant="ghost"
                size="sm"
                disabled={page === 0}
                onClick={() => handlePage(-1)}
                className="px-2.5 py-1.5 rounded-[10px] text-text-muted hover:text-text-secondary disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="flex items-center px-2 text-xs text-text-muted">Page {page + 1}</span>
              <Button
                variant="ghost"
                size="sm"
                disabled={!hasMore}
                onClick={() => handlePage(1)}
                className="px-2.5 py-1.5 rounded-[10px] text-text-muted hover:text-text-secondary disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}

// ── Main admin page ────────────────────────────────────────────────────────

export function AdminPage() {
  const [adminTab, setAdminTab] = useState<AdminTab>("dashboard")
  const [tab, setTab] = useState<LogTab>("translation")
  const [logs, setLogs] = useState<(TranslationLog | TranscriptionLog | FeedbackLog)[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)

  const fetchLogs = useCallback(async (logTab: LogTab, pageNum: number) => {
    setIsLoading(true)
    setError(null)
    try {
      const headers = await authHeaders()
      const res = await fetch(
        `${API_BASE_URL}/api/admin/logs?log_type=${logTab}&limit=${PAGE_SIZE}&offset=${
          pageNum * PAGE_SIZE
        }`,
        { headers }
      )
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as { detail?: string }).detail ?? `HTTP ${res.status}`)
      }
      const data = (await res.json()) as {
        logs: (TranslationLog | TranscriptionLog)[]
        has_more: boolean
      }
      setLogs(data.logs)
      setHasMore(data.has_more)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch logs")
      setLogs([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    setPage(0)
    fetchLogs(tab, 0)
  }, [tab, fetchLogs])

  const handleTabChange = (newTab: LogTab) => {
    if (newTab !== tab) setTab(newTab)
  }

  const handlePage = (delta: number) => {
    const next = page + delta
    setPage(next)
    fetchLogs(tab, next)
  }

  const TAB_LABELS: Record<LogTab, string> = {
    translation: "Translation Logs",
    transcription: "Transcription Logs",
    feedback: "Feedback",
  }

  const TOP_TABS: { id: AdminTab; label: string; icon: React.ReactNode }[] = [
    { id: "dashboard", label: "Dashboard", icon: <BarChart2 className="w-4 h-4" /> },
    { id: "usage", label: "Token Usage", icon: <Coins className="w-4 h-4" /> },
    { id: "users", label: "Users", icon: <Users className="w-4 h-4" /> },
    { id: "admins", label: "Admin Access", icon: <ShieldCheck className="w-4 h-4" /> },
    { id: "logs", label: "Activity Logs", icon: <FileText className="w-4 h-4" /> },
  ]

  return (
    <div className="w-full animate-fade-in-up" style={{ animationDelay: "0.2s" }}>
      {/* Top-level admin tab switcher */}
      <div className="inline-flex gap-1.5 p-1.5 bg-[var(--color-bg-cream)] rounded-[20px] border border-[var(--color-border-soft)] mb-8">
        {TOP_TABS.map(({ id, label, icon }) => (
          <button
            key={id}
            onClick={() => setAdminTab(id)}
            className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-[14px] text-sm font-medium transition-all ${
              adminTab === id
                ? "bg-[var(--color-bg-card)] text-[var(--color-accent-terracotta)] shadow-[var(--shadow-soft)]"
                : "text-text-secondary hover:text-text-primary hover:bg-white/50"
            }`}
          >
            {icon}
            {label}
          </button>
        ))}
      </div>

      {adminTab === "dashboard" && <DashboardPanel />}
      {adminTab === "usage" && <UsagePanel />}
      {adminTab === "users" && <UsersPanel />}
      {adminTab === "admins" && <AdminsPanel />}

      {adminTab === "logs" && (
        <>
          <div className="mb-6 flex items-start justify-between">
            <div>
              <h2 className="font-serif text-3xl font-semibold text-text-primary">
                Activity Logs
              </h2>
              <p className="text-sm text-text-muted mt-1">
                User queries, intermediate Gemini responses, and sign token output
              </p>
            </div>
            <Button
              variant="ghost"
              onClick={() => fetchLogs(tab, page)}
              disabled={isLoading}
              className="text-text-muted hover:text-text-secondary px-3 py-2 rounded-[14px] mt-1"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
          </div>

          {/* Log type tab switcher */}
          <div className="inline-flex gap-1.5 p-1.5 bg-[var(--color-bg-cream)] rounded-[20px] border border-[var(--color-border-soft)] mb-6">
            {(Object.keys(TAB_LABELS) as LogTab[]).map((t) => (
              <button
                key={t}
                onClick={() => handleTabChange(t)}
                className={`px-5 py-2.5 rounded-[14px] text-sm font-medium transition-all ${
                  tab === t
                    ? "bg-[var(--color-bg-card)] text-[var(--color-accent-terracotta)] shadow-[var(--shadow-soft)]"
                    : "text-text-secondary hover:text-text-primary hover:bg-white/50"
                }`}
              >
                {TAB_LABELS[t]}
              </button>
            ))}
          </div>

          {/* Table card */}
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
            ) : logs.length === 0 ? (
              <div className="p-16 text-center">
                <p className="text-text-muted text-sm">No logs found.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                {tab === "translation" ? (
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-[var(--color-border-soft)]">
                        {["Timestamp", "User", "Type", "Input", "Lang", "Gloss", "Output", ""].map(
                          (h) => (
                            <th
                              key={h}
                              className="py-3 px-4 text-xs uppercase tracking-widest text-text-muted font-medium whitespace-nowrap"
                            >
                              {h}
                            </th>
                          )
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {(logs as TranslationLog[]).map((log) => (
                        <TranslationRow key={log.id} log={log} />
                      ))}
                    </tbody>
                  </table>
                ) : tab === "transcription" ? (
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-[var(--color-border-soft)]">
                        {["Timestamp", "User", "Transcription", "Lang", ""].map((h) => (
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
                      {(logs as TranscriptionLog[]).map((log) => (
                        <TranscriptionRow key={log.id} log={log} />
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-[var(--color-border-soft)]">
                        {["Timestamp", "User", "Rating", "Comment", "Log Ref", ""].map((h) => (
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
                      {(logs as FeedbackLog[]).map((log) => (
                        <FeedbackRow key={log.id} log={log} />
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* Pagination footer */}
            {!isLoading && !error && logs.length > 0 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--color-border-soft)]">
                <span className="text-xs text-text-muted">
                  Showing {page * PAGE_SIZE + 1}–{page * PAGE_SIZE + logs.length}
                </span>
                <div className="flex gap-1.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={page === 0}
                    onClick={() => handlePage(-1)}
                    className="px-2.5 py-1.5 rounded-[10px] text-text-muted hover:text-text-secondary disabled:opacity-40"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="flex items-center px-2 text-xs text-text-muted">
                    Page {page + 1}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={!hasMore}
                    onClick={() => handlePage(1)}
                    className="px-2.5 py-1.5 rounded-[10px] text-text-muted hover:text-text-secondary disabled:opacity-40"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  )
}
