import { useState, useEffect, useCallback } from "react"
import { ChevronDown, ChevronRight, ChevronLeft, RefreshCw, ThumbsUp, ThumbsDown } from "lucide-react"
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

type LogTab = "translation" | "transcription" | "feedback"

interface TranslationLog {
  id: string
  user_id: string
  user_email: string | null
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
  user_id: string
  user_email: string | null
  timestamp: string
  transcription: string
  detected_language: string | null
}

interface FeedbackLog {
  id: string
  user_id: string
  user_email: string | null
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

function truncate(s: string, n = 60): string {
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
          {log.gemini_gloss.length} tokens
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
              <Field label="User ID" value={log.user_id} mono />
              <Field
                label="Gemini Gloss"
                value={log.gemini_gloss.join(", ") || "—"}
              />
              {log.gemini_unmatched.length > 0 && (
                <Field
                  label="Unmatched Tokens"
                  value={log.gemini_unmatched.join(", ")}
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
                value={log.output_tokens.join(", ") || "—"}
              />
              <Field
                label="Output Sign Names"
                value={log.output_sign_names.join(", ") || "—"}
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
              <Field label="User ID" value={log.user_id} mono />
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
              <Field label="User ID" value={log.user_id} mono />
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

// ── Main admin page ────────────────────────────────────────────────────────

export function AdminPage() {
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

  return (
    <div className="w-full animate-fade-in-up" style={{ animationDelay: "0.2s" }}>
      {/* Page header */}
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

      {/* Tab switcher */}
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
    </div>
  )
}
