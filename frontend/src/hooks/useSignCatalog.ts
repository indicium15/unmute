import { useState, useEffect, useCallback, useRef } from "react"
import { auth } from "@/lib/firebase"
import { setTagConfig, type TagStyle } from "@/lib/categories"

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000"
const PAGE_SIZE = 100

async function authHeaders(): Promise<Record<string, string>> {
  const user = auth.currentUser
  if (!user) return {}
  const token = await user.getIdToken()
  return { Authorization: `Bearer ${token}` }
}

export interface CatalogSign {
  token: string
  sign_name: string
  gif_url: string
  tags: string[]
  category?: string
  difficulty?: string
}

interface LessonSummary {
  lesson_id: string
  lesson_name: string
  difficulty?: string
  tags: string[]
}

interface SignsResponse {
  signs: Array<{ token: string; sign_name: string; gif_url: string }>
  has_more: boolean
  total: number
}

export function useSignCatalog() {
  const [search, setSearch] = useState("")
  const [allSigns, setAllSigns] = useState<CatalogSign[]>([])
  const [searchSigns, setSearchSigns] = useState<CatalogSign[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [tokenToTags, setTokenToTags] = useState<Record<string, string[]>>({})
  const [tokenToCategory, setTokenToCategory] = useState<Record<string, string>>({})
  const [tokenToDifficulty, setTokenToDifficulty] = useState<Record<string, string>>({})
  const [tagToSigns, setTagToSigns] = useState<Record<string, CatalogSign[]>>({})
  const [allTags, setAllTags] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [total, setTotal] = useState(0)
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let cancelled = false
    const init = async () => {
      try {
        const headers = await authHeaders()

        const [tagConfigRes, lessonsRes, signsRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/learning/tag-config`, { headers }),
          fetch(`${API_BASE_URL}/api/learning/lessons`, { headers }),
          fetch(`${API_BASE_URL}/api/learning/signs?q=&limit=${PAGE_SIZE}&offset=0`, { headers }),
        ])

        if (!lessonsRes.ok || !signsRes.ok) throw new Error("Fetch failed")

        const [tagConfig, lessons, signsData]: [
          Record<string, TagStyle>,
          LessonSummary[],
          SignsResponse,
        ] = await Promise.all([
          tagConfigRes.ok ? tagConfigRes.json() : Promise.resolve({}),
          lessonsRes.json(),
          signsRes.json(),
        ])

        if (cancelled) return

        setTagConfig(tagConfig)

        // Build token → tags map from lesson data
        // Each lesson contributes: its lesson_name + difficulty + custom tags
        const tagMap: Record<string, string[]> = {}

        for (const lesson of lessons) {
          const lessonTags: string[] = [lesson.lesson_name]
          if (lesson.difficulty) lessonTags.push(lesson.difficulty)
          lessonTags.push(...lesson.tags)

          // We need lesson detail to know which tokens belong to it.
          // We'll fetch details next.
          ;(lesson as LessonSummary & { _tags: string[] })._tags = lessonTags
        }

        // Fetch lesson details to get token lists
        const details = await Promise.all(
          lessons.map((l) =>
            fetch(`${API_BASE_URL}/api/learning/lessons/${l.lesson_id}`, { headers })
              .then((r) => r.json())
          )
        )

        if (cancelled) return

        const tagSignsMap: Record<string, CatalogSign[]> = {}
        // Category-only chip data (drops lesson_name/difficulty from the flat tag list)
        const categoryTagSet = new Set<string>()
        const categoryMap: Record<string, string> = {}
        const difficultyMap: Record<string, string> = {}

        for (let i = 0; i < lessons.length; i++) {
          const lessonTags = (lessons[i] as LessonSummary & { _tags: string[] })._tags
          const lesson = lessons[i]
          for (const category of lesson.tags) categoryTagSet.add(category)

          for (const sign of details[i].signs ?? []) {
            if (!tagMap[sign.token]) tagMap[sign.token] = []
            for (const tag of lessonTags) {
              if (!tagMap[sign.token].includes(tag)) tagMap[sign.token].push(tag)
            }
            for (const category of lesson.tags) {
              if (!categoryMap[sign.token]) categoryMap[sign.token] = category
              if (!tagSignsMap[category]) tagSignsMap[category] = []
              if (!tagSignsMap[category].some((s) => s.token === sign.token)) {
                tagSignsMap[category].push({ ...sign, tags: [] }) // tags filled in below
              }
            }
            if (lesson.difficulty && !difficultyMap[sign.token]) {
              difficultyMap[sign.token] = lesson.difficulty
            }
          }
        }

        // Attach full tag list to each sign in tagToSigns
        for (const signs of Object.values(tagSignsMap)) {
          for (const sign of signs) sign.tags = tagMap[sign.token] ?? []
        }

        setTokenToTags(tagMap)
        setTokenToCategory(categoryMap)
        setTokenToDifficulty(difficultyMap)
        setTagToSigns(tagSignsMap)
        setAllTags(Array.from(categoryTagSet))
        setAllSigns(
          signsData.signs.map((s) => ({
            ...s,
            tags: tagMap[s.token] ?? [],
            category: categoryMap[s.token],
            difficulty: difficultyMap[s.token],
          }))
        )
        setHasMore(signsData.has_more)
        setTotal(signsData.total)
        setOffset(PAGE_SIZE)
      } catch (err) {
        console.error(err)
        if (!cancelled) setError("Failed to load dictionary. Please try again.")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    init()
    return () => { cancelled = true }
  }, [])

  // Debounced server-side search
  useEffect(() => {
    if (searchDebounce.current) clearTimeout(searchDebounce.current)
    const q = search.trim()
    if (!q) {
      setSearchSigns([])
      return
    }
    searchDebounce.current = setTimeout(async () => {
      setSearchLoading(true)
      try {
        const headers = await authHeaders()
        const res = await fetch(
          `${API_BASE_URL}/api/learning/signs?q=${encodeURIComponent(q)}&limit=100&offset=0`,
          { headers }
        )
        if (!res.ok) throw new Error("Fetch failed")
        const data: SignsResponse = await res.json()
        setSearchSigns(
          data.signs.map((s) => ({
            ...s,
            tags: tokenToTags[s.token] ?? [],
            category: tokenToCategory[s.token],
            difficulty: tokenToDifficulty[s.token],
          }))
        )
      } catch (err) {
        console.error(err)
      } finally {
        setSearchLoading(false)
      }
    }, 300)
    return () => {
      if (searchDebounce.current) clearTimeout(searchDebounce.current)
    }
  }, [search, tokenToTags, tokenToCategory, tokenToDifficulty])

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    try {
      const headers = await authHeaders()
      const res = await fetch(
        `${API_BASE_URL}/api/learning/signs?q=&limit=${PAGE_SIZE}&offset=${offset}`,
        { headers }
      )
      if (!res.ok) throw new Error("Fetch failed")
      const data: SignsResponse = await res.json()
      setAllSigns((prev) => [
        ...prev,
        ...data.signs.map((s) => ({
          ...s,
          tags: tokenToTags[s.token] ?? [],
          category: tokenToCategory[s.token],
          difficulty: tokenToDifficulty[s.token],
        })),
      ])
      setHasMore(data.has_more)
      setOffset((o) => o + PAGE_SIZE)
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingMore(false)
    }
  }, [loadingMore, hasMore, offset, tokenToTags, tokenToCategory, tokenToDifficulty])

  const relatedSigns = useCallback(
    (token: string, tags: string[], max = 4): CatalogSign[] => {
      return allSigns
        .filter((s) => s.token !== token && s.tags.some((t) => tags.includes(t)))
        .slice(0, max)
    },
    [allSigns]
  )

  return {
    search,
    setSearch,
    allSigns,
    searchSigns,
    searchLoading,
    tokenToTags,
    tokenToCategory,
    tokenToDifficulty,
    tagToSigns,
    allTags,
    loading,
    error,
    hasMore,
    loadingMore,
    total,
    loadMore,
    relatedSigns,
  }
}
