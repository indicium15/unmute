interface DailyDataPoint {
  date: string
}

interface BarChartProps<T extends DailyDataPoint> {
  data: T[]
  value: (d: T) => number
}

// Week boundary labels at indices 0, 7, 14, 21, 29 (assumes ~30 days of data).
const LABEL_INDICES = [0, 7, 14, 21, 29]

export function BarChart<T extends DailyDataPoint>({ data, value }: BarChartProps<T>) {
  const maxValue = Math.max(...data.map(value), 1)
  const chartH = 120
  const barW = 100 / data.length

  return (
    <div>
      <svg
        viewBox={`0 0 100 ${chartH}`}
        preserveAspectRatio="none"
        className="w-full"
        style={{ height: chartH }}
      >
        {data.map((d, i) => {
          const barH = (value(d) / maxValue) * chartH * 0.88
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
        {LABEL_INDICES.map((i) => {
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
