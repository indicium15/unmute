import { useState, useEffect, useCallback, useMemo } from "react"
import { AlertCircle, BookOpen, ChevronLeft, GraduationCap, RefreshCw, RotateCcw, Search } from "lucide-react"
import { auth } from "@/lib/firebase"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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

interface SignsResponse {
  signs: LearningSign[]
  total: number
  has_more: boolean
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
type LearningView = "lessons" | "browse" | "review"
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

export function LearningPage() {
  const [view, setView] = useState<LearningView>("lessons")

  // ── Lessons state ────────────────────────────────────────────────────────────
  const [lessons, setLessons] = useState<LessonSummary[]>([])
  const [loadingLessons, setLoadingLessons] = useState(false)
  const [lessonsError, setLessonsError] = useState("")
  const [selectedLesson, setSelectedLesson] = useState<LessonDetail | null>(null)
  const [loadingLessonDetail, setLoadingLessonDetail] = useState(false)

  // ── Lesson quiz state ─────────────────────────────────────────────────────────
  const [lessonQuizState, setLessonQuizState] = useState<LessonQuizState>("idle")
  const [lessonQuizOrder, setLessonQuizOrder] = useState<LearningSign[]>([])
  const [lessonQuizIndex, setLessonQuizIndex] = useState(0)
  const [lessonQuizSelected, setLessonQuizSelected] = useState<string | null>(null)
  const [lessonQuizAnswerState, setLessonQuizAnswerState] = useState<AnswerState>("unanswered")
  const [lessonScore, setLessonScore] = useState({ correct: 0, total: 0 })
  const [lessonMissed, setLessonMissed] = useState<LearningSign[]>([])

  // ── Browse state ──────────────────────────────────────────────────────────────
  const [search, setSearch] = useState("")
  const [signs, setSigns] = useState<LearningSign[]>([])
  const [loadingSigns, setLoadingSigns] = useState(false)
  const [signsError, setSignsError] = useState("")

  // ── Review state ──────────────────────────────────────────────────────────────
  const [missedSigns, setMissedSigns] = useState<LearningSign[]>([])

  // ── Fetch functions ───────────────────────────────────────────────────────────
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

  const fetchSigns = useCallback(async (query: string) => {
    setLoadingSigns(true)
    setSignsError("")
    try {
      const headers = await authHeaders()
      const params = new URLSearchParams({ q: query, limit: "48", offset: "0" })
      const res = await fetch(`${API_BASE_URL}/api/learning/signs?${params.toString()}`, { headers })
      if (!res.ok) throw new Error("Unable to load signs.")
      const data: SignsResponse = await res.json()
      setSigns(data.signs)
    } catch (err) {
      console.error(err)
      setSigns([])
      setSignsError("Vocabulary browse is unavailable. Check that the local backend is running and serving local static assets.")
    } finally {
      setLoadingSigns(false)
    }
  }, [])

  // ── Effects ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (view !== "lessons") return
    if (lessons.length === 0) fetchLessons()
  }, [fetchLessons, lessons.length, view])

  useEffect(() => {
    if (view !== "browse") return
    const handle = window.setTimeout(() => fetchSigns(search), 250)
    return () => window.clearTimeout(handle)
  }, [fetchSigns, search, view])

  // ── Lesson quiz helpers ───────────────────────────────────────────────────────
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
      setLessonMissed((prev) => prev.some((s) => s.token === currentQuizSign.token) ? prev : [...prev, currentQuizSign])
      setMissedSigns((prev) => prev.some((s) => s.token === currentQuizSign.token) ? prev : [currentQuizSign, ...prev].slice(0, 12))
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
    const base = "group flex w-full min-h-[72px] items-center gap-3 rounded-[14px] border px-4 py-3 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-terracotta/70 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-card sm:min-h-[76px]"
    if (lessonQuizAnswerState === "unanswered") {
      return cn(base, "cursor-pointer border-border-warm bg-bg-input/80 text-text-primary hover:-translate-y-0.5 hover:border-accent-terracotta/70 hover:bg-accent-soft/55 hover:shadow-hover active:translate-y-0")
    }
    if (token === currentQuizSign?.token) {
      return cn(base, "border-emerald-400 bg-emerald-50 text-emerald-700 shadow-[0_0_0_1px_rgba(16,185,129,0.15)]")
    }
    if (token === lessonQuizSelected) {
      return cn(base, "border-red-400 bg-red-50 text-red-600 shadow-[0_0_0_1px_rgba(239,68,68,0.15)]")
    }
    return cn(base, "border-border-soft bg-bg-input/50 text-text-muted opacity-55")
  }

  const optionBadgeClass = (token: string) => {
    const base = "grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold transition-colors"
    if (lessonQuizAnswerState === "unanswered") {
      return cn(base, "bg-accent-terracotta/15 text-accent-warm group-hover:bg-accent-terracotta group-hover:text-bg-warm")
    }
    if (token === currentQuizSign?.token) return cn(base, "bg-emerald-400 text-emerald-950")
    if (token === lessonQuizSelected) return cn(base, "bg-red-400 text-red-950")
    return cn(base, "bg-border-soft text-text-muted")
  }

  const reviewSigns = missedSigns.length > 0 ? missedSigns : signs.slice(0, 6)

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <section className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[10px] font-semibold tracking-[0.28em] uppercase text-text-muted">Learning platform</p>
          <h1 className="mt-1 text-2xl sm:text-3xl font-semibold text-text-primary">Learn Singapore Sign Language</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-secondary">
            Work through structured lessons, then quiz yourself on what you've learned.
          </p>
        </div>
        {missedSigns.length > 0 && (
          <Button variant="outline" onClick={() => setMissedSigns([])} size="sm">
            <RotateCcw className="h-4 w-4" />
            Clear review list
          </Button>
        )}
      </section>

      <div className="flex gap-2 overflow-x-auto rounded-[14px] border border-border-soft bg-bg-input p-1">
        {[
          { key: "lessons" as LearningView, label: "Lessons", Icon: GraduationCap },
          { key: "browse" as LearningView, label: "Browse", Icon: BookOpen },
          { key: "review" as LearningView, label: `Review missed${missedSigns.length > 0 ? ` (${missedSigns.length})` : ""}`, Icon: RefreshCw },
        ].map(({ key, label, Icon }) => (
          <button
            key={key}
            onClick={() => { setView(key); if (key === "lessons") { setSelectedLesson(null); setLessonQuizState("idle") } }}
            className={cn(
              "inline-flex min-w-fit items-center gap-2 rounded-[10px] px-4 py-2 text-sm font-medium transition-all",
              view === key ? "bg-bg-card text-accent-terracotta shadow-soft" : "text-text-secondary hover:text-text-primary"
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {/* ── Lessons tab ─────────────────────────────────────────────────────────── */}
      {view === "lessons" && !selectedLesson && !loadingLessonDetail && (
        <div className="rounded-[16px] border border-border-soft bg-bg-card p-4">
          <div className="mb-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-text-muted">Curriculum</p>
            <h2 className="mt-1 text-lg font-semibold text-text-primary">Structured Lessons</h2>
            <p className="mt-1 text-sm text-text-secondary">
              Each lesson covers a theme. Work through the signs, then take the lesson quiz.
            </p>
          </div>
          {lessonsError && <div className="mb-4"><OfflineHint message={lessonsError} /></div>}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {loadingLessons
              ? Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-28 rounded-[12px] skeleton" />)
              : lessons.map((lesson) => (
                  <button
                    key={lesson.lesson_id}
                    onClick={() => fetchLessonDetail(lesson.lesson_id)}
                    className="text-left overflow-hidden rounded-[12px] border border-border-soft bg-bg-input p-4 transition-all hover:-translate-y-0.5 hover:border-accent-terracotta/70 hover:shadow-hover"
                  >
                    <div className="text-2xl mb-2">{lesson.emoji}</div>
                    <p className="font-semibold text-text-primary leading-snug">{lesson.lesson_name}</p>
                    <p className="mt-1 text-xs text-text-muted leading-relaxed line-clamp-2">{lesson.description}</p>
                    <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-accent-terracotta">
                      {lesson.sign_count} signs
                    </p>
                  </button>
                ))}
          </div>
        </div>
      )}

      {view === "lessons" && loadingLessonDetail && (
        <div className="rounded-[16px] border border-border-soft bg-bg-card p-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-44 rounded-[12px] skeleton" />)}
          </div>
        </div>
      )}

      {/* ── Lesson detail view ────────────────────────────────────────────────── */}
      {view === "lessons" && selectedLesson && lessonQuizState === "idle" && (
        <div className="rounded-[16px] border border-border-soft bg-bg-card p-4">
          <div className="mb-4 flex items-start gap-3">
            <button
              onClick={() => setSelectedLesson(null)}
              className="mt-1 shrink-0 text-text-muted hover:text-text-primary transition-colors"
              aria-label="Back to lessons"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-text-muted">
                {selectedLesson.emoji} Lesson
              </p>
              <h2 className="mt-1 text-lg font-semibold text-text-primary">{selectedLesson.lesson_name}</h2>
              <p className="mt-1 text-sm text-text-secondary">{selectedLesson.description}</p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {selectedLesson.signs.map((sign) => (
              <article key={sign.token} className="overflow-hidden rounded-[12px] border border-border-soft bg-bg-input">
                <div className="flex h-36 items-center justify-center bg-bg-warm">
                  <img src={normalizeAssetUrl(sign.gif_url)} alt={`Sign for ${sign.token}`} className="h-full w-full object-contain" />
                </div>
                <div className="flex items-center justify-between gap-2 p-3">
                  <Badge variant="outline">{sign.token}</Badge>
                  <span className="truncate text-xs text-text-muted">{sign.sign_name}</span>
                </div>
              </article>
            ))}
          </div>
          {selectedLesson.signs.length >= 2 && (
            <div className="mt-5">
              <Button className="w-full" onClick={startLessonQuiz}>
                Start quiz — {selectedLesson.signs.length} questions
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ── Lesson quiz ───────────────────────────────────────────────────────── */}
      {view === "lessons" && selectedLesson && (lessonQuizState === "question" || lessonQuizState === "answered") && currentQuizSign && (
        <div className="rounded-[16px] border border-border-soft bg-bg-card p-4 sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-text-muted">
                {selectedLesson.emoji} {selectedLesson.lesson_name}
              </p>
              <h2 className="mt-1 text-lg font-semibold text-text-primary sm:text-xl">Which sign is being shown?</h2>
            </div>
            <span className="shrink-0 rounded-full bg-bg-input px-3 py-1 text-xs font-semibold text-text-muted">
              {lessonQuizIndex + 1} / {lessonQuizOrder.length}
            </span>
          </div>

          <div className="mx-auto flex h-[260px] w-full max-w-3xl items-center justify-center overflow-hidden rounded-[12px] border border-border-soft bg-bg-warm sm:h-[320px] lg:h-[360px]">
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
                  <span className="mt-1 block truncate text-[11px] font-semibold uppercase tracking-[0.16em] text-text-muted group-hover:text-text-secondary">
                    {sign.token}
                  </span>
                </span>
              </button>
            ))}
          </div>

          {lessonQuizAnswerState !== "unanswered" && (
            <div className="mx-auto w-full max-w-4xl">
              <Button className="mt-4 w-full" onClick={advanceQuiz}>
                {lessonQuizIndex + 1 < lessonQuizOrder.length ? "Next sign" : "See results"}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ── Lesson quiz score ─────────────────────────────────────────────────── */}
      {view === "lessons" && selectedLesson && lessonQuizState === "complete" && (
        <div className="rounded-[16px] border border-border-soft bg-bg-card p-4 sm:p-6">
          <div className="mb-2 flex items-start gap-3">
            <button
              onClick={() => { setSelectedLesson(null); setLessonQuizState("idle") }}
              className="mt-1 shrink-0 text-text-muted hover:text-text-primary transition-colors"
              aria-label="Back to lessons"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-text-muted">Quiz complete</p>
              <h2 className="mt-1 text-lg font-semibold text-text-primary">{selectedLesson.lesson_name}</h2>
            </div>
          </div>

          <div className="my-6 flex flex-col items-center gap-2 text-center">
            <p className="text-5xl font-semibold text-text-primary">{lessonScore.correct}/{lessonScore.total}</p>
            <p className="text-sm text-text-secondary">
              {lessonScore.correct === lessonScore.total
                ? "Perfect score! 🎉"
                : lessonScore.correct / lessonScore.total >= 0.7
                ? "Good work — review the missed signs below."
                : "Keep practicing — try the quiz again."}
            </p>
          </div>

          {lessonMissed.length > 0 && (
            <div className="mb-5">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-text-muted">Missed signs</p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {lessonMissed.map((sign) => (
                  <article key={sign.token} className="overflow-hidden rounded-[12px] border border-red-300 bg-bg-input">
                    <div className="flex h-36 items-center justify-center bg-bg-warm">
                      <img src={normalizeAssetUrl(sign.gif_url)} alt={`Sign for ${sign.token}`} className="h-full w-full object-contain" />
                    </div>
                    <div className="flex items-center justify-between gap-2 p-3">
                      <Badge variant="outline">{sign.token}</Badge>
                      <span className="truncate text-xs text-text-muted">{sign.sign_name}</span>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button className="flex-1" onClick={startLessonQuiz}>
              Try again
            </Button>
            <Button variant="outline" className="flex-1" onClick={() => setLessonQuizState("idle")}>
              Back to lesson
            </Button>
          </div>
        </div>
      )}

      {/* ── Browse tab ───────────────────────────────────────────────────────────── */}
      {view === "browse" && (
        <div className="rounded-[16px] border border-border-soft bg-bg-card p-4">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-text-muted">Vocabulary</p>
              <h2 className="mt-1 text-lg font-semibold text-text-primary">Browse signs</h2>
            </div>
            <div className="relative w-full sm:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search vocabulary" className="pl-9" />
            </div>
          </div>
          {signsError && <OfflineHint message={signsError} />}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {loadingSigns ? Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-44 rounded-[12px] skeleton" />) : signs.map((sign) => (
              <article key={sign.token} className="overflow-hidden rounded-[12px] border border-border-soft bg-bg-input">
                <div className="flex h-36 items-center justify-center bg-bg-warm">
                  <img src={normalizeAssetUrl(sign.gif_url)} alt={`Sign for ${sign.token}`} className="h-full w-full object-contain" />
                </div>
                <div className="flex items-center justify-between gap-2 p-3">
                  <Badge variant="outline">{sign.token}</Badge>
                  <span className="truncate text-xs text-text-muted">{sign.sign_name}</span>
                </div>
              </article>
            ))}
          </div>
          {!loadingSigns && !signsError && signs.length === 0 && (
            <p className="py-8 text-center text-sm text-text-muted">No signs matched that search.</p>
          )}
        </div>
      )}

      {/* ── Review tab ───────────────────────────────────────────────────────────── */}
      {view === "review" && (
        <div className="rounded-[16px] border border-border-soft bg-bg-card p-4">
          <div className="mb-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-text-muted">Review</p>
            <h2 className="mt-1 text-lg font-semibold text-text-primary">Missed signs</h2>
            <p className="mt-1 text-sm text-text-secondary">
              Signs you got wrong during lesson quizzes appear here for review.
            </p>
          </div>
          {missedSigns.length === 0 && (
            <OfflineHint message="No missed signs yet. Complete a lesson quiz to populate this list." />
          )}
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {reviewSigns.map((sign) => (
              <article key={sign.token} className="overflow-hidden rounded-[12px] border border-border-soft bg-bg-input">
                <div className="flex h-40 items-center justify-center bg-bg-warm">
                  <img src={normalizeAssetUrl(sign.gif_url)} alt={`Sign for ${sign.token}`} className="h-full w-full object-contain" />
                </div>
                <div className="p-3">
                  <Badge variant="accent">{sign.token}</Badge>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
