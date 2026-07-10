import { ArrowLeft, RotateCcw, Star, Trophy } from "lucide-react"
import { AppNavbar, type NavMode } from "@/components/AppNavbar"
import { cn } from "@/lib/utils"
import type { LessonDetail, LessonSign } from "./types"

interface LessonQuizResultsProps {
  lesson: LessonDetail
  correct: number
  total: number
  missed: LessonSign[]
  onRetry: () => void
  onBack: () => void
  onBackToLessons: () => void
  onNavigate: (dest: NavMode | "home") => void
  onSignOut: () => void
  isAdmin?: boolean
  isLoggedIn?: boolean
}

function starsForScore(pct: number): number {
  if (pct >= 90) return 3
  if (pct >= 70) return 2
  if (pct > 0) return 1
  return 0
}

export function LessonQuizResults({
  lesson,
  correct,
  total,
  onRetry,
  onBack,
  onBackToLessons,
  onNavigate,
  onSignOut,
  isAdmin,
  isLoggedIn,
}: LessonQuizResultsProps) {
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0
  const stars = starsForScore(pct)

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
      <AppNavbar
        activeMode="learn"
        onNavigate={(dest) => onNavigate(dest)}
        onLogout={onSignOut}
        isAdmin={isAdmin}
        isLoggedIn={isLoggedIn}
      />

      {/* Hero */}
      <section className="bg-[#6176f7] px-6 py-8">
        <div className="mx-auto max-w-[1152px]">
          <button
            onClick={onBack}
            className="mb-4 flex items-center gap-1.5 text-[14px] font-medium text-white/80 transition-colors hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <h1 className="text-[30px] font-bold leading-9 text-white">{lesson.lesson_name}</h1>
          <div className="mt-4 flex items-center gap-3">
            <div className="h-2 max-w-[400px] flex-1 overflow-hidden rounded-full bg-white/30">
              <div className="h-full w-full rounded-full bg-white transition-all" />
            </div>
            <span className="shrink-0 text-[12px] font-medium text-white/80">
              {total}/{total}
            </span>
          </div>
        </div>
      </section>

      {/* Content */}
      <div className="mx-auto flex max-w-[520px] flex-col items-center px-6 py-14 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#eef0fe]">
          <Trophy className="h-8 w-8 text-[#6176f7]" />
        </div>
        <h2 className="mt-4 text-[24px] font-bold text-[#101828]">Lesson Complete!</h2>
        <p className="mt-1 text-[14px] text-[#6a7282]">
          You finished <span className="font-semibold text-[#101828]">{lesson.lesson_name}</span>
        </p>

        <div className="mt-8 flex h-36 w-36 flex-col items-center justify-center rounded-full border-4 border-[#6176f7]">
          <span className="text-[28px] font-bold text-[#6176f7]">{pct}%</span>
          <span className="text-[12px] text-[#6a7282]">
            {correct}/{total} correct
          </span>
        </div>

        <div className="mt-5 flex items-center gap-2">
          {[0, 1, 2].map((i) => (
            <Star
              key={i}
              className={cn("h-7 w-7", i < stars ? "fill-amber-400 text-amber-400" : "fill-amber-100 text-amber-200")}
            />
          ))}
        </div>

        <div className="mt-8 flex w-full flex-col gap-3">
          <button
            onClick={onBackToLessons}
            className="w-full rounded-[12px] bg-[#6176f7] py-3.5 text-[14px] font-semibold text-white transition-colors hover:bg-[#5068f0]"
          >
            Back to Lessons
          </button>
          <button
            onClick={onRetry}
            className="flex w-full items-center justify-center gap-2 rounded-[12px] border border-[#e5e7eb] py-3.5 text-[14px] font-semibold text-[#4a5565] transition-colors hover:border-[#6176f7]/40 hover:text-[#6176f7]"
          >
            <RotateCcw className="h-4 w-4" />
            Try Again
          </button>
        </div>
      </div>
    </div>
  )
}
