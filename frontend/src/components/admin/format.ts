export function formatTimestamp(ts: string): string {
  try {
    return new Date(ts).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    })
  } catch {
    return ts
  }
}

export function truncate(s: string | null | undefined, n = 60): string {
  if (!s) return ""
  return s.length > n ? s.slice(0, n) + "…" : s
}

export function formatUsd(value: number): string {
  return value < 1 ? `$${value.toFixed(4)}` : `$${value.toFixed(2)}`
}
