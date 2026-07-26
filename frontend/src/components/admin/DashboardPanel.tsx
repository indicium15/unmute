import { useCallback, useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { API_BASE_URL, authHeaders, throwIfNotOk } from "./api"
import { PanelHeader } from "./PanelHeader"
import { BarChart } from "./BarChart"
import type { DashboardStats } from "./types"

export function DashboardPanel() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchStats = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const headers = await authHeaders()
      const res = await fetch(`${API_BASE_URL}/api/admin/stats`, { headers })
      await throwIfNotOk(res)
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
      <PanelHeader
        title="Dashboard"
        subtitle="Overview of users and query activity"
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
              <BarChart data={stats.queries_by_day} value={(d) => d.count} />
            ) : (
              <p className="text-text-muted text-sm text-center py-8">No query data yet</p>
            )}
          </Card>
        </>
      ) : null}
    </div>
  )
}
