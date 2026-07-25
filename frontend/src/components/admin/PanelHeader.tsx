import type { ReactNode } from "react"
import { RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"

interface PanelHeaderProps {
  title: string
  subtitle: ReactNode
  isLoading: boolean
  onRefresh: () => void
}

export function PanelHeader({ title, subtitle, isLoading, onRefresh }: PanelHeaderProps) {
  return (
    <div className="mb-6 flex items-start justify-between">
      <div>
        <h2 className="font-serif text-3xl font-semibold text-text-primary">{title}</h2>
        <p className="text-sm text-text-muted mt-1">{subtitle}</p>
      </div>
      <Button
        variant="ghost"
        onClick={onRefresh}
        disabled={isLoading}
        className="text-text-muted hover:text-text-secondary px-3 py-2 rounded-[14px] mt-1"
        title="Refresh"
      >
        <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
      </Button>
    </div>
  )
}
