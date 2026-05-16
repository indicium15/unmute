import { useState, useEffect, useCallback, useMemo } from "react"
import { AlertCircle, ChevronLeft, LogOut } from "lucide-react"
import { auth } from "@/lib/firebase"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000"

async function authHeaders(): Promise<Record<string, string>> {
  const user = auth.currentUser
  if (!user) return {}
  const token = await user.getIdToken()
  return { Authorization: `Bearer ${token}` }
}

interface LearningSign {
  token: string
  sign_name: string
  gif_url: string
}

interface LessonSummary {
  lesson_id: string
  lesson_name: string
  description: string
  emoji: string
  sign_count: number
}

interface LessonDetail {
  lesson_id: string
  lesson_name: string
  description: string
  emoji: string
  signs: LearningSign[]
}

type AnswerState = "unanswered" | "correct" | "wrong"
type LessonQuizState = "idle" | "question" | "answered" | "complete"

function normalizeAssetUrl(url: string) {
  if (url.startsWith("http://") || url.startsWith("https://")) return url
  const baseUrl = API_BASE_URL.endsWith("/") ? API_BASE_URL.slice(0, -1) : API_BASE_URL
  const path = url.startsWith("/") ? url : `/${url}`
  return `${baseUrl}${path}`
}

function formatSignLabel(token: string) {
  return token
    .replace(/[_-]+/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function OfflineHint({ message }: { message: string }) {
  return (
    <div className="rounded-[14px] border border-amber-300 bg-amber-50 p-4 text-sm text-amber-700">
      <div className="flex gap-3">
        <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
        <p className="leading-relaxed">{message}</p>
      </div>
    </div>
  )
}

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

export interface LearningPageProps {
  onNavigate: (dest: "home" | "dictionary") => void
  onSignOut: () => void
}

export function LearningPage({ onNavigate, onSignOut }: LearningPageProps) {
  const [lessons, setLessons] = useState<LessonSummary[]>([])
  const [loadingLessons, setLoadingLessons] = useState(false)
  const [lessonsError, setLessonsError] = useState("")
  const [selectedLesson, setSelectedLesson] = useState<LessonDetail | null>(null)
  const [loadingLessonDetail, setLoadingLessonDetail] = useState(false)

  const [lessonQuizState, setLessonQuizState] = useState<LessonQuizState>("idle")
  const [lessonQuizOrder, setLessonQuizOrder] = useState<LearningSign[]>([])
  const [lessonQuizIndex, setLessonQuizIndex] = useState(0)
  const [lessonQuizSelected, setLessonQuizSelected] = useState<string | null>(null)
  const [lessonQuizAnswerState, setLessonQuizAnswerState] = useState<AnswerState>("unanswered")
  const [lessonScore, setLessonScore] = useState({ correct: 0, total: 0 })
  const [lessonMissed, setLessonMissed] = useState<LearningSign[]>([])

  const fetchLessons = useCallback(async () => {
    setLoadingLessons(true)
    setLessonsError("")
    try {
      const headers = await authHeaders()
      const res = await fetch(`${API_BASE_URL}/api/learning/lessons`, { headers })
      if (!res.ok) throw new Error("Unable to load lessons.")
      setLessons(await res.json())
    } catch (err) {
      console.error(err)
      setLessonsError("Lessons could not be loaded. Check that the backend is running.")
    } finally {
      setLoadingLessons(false)
    }
  }, [])

  const fetchLessonDetail = useCallback(async (lessonId: string) => {
    setLoadingLessonDetail(true)
    setSelectedLesson(null)
    setLessonQuizState("idle")
    try {
      const headers = await authHeaders()
      const res = await fetch(`${API_BASE_URL}/api/learning/lessons/${lessonId}`, { headers })
      if (!res.ok) throw new Error("Unable to load lesson.")
      setSelectedLesson(await res.json())
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingLessonDetail(false)
    }
  }, [])

  useEffect(() => {
    if (lessons.length === 0) fetchLessons()
  }, [fetchLessons, lessons.length])

  const startLessonQuiz = () => {
    if (!selectedLesson) return
    setLessonQuizOrder(shuffle(selectedLesson.signs))
    setLessonQuizIndex(0)
    setLessonQuizSelected(null)
    setLessonQuizAnswerState("unanswered")
    setLessonScore({ correct: 0, total: 0 })
    setLessonMissed([])
    setLessonQuizState("question")
  }

  const currentQuizSign = lessonQuizOrder[lessonQuizIndex]

  const quizOptions = useMemo(() => {
    if (!currentQuizSign || !selectedLesson) return []
    const others = selectedLesson.signs.filter((s) => s.token !== currentQuizSign.token)
    const wrong = shuffle(others).slice(0, 3)
    return shuffle([currentQuizSign, ...wrong])
  }, [currentQuizSign, selectedLesson])

  const handleQuizSelect = (token: string) => {
    if (lessonQuizAnswerState !== "unanswered" || !currentQuizSign) return
    setLessonQuizSelected(token)
    const isCorrect = token === currentQuizSign.token
    setLessonQuizAnswerState(isCorrect ? "correct" : "wrong")
    setLessonScore((s) => ({ correct: s.correct + (isCorrect ? 1 : 0), total: s.total + 1 }))
    if (!isCorrect) {
      setLessonMissed((prev) =>
        prev.some((s) => s.token === currentQuizSign.token) ? prev : [...prev, currentQuizSign]
      )
    }
  }

  const advanceQuiz = () => {
    const nextIndex = lessonQuizIndex + 1
    if (nextIndex >= lessonQuizOrder.length) {
      setLessonQuizState("complete")
    } else {
      setLessonQuizIndex(nextIndex)
      setLessonQuizSelected(null)
      setLessonQuizAnswerState("unanswered")
      setLessonQuizState("question")
    }
  }

  const optionClass = (token: string) => {
    const base =
      "group flex w-full min-h-[72px] items-center gap-3 rounded-[14px] border px-4 py-3 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6176f7]/70 focus-visible:ring-offset-2 sm:min-h-[76px]"
    if (lessonQuizAnswerState === "unanswered") {
      return cn(
        base,
        "cursor-pointer border-gray-200 bg-gray-50 text-[#101828] hover:-translate-y-0.5 hover:border-[#6176f7]/60 hover:bg-[#6176f7]/5 hover:shadow-md active:translate-y-0"
      )
    }
    if (token === currentQuizSign?.token) {
      return cn(base, "border-emerald-400 bg-emerald-50 text-emerald-700 shadow-[0_0_0_1px_rgba(16,185,129,0.15)]")
    }
    if (token === lessonQuizSelected) {
      return cn(base, "border-red-400 bg-red-50 text-red-600 shadow-[0_0_0_1px_rgba(239,68,68,0.15)]")
    }
    return cn(base, "border-gray-100 bg-gray-50/50 text-gray-400 opacity-55")
  }

  const optionBadgeClass = (token: string) => {
    const base = "grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold transition-colors"
    if (lessonQuizAnswerState === "unanswered") {
      return cn(base, "bg-[#6176f7]/15 text-[#6176f7] group-hover:bg-[#6176f7] group-hover:text-white")
    }
    if (token === currentQuizSign?.token) return cn(base, "bg-emerald-400 text-emerald-950")
    if (token === lessonQuizSelected) return cn(base, "bg-red-400 text-red-950")
    return cn(base, "bg-gray-200 text-gray-400")
  }

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-100 shadow-sm">
        <div className="max-w-[1152px] mx-auto px-6 h-16 flex items-center justify-between">
          <button onClick={() => onNavigate("home")} className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-[14px] bg-[#6176f7] shadow flex items-center justify-center flex-shrink-0">
              <img src="/home/icon-logo.svg" alt="" className="w-5 h-5" />
            </div>
            <div className="text-left">
              <p className="text-[14px] font-semibold leading-5 text-[#6176f7]">SgSL</p>
              <p className="text-[12px] font-normal leading-4 text-[#6a7282]">Singapore Sign Language</p>
            </div>
          </button>

          <div className="flex items-center gap-1 p-1">
            <button
              onClick={() => onNavigate("home")}
              className="px-4 py-2 rounded-[10px] text-[14px] font-normal text-[#4a5565] hover:bg-gray-100 transition-colors"
            >
              Home
            </button>
            <button
              onClick={() => onNavigate("dictionary")}
              className="px-4 py-2 rounded-[10px] text-[14px] font-normal text-[#4a5565] hover:bg-gray-100 transition-colors"
            >
              Dictionary
            </button>
            <button className="px-4 py-2 rounded-[10px] text-[14px] font-medium text-white bg-[#6176f7] shadow">
              Learn SGSL
            </button>
          </div>

          <button
            onClick={onSignOut}
            className="flex items-center gap-2 px-4 py-2 rounded-[10px] text-[14px] font-medium text-[#4a5565] hover:bg-gray-100 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section className="bg-[#6176f7] pt-12 pb-8">
        <div className="max-w-[1152px] mx-auto px-6">
          <h1 className="text-[30px] font-bold text-white leading-9 mb-3">Learn Singapore Sign Language</h1>
          <p className="text-[16px] text-white/80 leading-relaxed max-w-xl">
            Work through structured lessons, then quiz yourself on what you've learned.
          </p>
        </div>
      </section>

      {/* Content */}
      <div className="max-w-[1152px] mx-auto px-6 py-8 flex flex-col gap-6">
        {/* Lessons list */}
        {!selectedLesson && !loadingLessonDetail && (
          <div className="rounded-[16px] border border-gray-100 bg-white shadow-sm p-6">
            <div className="mb-5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#99a1af]">Curriculum</p>
              <h2 className="mt-1 text-xl font-semibold text-[#101828]">Lessons</h2>
              <p className="mt-1 text-sm text-[#6a7282]">
                Each lesson covers a theme. Work through the signs, then take the lesson quiz.
              </p>
            </div>
            {lessonsError && <div className="mb-4"><OfflineHint message={lessonsError} /></div>}
            <div className="grid gap-4 sm:grid-cols-2">
              {loadingLessons
                ? Array.from({ length: 2 }).map((_, i) => (
                    <div key={i} className="h-32 rounded-[12px] bg-gray-100 animate-pulse" />
                  ))
                : lessons.map((lesson) => (
                    <button
                      key={lesson.lesson_id}
                      onClick={() => fetchLessonDetail(lesson.lesson_id)}
                      className="text-left overflow-hidden rounded-[12px] border border-gray-100 bg-gray-50 p-5 transition-all hover:-translate-y-0.5 hover:border-[#6176f7]/50 hover:shadow-md"
                    >
                      <div className="text-3xl mb-3">{lesson.emoji}</div>
                      <p className="font-semibold text-[#101828] leading-snug text-[16px]">{lesson.lesson_name}</p>
                      <p className="mt-1.5 text-xs text-[#6a7282] leading-relaxed line-clamp-2">{lesson.description}</p>
                      <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#6176f7]">
                        {lesson.sign_count} signs
                      </p>
                    </button>
                  ))}
            </div>
          </div>
        )}

        {loadingLessonDetail && (
          <div className="rounded-[16px] border border-gray-100 bg-white shadow-sm p-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-44 rounded-[12px] bg-gray-100 animate-pulse" />
              ))}
            </div>
          </div>
        )}

        {/* Lesson detail */}
        {selectedLesson && lessonQuizState === "idle" && (
          <div className="rounded-[16px] border border-gray-100 bg-white shadow-sm p-6">
            <div className="mb-5 flex items-start gap-3">
              <button
                onClick={() => setSelectedLesson(null)}
                className="mt-1 shrink-0 text-[#6a7282] hover:text-[#101828] transition-colors"
                aria-label="Back to lessons"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#99a1af]">
                  {selectedLesson.emoji} Lesson
                </p>
                <h2 className="mt-1 text-xl font-semibold text-[#101828]">{selectedLesson.lesson_name}</h2>
                <p className="mt-1 text-sm text-[#6a7282]">{selectedLesson.description}</p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {selectedLesson.signs.map((sign) => (
                <article key={sign.token} className="overflow-hidden rounded-[12px] border border-gray-100 bg-gray-50">
                  <div className="flex h-36 items-center justify-center bg-gray-100">
                    <img
                      src={normalizeAssetUrl(sign.gif_url)}
                      alt={`Sign for ${sign.token}`}
                      className="h-full w-full object-contain"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2 p-3">
                    <Badge variant="outline">{sign.token}</Badge>
                    <span className="truncate text-xs text-[#6a7282]">{sign.sign_name}</span>
                  </div>
                </article>
              ))}
            </div>
            {selectedLesson.signs.length >= 2 && (
              <div className="mt-6">
                <Button
                  className="w-full bg-[#6176f7] hover:bg-[#5068f0] text-white"
                  onClick={startLessonQuiz}
                >
                  Start quiz — {selectedLesson.signs.length} questions
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Quiz */}
        {selectedLesson && (lessonQuizState === "question" || lessonQuizState === "answered") && currentQuizSign && (
          <div className="rounded-[16px] border border-gray-100 bg-white shadow-sm p-6">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#99a1af]">
                  {selectedLesson.emoji} {selectedLesson.lesson_name}
                </p>
                <h2 className="mt-1 text-xl font-semibold text-[#101828]">Which sign is being shown?</h2>
              </div>
              <span className="shrink-0 rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-[#6a7282]">
                {lessonQuizIndex + 1} / {lessonQuizOrder.length}
              </span>
            </div>

            <div className="mx-auto flex h-[260px] w-full max-w-3xl items-center justify-center overflow-hidden rounded-[12px] border border-gray-100 bg-gray-50 sm:h-[320px] lg:h-[360px]">
              <img
                key={currentQuizSign.gif_url}
                src={normalizeAssetUrl(currentQuizSign.gif_url)}
                alt={`Sign for ${currentQuizSign.token}`}
                className="h-full w-full object-contain"
              />
            </div>

            <div className="mx-auto mt-5 grid w-full max-w-4xl grid-cols-1 gap-3 sm:grid-cols-2">
              {quizOptions.map((sign, index) => (
                <button
                  key={sign.token}
                  onClick={() => handleQuizSelect(sign.token)}
                  disabled={lessonQuizAnswerState !== "unanswered"}
                  className={optionClass(sign.token)}
                >
                  <span className={optionBadgeClass(sign.token)}>{String.fromCharCode(65 + index)}</span>
                  <span className="min-w-0">
                    <span className="block truncate text-base font-semibold leading-tight text-inherit sm:text-lg">
                      {formatSignLabel(sign.token)}
                    </span>
                    <span className="mt-1 block truncate text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6a7282] group-hover:text-[#4a5565]">
                      {sign.token}
                    </span>
                  </span>
                </button>
              ))}
            </div>

            {lessonQuizAnswerState !== "unanswered" && (
              <div className="mx-auto w-full max-w-4xl">
                <Button
                  className="mt-4 w-full bg-[#6176f7] hover:bg-[#5068f0] text-white"
                  onClick={advanceQuiz}
                >
                  {lessonQuizIndex + 1 < lessonQuizOrder.length ? "Next sign" : "See results"}
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Quiz results */}
        {selectedLesson && lessonQuizState === "complete" && (
          <div className="rounded-[16px] border border-gray-100 bg-white shadow-sm p-6">
            <div className="mb-2 flex items-start gap-3">
              <button
                onClick={() => { setSelectedLesson(null); setLessonQuizState("idle") }}
                className="mt-1 shrink-0 text-[#6a7282] hover:text-[#101828] transition-colors"
                aria-label="Back to lessons"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#99a1af]">Quiz complete</p>
                <h2 className="mt-1 text-xl font-semibold text-[#101828]">{selectedLesson.lesson_name}</h2>
              </div>
            </div>

            <div className="my-8 flex flex-col items-center gap-2 text-center">
              <p className="text-5xl font-semibold text-[#101828]">
                {lessonScore.correct}/{lessonScore.total}
              </p>
              <p className="text-sm text-[#6a7282]">
                {lessonScore.correct === lessonScore.total
                  ? "Perfect score! 🎉"
                  : lessonScore.correct / lessonScore.total >= 0.7
                  ? "Good work — review the missed signs below."
                  : "Keep practicing — try the quiz again."}
              </p>
            </div>

            {lessonMissed.length > 0 && (
              <div className="mb-6">
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-[#99a1af]">Missed signs</p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {lessonMissed.map((sign) => (
                    <article key={sign.token} className="overflow-hidden rounded-[12px] border border-red-200 bg-red-50">
                      <div className="flex h-36 items-center justify-center bg-gray-100">
                        <img
                          src={normalizeAssetUrl(sign.gif_url)}
                          alt={`Sign for ${sign.token}`}
                          className="h-full w-full object-contain"
                        />
                      </div>
                      <div className="flex items-center justify-between gap-2 p-3">
                        <Badge variant="outline">{sign.token}</Badge>
                        <span className="truncate text-xs text-[#6a7282]">{sign.sign_name}</span>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                className="flex-1 bg-[#6176f7] hover:bg-[#5068f0] text-white"
                onClick={startLessonQuiz}
              >
                Try again
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setLessonQuizState("idle")}
              >
                Back to lesson
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
