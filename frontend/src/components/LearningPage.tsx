import { useState, useEffect, useCallback } from "react"
import { AlertCircle, BookOpen, RefreshCw, RotateCcw, Search, Target } from "lucide-react"
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

interface QuizQuestion {
  correct_token: string
  sign_name?: string
  gif_url: string
  options: string[]
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

type AnswerState = "unanswered" | "correct" | "wrong"
type LearningView = "quiz" | "browse" | "review"

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
    <div className="rounded-[14px] border border-amber-700/40 bg-amber-950/30 p-4 text-sm text-amber-200">
      <div className="flex gap-3">
        <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
        <p className="leading-relaxed">{message}</p>
      </div>
    </div>
  )
}

export function LearningPage() {
  const [view, setView] = useState<LearningView>("quiz")
  const [question, setQuestion] = useState<QuizQuestion | null>(null)
  const [loadingQuiz, setLoadingQuiz] = useState(true)
  const [quizError, setQuizError] = useState("")
  const [selected, setSelected] = useState<string | null>(null)
  const [answerState, setAnswerState] = useState<AnswerState>("unanswered")
  const [score, setScore] = useState({ correct: 0, total: 0, streak: 0 })
  const [missedSigns, setMissedSigns] = useState<LearningSign[]>([])
  const [search, setSearch] = useState("")
  const [signs, setSigns] = useState<LearningSign[]>([])
  const [loadingSigns, setLoadingSigns] = useState(false)
  const [signsError, setSignsError] = useState("")

  const fetchQuestion = useCallback(async () => {
    setLoadingQuiz(true)
    setSelected(null)
    setAnswerState("unanswered")
    setQuizError("")
    try {
      const headers = await authHeaders()
      const res = await fetch(`${API_BASE_URL}/api/learning/quiz`, { headers })
      if (!res.ok) throw new Error(res.status === 404 ? "Quiz signs were not found." : "Unable to load a quiz question.")
      setQuestion(await res.json())
    } catch (err) {
      console.error(err)
      setQuestion(null)
      setQuizError("Learning could not reach the local backend. For offline localhost development, run FastAPI with USE_GCS=false and make sure sgsl_dataset and sgsl_processed/vocab.json exist.")
    } finally {
      setLoadingQuiz(false)
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

  useEffect(() => { fetchQuestion() }, [fetchQuestion])

  useEffect(() => {
    if (view !== "browse") return
    const handle = window.setTimeout(() => fetchSigns(search), 250)
    return () => window.clearTimeout(handle)
  }, [fetchSigns, search, view])

  const rememberMissedSign = (item: LearningSign) => {
    setMissedSigns((current) => current.some((sign) => sign.token === item.token) ? current : [item, ...current].slice(0, 12))
  }

  const handleSelect = (token: string) => {
    if (answerState !== "unanswered" || !question) return
    setSelected(token)
    const isCorrect = token === question.correct_token
    setAnswerState(isCorrect ? "correct" : "wrong")
    setScore((s) => ({
      correct: s.correct + (isCorrect ? 1 : 0),
      total: s.total + 1,
      streak: isCorrect ? s.streak + 1 : 0,
    }))
    if (!isCorrect) {
      rememberMissedSign({
        token: question.correct_token,
        sign_name: question.sign_name ?? question.correct_token,
        gif_url: question.gif_url,
      })
    }
  }

  const resetSession = () => {
    setScore({ correct: 0, total: 0, streak: 0 })
    setMissedSigns([])
    setSelected(null)
    setAnswerState("unanswered")
  }

  const optionClass = (token: string) => {
    const base = "group flex w-full min-h-[72px] items-center gap-3 rounded-[14px] border px-4 py-3 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-terracotta/70 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-card sm:min-h-[76px]"
    if (answerState === "unanswered") {
      return cn(base, "cursor-pointer border-border-warm bg-bg-input/80 text-text-primary shadow-[inset_0_1px_0_rgba(237,229,212,0.04)] hover:-translate-y-0.5 hover:border-accent-terracotta/70 hover:bg-accent-soft/55 hover:shadow-hover active:translate-y-0")
    }
    if (token === question?.correct_token) {
      return cn(base, "border-emerald-500/80 bg-emerald-950/50 text-emerald-200 shadow-[0_0_0_1px_rgba(16,185,129,0.12)]")
    }
    if (token === selected) {
      return cn(base, "border-red-500/80 bg-red-950/50 text-red-200 shadow-[0_0_0_1px_rgba(239,68,68,0.12)]")
    }
    return cn(base, "border-border-soft bg-bg-input/50 text-text-muted opacity-55")
  }

  const optionBadgeClass = (token: string) => {
    const base = "grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold transition-colors"
    if (answerState === "unanswered") {
      return cn(base, "bg-accent-terracotta/15 text-accent-warm group-hover:bg-accent-terracotta group-hover:text-bg-warm")
    }
    if (token === question?.correct_token) return cn(base, "bg-emerald-400 text-emerald-950")
    if (token === selected) return cn(base, "bg-red-400 text-red-950")
    return cn(base, "bg-border-soft text-text-muted")
  }

  const percentage = score.total > 0 ? Math.round((score.correct / score.total) * 100) : 0
  const reviewSigns = missedSigns.length > 0 ? missedSigns : signs.slice(0, 6)

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <section className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[10px] font-semibold tracking-[0.28em] uppercase text-text-muted">Learning platform</p>
          <h1 className="mt-1 text-2xl sm:text-3xl font-semibold text-text-primary">Learn Singapore Sign Language</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-secondary">
            Quiz yourself, browse signs, and review missed answers.
          </p>
        </div>
        <Button variant="outline" onClick={resetSession} size="sm">
          <RotateCcw className="h-4 w-4" />
          Reset session
        </Button>
      </section>

      <div className="grid gap-3 sm:grid-cols-4">
        {[
          ["Score", `${score.correct}/${score.total}`],
          ["Accuracy", score.total ? `${percentage}%` : "-"],
          ["Streak", String(score.streak)],
          ["Review", String(missedSigns.length)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-[14px] border border-border-soft bg-bg-card p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-text-muted">{label}</p>
            <p className="mt-1 text-2xl font-semibold text-text-primary">{value}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2 overflow-x-auto rounded-[14px] border border-border-soft bg-bg-input p-1">
        {[
          { key: "quiz" as LearningView, label: "Quiz", Icon: Target },
          { key: "browse" as LearningView, label: "Browse", Icon: BookOpen },
          { key: "review" as LearningView, label: "Review missed", Icon: RefreshCw },
        ].map(({ key, label, Icon }) => (
          <button
            key={key}
            onClick={() => setView(key)}
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

      {view === "quiz" && (
        <div className="rounded-[16px] border border-border-soft bg-bg-card p-4 sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-text-primary sm:text-xl">Which sign is being shown?</h2>
            <Button variant="ghost" size="sm" onClick={fetchQuestion} disabled={loadingQuiz}>
              <RefreshCw className={cn("h-4 w-4", loadingQuiz && "animate-spin")} />
              Skip
            </Button>
          </div>

          <div className="mx-auto flex h-[260px] w-full max-w-3xl items-center justify-center overflow-hidden rounded-[12px] border border-border-soft bg-bg-warm sm:h-[320px] lg:h-[360px]">
            {loadingQuiz ? (
              <div className="h-40 w-52 rounded-[12px] skeleton" />
            ) : question ? (
              <img
                key={question.gif_url}
                src={normalizeAssetUrl(question.gif_url)}
                alt={`Sign for ${question.correct_token}`}
                className="h-full w-full object-contain"
                onError={() => setQuizError("The GIF file could not load. In local offline mode, confirm the matching file exists under sgsl_dataset.")}
              />
            ) : (
              <p className="text-sm text-text-muted">No question loaded.</p>
            )}
          </div>

          {quizError && <div className="mt-3"><OfflineHint message={quizError} /></div>}

          <div className="mx-auto mt-5 grid w-full max-w-4xl grid-cols-1 gap-3 sm:grid-cols-2">
            {loadingQuiz
              ? Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-[76px] rounded-[14px] skeleton" />)
              : question?.options.map((token, index) => (
                  <button key={token} onClick={() => handleSelect(token)} disabled={answerState !== "unanswered"} className={optionClass(token)}>
                    <span className={optionBadgeClass(token)}>{String.fromCharCode(65 + index)}</span>
                    <span className="min-w-0">
                      <span className="block truncate text-base font-semibold leading-tight text-inherit sm:text-lg">{formatSignLabel(token)}</span>
                      <span className="mt-1 block truncate text-[11px] font-semibold uppercase tracking-[0.16em] text-text-muted group-hover:text-text-secondary">
                        {token}
                      </span>
                    </span>
                  </button>
                ))}
          </div>

          {answerState !== "unanswered" && (
            <div className="mx-auto w-full max-w-4xl">
              <Button className="mt-4 w-full" onClick={fetchQuestion}>
                Next sign
              </Button>
            </div>
          )}
        </div>
      )}

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

      {view === "review" && (
        <div className="rounded-[16px] border border-border-soft bg-bg-card p-4">
          <div className="mb-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-text-muted">Review</p>
            <h2 className="mt-1 text-lg font-semibold text-text-primary">Missed signs from this session</h2>
            <p className="mt-1 text-sm text-text-secondary">
              Missed quiz answers appear here until you reset the session.
            </p>
          </div>
          {missedSigns.length === 0 && (
            <OfflineHint message="No missed signs yet. Take a quiz or browse vocabulary while you build the session review list." />
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
