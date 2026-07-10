import { useCallback, useEffect, useState } from "react"
import type { NavMode } from "@/components/AppNavbar"
import { auth } from "@/lib/firebase"
import { LessonsLandingPage } from "@/components/learning/LessonsLandingPage"
import { LessonDetailPage } from "@/components/learning/LessonDetailPage"
import { LessonQuiz, type LessonQuizResult } from "@/components/learning/LessonQuiz"
import { LessonQuizResults } from "@/components/learning/LessonQuizResults"
import type { LessonDetail, LessonProgress, LessonSummary } from "@/components/learning/types"

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000"

async function authHeaders(): Promise<Record<string, string>> {
  const user = auth.currentUser
  if (!user) return { "Content-Type": "application/json" }
  const token = await user.getIdToken()
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` }
}

function upsertProgress(list: LessonProgress[], updated: LessonProgress): LessonProgress[] {
  const idx = list.findIndex((p) => p.lesson_id === updated.lesson_id)
  if (idx === -1) return [...list, updated]
  const next = [...list]
  next[idx] = updated
  return next
}

type View = "landing" | "detail" | "quiz" | "quiz-results"

export interface LearningPageProps {
  onNavigate: (dest: NavMode | "home") => void
  onSignOut?: () => void
  isAdmin?: boolean
  isLoggedIn?: boolean
}

export function LearningPage({ onNavigate, onSignOut, isAdmin, isLoggedIn = false }: LearningPageProps) {
  const [view, setView] = useState<View>("landing")

  const [lessons, setLessons] = useState<LessonSummary[]>([])
  const [loadingLessons, setLoadingLessons] = useState(false)
  const [lessonsError, setLessonsError] = useState("")

  const [progress, setProgress] = useState<LessonProgress[]>([])

  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null)
  const [selectedLesson, setSelectedLesson] = useState<LessonDetail | null>(null)
  const [loadingLessonDetail, setLoadingLessonDetail] = useState(false)

  const [quizResult, setQuizResult] = useState<LessonQuizResult | null>(null)

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

  const fetchProgress = useCallback(async () => {
    try {
      const headers = await authHeaders()
      const res = await fetch(`${API_BASE_URL}/api/learning/progress`, { headers })
      if (!res.ok) throw new Error("Unable to load progress.")
      setProgress(await res.json())
    } catch (err) {
      console.error(err)
    }
  }, [])

  useEffect(() => {
    fetchLessons()
    fetchProgress()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchLessonDetail = useCallback(
    async (lessonId: string) => {
      setLoadingLessonDetail(true)
      setSelectedLesson(null)
      try {
        const headers = await authHeaders()
        const res = await fetch(`${API_BASE_URL}/api/learning/lessons/${lessonId}`, { headers })
        if (!res.ok) throw new Error("Unable to load lesson.")
        setSelectedLesson(await res.json())
        setView("detail")
      } catch (err) {
        console.error(err)
      } finally {
        setLoadingLessonDetail(false)
      }
    },
    []
  )

  const handleSelectLesson = useCallback(
    (lessonId: string) => {
      setSelectedLessonId(lessonId)
      fetchLessonDetail(lessonId)
    },
    [fetchLessonDetail]
  )

  const handleSignViewed = useCallback(
    async (token: string) => {
      if (!selectedLessonId) return
      try {
        const headers = await authHeaders()
        const res = await fetch(
          `${API_BASE_URL}/api/learning/lessons/${selectedLessonId}/signs/${token}/viewed`,
          { method: "POST", headers }
        )
        if (!res.ok) return
        const updated: LessonProgress = await res.json()
        setProgress((prev) => upsertProgress(prev, updated))
      } catch (err) {
        console.error(err)
      }
    },
    [selectedLessonId]
  )

  const handleQuizComplete = useCallback(
    async (result: LessonQuizResult) => {
      setQuizResult(result)
      setView("quiz-results")
      if (!selectedLessonId) return
      try {
        const headers = await authHeaders()
        const res = await fetch(`${API_BASE_URL}/api/learning/lessons/${selectedLessonId}/quiz-attempt`, {
          method: "POST",
          headers,
          body: JSON.stringify({ score: result.correct, total: result.total }),
        })
        if (!res.ok) return
        const updated: LessonProgress = await res.json()
        setProgress((prev) => upsertProgress(prev, updated))
      } catch (err) {
        console.error(err)
      }
    },
    [selectedLessonId]
  )

  const handleBackToLanding = useCallback(() => {
    setView("landing")
    setSelectedLessonId(null)
    setSelectedLesson(null)
    setQuizResult(null)
  }, [])

  const currentProgress = selectedLessonId
    ? progress.find((p) => p.lesson_id === selectedLessonId)
    : undefined

  if (view === "detail" && selectedLesson) {
    return (
      <LessonDetailPage
        lesson={selectedLesson}
        progress={currentProgress}
        onBack={handleBackToLanding}
        onStartQuiz={() => setView("quiz")}
        onSignViewed={handleSignViewed}
        onNavigate={onNavigate}
        onSignOut={onSignOut ?? (() => {})}
        isAdmin={isAdmin}
        isLoggedIn={isLoggedIn}
      />
    )
  }

  if (view === "quiz" && selectedLesson) {
    return (
      <LessonQuiz
        key={selectedLesson.lesson_id}
        lesson={selectedLesson}
        onComplete={handleQuizComplete}
        onBack={() => setView("detail")}
        onNavigate={onNavigate}
        onSignOut={onSignOut ?? (() => {})}
        isAdmin={isAdmin}
        isLoggedIn={isLoggedIn}
      />
    )
  }

  if (view === "quiz-results" && selectedLesson && quizResult) {
    return (
      <LessonQuizResults
        lesson={selectedLesson}
        correct={quizResult.correct}
        total={quizResult.total}
        missed={quizResult.missed}
        onRetry={() => setView("quiz")}
        onBack={() => setView("detail")}
        onBackToLessons={handleBackToLanding}
        onNavigate={onNavigate}
        onSignOut={onSignOut ?? (() => {})}
        isAdmin={isAdmin}
        isLoggedIn={isLoggedIn}
      />
    )
  }

  return (
    <LessonsLandingPage
      lessons={lessons}
      progress={progress}
      loading={loadingLessons || loadingLessonDetail}
      error={lessonsError}
      onSelectLesson={handleSelectLesson}
      onNavigate={onNavigate}
      onSignOut={onSignOut ?? (() => {})}
      isAdmin={isAdmin}
      isLoggedIn={isLoggedIn}
    />
  )
}
