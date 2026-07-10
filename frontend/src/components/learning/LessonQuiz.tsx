import { useMemo, useState } from "react"
import { ArrowLeft, ChevronRight, Circle, CircleCheck, CircleX } from "lucide-react"
import { AppNavbar, type NavMode } from "@/components/AppNavbar"
import { cn } from "@/lib/utils"
import { formatSignLabel, shuffle } from "./utils"
import type { LessonDetail, LessonSign } from "./types"

type AnswerState = "unanswered" | "correct" | "wrong"

export interface LessonQuizResult {
  correct: number
  total: number
  missed: LessonSign[]
}

interface LessonQuizProps {
  lesson: LessonDetail
  onComplete: (result: LessonQuizResult) => void
  onBack: () => void
  onNavigate: (dest: NavMode | "home") => void
  onSignOut: () => void
  isAdmin?: boolean
  isLoggedIn?: boolean
}

function usageBullets(visualGuide?: string | null): string[] {
  if (!visualGuide || visualGuide === "N/A") return []
  return visualGuide
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

export function LessonQuiz({ lesson, onComplete, onBack, onNavigate, onSignOut, isAdmin, isLoggedIn }: LessonQuizProps) {
  const [order] = useState<LessonSign[]>(() => shuffle(lesson.signs))
  const [index, setIndex] = useState(0)
  const [selected, setSelected] = useState<string | null>(null)
  const [answerState, setAnswerState] = useState<AnswerState>("unanswered")
  const [score, setScore] = useState({ correct: 0, total: 0 })
  const [missed, setMissed] = useState<LessonSign[]>([])

  const currentSign = order[index]

  const options = useMemo(() => {
    if (!currentSign) return []
    const others = lesson.signs.filter((s) => s.token !== currentSign.token)
    const wrong = shuffle(others).slice(0, 3)
    return shuffle([currentSign, ...wrong])
  }, [currentSign, lesson.signs])

  const handleSelect = (token: string) => {
    if (answerState !== "unanswered" || !currentSign) return
    setSelected(token)
    const isCorrect = token === currentSign.token
    setAnswerState(isCorrect ? "correct" : "wrong")
    setScore((s) => ({ correct: s.correct + (isCorrect ? 1 : 0), total: s.total + 1 }))
    if (!isCorrect) {
      setMissed((prev) => (prev.some((s) => s.token === currentSign.token) ? prev : [...prev, currentSign]))
    }
  }

  const advance = () => {
    const nextIndex = index + 1
    if (nextIndex >= order.length) {
      onComplete({ correct: score.correct, total: score.total, missed })
    } else {
      setIndex(nextIndex)
      setSelected(null)
      setAnswerState("unanswered")
    }
  }

  if (!currentSign) return null

  const optionRowClass = (token: string) => {
    const base = "flex w-full items-center gap-3 rounded-[14px] border px-4 py-3.5 text-left text-[14px] font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6176f7]/70 focus-visible:ring-offset-2"
    if (answerState === "unanswered") {
      return cn(base, "cursor-pointer border-gray-200 bg-white text-[#101828] hover:border-[#6176f7]/60 hover:bg-[#6176f7]/5")
    }
    if (token === currentSign.token) return cn(base, "border-emerald-300 bg-emerald-50 text-emerald-700")
    if (token === selected) return cn(base, "border-red-300 bg-red-50 text-red-600")
    return cn(base, "border-gray-100 bg-gray-50 text-gray-400")
  }

  const optionIcon = (token: string) => {
    if (answerState !== "unanswered" && token === currentSign.token) return <CircleCheck className="h-5 w-5 shrink-0 text-emerald-500" />
    if (answerState !== "unanswered" && token === selected) return <CircleX className="h-5 w-5 shrink-0 text-red-500" />
    return <Circle className="h-5 w-5 shrink-0 text-gray-300" />
  }

  const label = formatSignLabel(currentSign.token)
  const bullets = usageBullets(currentSign.visual_guide)

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
              <div
                className="h-full rounded-full bg-white transition-all"
                style={{ width: `${((index + 1) / order.length) * 100}%` }}
              />
            </div>
            <span className="shrink-0 text-[12px] font-medium text-white/80">
              {index + 1}/{order.length}
            </span>
          </div>
        </div>
      </section>

      {/* Content */}
      <div className="mx-auto max-w-[728px] px-6 py-8">
        <p className="mb-4 text-center text-[15px] text-[#4a5565]">What sign is being shown?</p>

        <div className="relative flex h-[280px] items-center justify-center overflow-hidden rounded-[14px] border border-[#e5e7eb] bg-[#f8f9ff] sm:h-[320px]">
          <img key={currentSign.gif_url} src={currentSign.gif_url} alt={`Sign for ${currentSign.token}`} className="h-full w-full object-contain" />
          <span className="absolute bottom-3 right-3 rounded-full bg-black/40 px-2 py-0.5 text-[11px] text-white">
            Signing animation
          </span>
        </div>

        <div className="mt-5 flex flex-col gap-2.5">
          {options.map((sign) => (
            <button
              key={sign.token}
              onClick={() => handleSelect(sign.token)}
              disabled={answerState !== "unanswered"}
              className={optionRowClass(sign.token)}
            >
              {optionIcon(sign.token)}
              {formatSignLabel(sign.token)}
            </button>
          ))}
        </div>

        {answerState !== "unanswered" && (
          <>
            <div
              className={cn(
                "mt-4 flex items-center gap-2 rounded-[12px] border px-4 py-3 text-[14px] font-semibold",
                answerState === "correct" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-600"
              )}
            >
              {answerState === "correct" ? <CircleCheck className="h-4 w-4 shrink-0" /> : <CircleX className="h-4 w-4 shrink-0" />}
              {answerState === "correct" ? "Correct!" : `Incorrect — the answer is "${label}"`}
            </div>

            <div className="mt-4 rounded-[14px] bg-gray-50 p-5">
              <h3 className="text-[16px] font-bold text-[#101828]">{label}</h3>
              <span className="mt-2 inline-block rounded-full bg-[#6176f7]/10 px-3 py-1 text-[12px] font-medium text-[#6176f7]">
                {lesson.lesson_name}
              </span>
              {currentSign.description && (
                <p className="mt-3 text-[14px] leading-relaxed text-[#4a5565]">{currentSign.description}</p>
              )}
              {bullets.length > 0 && (
                <div className="mt-4">
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#99a1af]">Usage</p>
                  <ul className="space-y-1">
                    {bullets.map((bullet, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-[14px] text-[#4a5565]">
                        <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[#99a1af]" />
                        {bullet}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <button
              onClick={advance}
              className="mt-5 flex w-full items-center justify-center gap-1.5 rounded-[12px] bg-[#6176f7] py-3.5 text-[14px] font-semibold text-white transition-colors hover:bg-[#5068f0]"
            >
              {index + 1 < order.length ? "Next Word" : "See Results"}
              <ChevronRight className="h-4 w-4" />
            </button>
          </>
        )}
      </div>
    </div>
  )
}
