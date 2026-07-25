import { useCallback, useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { API_BASE_URL, PAGE_SIZE, authHeaders, throwIfNotOk } from "./api"
import { PanelHeader } from "./PanelHeader"
import { PaginationFooter } from "./PaginationFooter"
import { TranslationRow, TranscriptionRow, FeedbackRow } from "./LogRows"
import type { LogTab, TranslationLog, TranscriptionLog, FeedbackLog } from "./types"

const TAB_LABELS: Record<LogTab, string> = {
  translation: "Translation Logs",
  transcription: "Transcription Logs",
  feedback: "Feedback",
}

const TABLE_HEADERS: Record<LogTab, string[]> = {
  translation: ["Timestamp", "User", "Type", "Input", "Lang", "Gloss", "Output", ""],
  transcription: ["Timestamp", "User", "Transcription", "Lang", ""],
  feedback: ["Timestamp", "User", "Rating", "Comment", "Log Ref", ""],
}

export function LogsPanel() {
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
      await throwIfNotOk(res)
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

  return (
    <>
      <PanelHeader
        title="Activity Logs"
        subtitle="User queries, intermediate Gemini responses, and sign token output"
        isLoading={isLoading}
        onRefresh={() => fetchLogs(tab, page)}
      />

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
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[var(--color-border-soft)]">
                  {TABLE_HEADERS[tab].map((h) => (
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
                {tab === "translation"
                  ? (logs as TranslationLog[]).map((log) => <TranslationRow key={log.id} log={log} />)
                  : tab === "transcription"
                  ? (logs as TranscriptionLog[]).map((log) => <TranscriptionRow key={log.id} log={log} />)
                  : (logs as FeedbackLog[]).map((log) => <FeedbackRow key={log.id} log={log} />)}
              </tbody>
            </table>
          </div>
        )}

        {!isLoading && !error && logs.length > 0 && (
          <PaginationFooter page={page} itemCount={logs.length} hasMore={hasMore} onPageChange={handlePage} />
        )}
      </Card>
    </>
  )
}
