import { ChevronRight } from "lucide-react"
import type { LessonSummary, LessonProgress } from "./types"

interface LessonCardProps {
  lesson: LessonSummary
  progress?: LessonProgress
  onClick: () => void
}

export function LessonCard({ lesson, progress, onClick }: LessonCardProps) {
  const viewed = progress?.signs_viewed?.length ?? 0
  const total = lesson.sign_count
  const pct = total > 0 ? Math.min(100, Math.round((viewed / total) * 100)) : 0

  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-4 rounded-[16px] border border-[#f3f4f6] bg-white p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[14px] bg-[#f0fdf4] text-2xl">
        {lesson.emoji}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-semibold text-[#101828]">{lesson.lesson_name}</p>
        <div className="mt-1.5 flex items-center gap-2">
          <div className="h-[6px] flex-1 overflow-hidden rounded-full bg-[#f3f4f6]">
            <div className="h-full rounded-full bg-[#22c55e] transition-all" style={{ width: `${pct}%` }} />
          </div>
          <span className="shrink-0 text-[12px] font-medium text-[#99a1af]">
            {viewed}/{total}
          </span>
        </div>
      </div>
      <ChevronRight className="h-4 w-4 flex-shrink-0 text-[#99a1af]" />
    </button>
  )
}
