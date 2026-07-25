import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PAGE_SIZE } from "./api"

interface PaginationFooterProps {
  page: number
  itemCount: number
  hasMore: boolean
  onPageChange: (delta: number) => void
}

export function PaginationFooter({ page, itemCount, hasMore, onPageChange }: PaginationFooterProps) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--color-border-soft)]">
      <span className="text-xs text-text-muted">
        Showing {page * PAGE_SIZE + 1}-{page * PAGE_SIZE + itemCount}
      </span>
      <div className="flex gap-1.5">
        <Button
          variant="ghost"
          size="sm"
          disabled={page === 0}
          onClick={() => onPageChange(-1)}
          className="px-2.5 py-1.5 rounded-[10px] text-text-muted hover:text-text-secondary disabled:opacity-40"
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <span className="flex items-center px-2 text-xs text-text-muted">Page {page + 1}</span>
        <Button
          variant="ghost"
          size="sm"
          disabled={!hasMore}
          onClick={() => onPageChange(1)}
          className="px-2.5 py-1.5 rounded-[10px] text-text-muted hover:text-text-secondary disabled:opacity-40"
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  )
}
