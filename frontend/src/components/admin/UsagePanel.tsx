import { useCallback, useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { API_BASE_URL, authHeaders, throwIfNotOk } from "./api"
import { formatUsd } from "./format"
import { PanelHeader } from "./PanelHeader"
import { BarChart } from "./BarChart"
import type { TokenUsageStats } from "./types"

// We don't have direct access to the Azure OpenAI usage/billing dashboard, so
// this approximates token spend from usage figures the API returns inline on
// each translate/transcribe request.

export function UsagePanel() {
  const [stats, setStats] = useState<TokenUsageStats | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchStats = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const headers = await authHeaders()
      const res = await fetch(`${API_BASE_URL}/api/admin/token-usage`, { headers })
      await throwIfNotOk(res)
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
      <PanelHeader
        title="Token Usage"
        subtitle={
          <>
            Approximate LLM token spend (translate + transcribe) — we don't have direct access to the
            Azure usage dashboard, so this is tracked from per-request usage figures. Cost is estimated
            using published Azure OpenAI rates: gpt-5.4-mini at $0.75 / $4.50 per 1M input/output tokens,
            gpt-realtime-whisper at $1.02 per hour of audio processed.
          </>
        }
        isLoading={isLoading}
        onRefresh={fetchStats}
      />

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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {[
              { label: "Input Tokens (30d)", value: stats.total_input_tokens.toLocaleString() },
              { label: "Output Tokens (30d)", value: stats.total_output_tokens.toLocaleString() },
              { label: "Total Tokens (30d)", value: stats.total_tokens.toLocaleString() },
              { label: "Estimated Cost (30d)", value: formatUsd(stats.total_cost_usd) },
            ].map(({ label, value }) => (
              <Card
                key={label}
                className="border border-[var(--color-border-soft)] rounded-[var(--radius-card)] p-5"
                style={{ boxShadow: "var(--shadow-soft)" }}
              >
                <p className="text-xs uppercase tracking-widest text-text-muted mb-2">{label}</p>
                <p className="font-serif text-4xl font-semibold text-text-primary">{value}</p>
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
              <BarChart data={stats.usage_by_day} value={(d) => d.total_tokens} />
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
                    {["Endpoint", "Input Tokens", "Output Tokens", "Total Tokens", "Estimated Cost"].map((h) => (
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
                      <td className="py-3 px-4 text-sm text-text-secondary">{formatUsd(usage.cost_usd)}</td>
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
