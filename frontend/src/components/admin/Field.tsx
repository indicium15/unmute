interface FieldProps {
  label: string
  value: string
  mono?: boolean
  accent?: boolean
}

export function Field({ label, value, mono = false, accent = false }: FieldProps) {
  return (
    <div>
      <p className="text-xs uppercase tracking-widest text-text-muted mb-1">{label}</p>
      <p
        className={`${mono ? "font-mono text-xs" : "text-sm"} ${
          accent ? "text-[var(--color-accent-terracotta)]" : "text-text-primary"
        } break-all`}
      >
        {value}
      </p>
    </div>
  )
}
