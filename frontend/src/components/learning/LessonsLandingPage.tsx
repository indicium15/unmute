import { useMemo, useState } from "react"
import { ArrowLeft } from "lucide-react"
import { AppNavbar, type NavMode } from "@/components/AppNavbar"
import { Footer } from "@/components/Footer"
import { LessonCard } from "./LessonCard"
import { difficultyTabLabel } from "./utils"
import type { LessonSummary, LessonProgress } from "./types"

const DIFFICULTY_ORDER = ["Beginner", "Intermediate", "Advanced"]

interface LessonsLandingPageProps {
  lessons: LessonSummary[]
  progress: LessonProgress[]
  loading: boolean
  error: string
  onSelectLesson: (lessonId: string) => void
  onNavigate: (dest: NavMode | "home") => void
  onSignOut: () => void
  isAdmin?: boolean
  isLoggedIn?: boolean
}

export function LessonsLandingPage({
  lessons,
  progress,
  loading,
  error,
  onSelectLesson,
  onNavigate,
  onSignOut,
  isAdmin,
  isLoggedIn,
}: LessonsLandingPageProps) {
  const progressByLesson = useMemo(() => {
    const map = new Map<string, LessonProgress>()
    for (const p of progress) map.set(p.lesson_id, p)
    return map
  }, [progress])

  const difficulties = useMemo(() => {
    const present = new Set(lessons.map((l) => l.difficulty ?? "Other"))
    const ordered = DIFFICULTY_ORDER.filter((d) => present.has(d))
    const extras = [...present].filter((d) => !DIFFICULTY_ORDER.includes(d))
    return [...ordered, ...extras]
  }, [lessons])

  const [activeDifficulty, setActiveDifficulty] = useState<string | null>(null)
  const selectedDifficulty = activeDifficulty ?? difficulties[0] ?? null

  const visibleLessons = useMemo(
    () => lessons.filter((l) => (l.difficulty ?? "Other") === selectedDifficulty),
    [lessons, selectedDifficulty]
  )

  const totalLessons = lessons.length
  const completedLessons = lessons.filter((l) => progressByLesson.get(l.lesson_id)?.completed).length
  const remainingLessons = totalLessons - completedLessons

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
      <section className="bg-[#6176f7] px-6 py-12">
        <div className="mx-auto max-w-[720px]">
          <button
            onClick={() => onNavigate("home")}
            className="mb-4 flex items-center gap-1.5 text-[14px] font-medium text-white/80 transition-colors hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <h1 className="text-[36px] font-bold leading-10 text-white">Your Lessons</h1>
          <p className="mt-1 text-[14px] text-white/70">Learn Singapore Sign Language one word at a time</p>

          <div className="mt-6 flex items-center justify-between rounded-[16px] bg-white/15 px-6 py-4">
            <div className="flex flex-1 flex-col items-center justify-center">
              <p className="text-[24px] font-bold text-white">{completedLessons}</p>
              <p className="text-[12px] text-white/70">Completed</p>
            </div>
            <div className="h-8 w-px bg-white/30" />
            <div className="flex flex-1 flex-col items-center justify-center">
              <p className="text-[24px] font-bold text-white">{remainingLessons}</p>
              <p className="text-[12px] text-white/70">Remaining</p>
            </div>
            <div className="h-8 w-px bg-white/30" />
            <div className="flex flex-1 flex-col items-center justify-center">
              <p className="text-[24px] font-bold text-white">{totalLessons}</p>
              <p className="text-[12px] text-white/70">Total</p>
            </div>
          </div>
        </div>
      </section>

      {/* Content */}
      <div className="mx-auto max-w-[848px] px-6 pt-8">
        {difficulties.length > 0 && (
          <div className="mb-6 flex flex-wrap gap-2">
            {difficulties.map((d) => {
              const count = lessons.filter((l) => (l.difficulty ?? "Other") === d).length
              const isActive = d === selectedDifficulty
              return (
                <button
                  key={d}
                  onClick={() => setActiveDifficulty(d)}
                  className={`rounded-full border px-4 py-1.5 text-[12px] font-medium transition-colors ${
                    isActive
                      ? "border-transparent bg-[#6176f7] text-white shadow-sm"
                      : "border-[#e5e7eb] bg-white text-[#4a5565] hover:border-[#6176f7]/40"
                  }`}
                >
                  {difficultyTabLabel(d)} ({count})
                </button>
              )
            })}
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-[14px] border border-amber-300 bg-amber-50 p-4 text-sm text-amber-700">
            {error}
          </div>
        )}

        <div className="flex flex-col gap-2.5 pb-16">
          {loading
            ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-[81px] animate-pulse rounded-[16px] bg-gray-100" />
              ))
            : visibleLessons.map((lesson) => (
                <LessonCard
                  key={lesson.lesson_id}
                  lesson={lesson}
                  progress={progressByLesson.get(lesson.lesson_id)}
                  onClick={() => onSelectLesson(lesson.lesson_id)}
                />
              ))}
          {!loading && visibleLessons.length === 0 && (
            <p className="py-8 text-center text-sm text-[#99a1af]">No lessons in this category yet.</p>
          )}
        </div>
      </div>

      <Footer onNavigate={onNavigate} />
    </div>
  )
}
