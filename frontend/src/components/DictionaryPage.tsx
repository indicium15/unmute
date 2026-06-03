import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { Search, SlidersHorizontal } from "lucide-react"
import { auth } from "@/lib/firebase"
import { AppNavbar, type NavMode } from "@/components/AppNavbar"
import { SignDetailPage } from "@/components/SignDetailPage"
import { getTagStyle, setTagConfig, type TagStyle } from "@/lib/categories"

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000"
const PAGE_SIZE = 100

async function authHeaders(): Promise<Record<string, string>> {
  const user = auth.currentUser
  if (!user) return {}
  const token = await user.getIdToken()
  return { Authorization: `Bearer ${token}` }
}

function formatSignLabel(token: string): string {
  return token
    .replace(/[_-]+/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (l) => l.toUpperCase())
}

interface DictionarySign {
  token: string
  sign_name: string
  gif_url: string
  tags: string[]
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

export interface DictionaryPageProps {
  onNavigate: (dest: NavMode | "home") => void
  onSignOut?: () => void
  isAdmin?: boolean
  isLoggedIn?: boolean
}

export function DictionaryPage({ onNavigate, onSignOut, isAdmin, isLoggedIn = true }: DictionaryPageProps) {
  const [search, setSearch] = useState("")
  const [activeTag, setActiveTag] = useState("All")
  const [selectedSign, setSelectedSign] = useState<DictionarySign | null>(null)
  const [allSigns, setAllSigns] = useState<DictionarySign[]>([])
  const [searchSigns, setSearchSigns] = useState<DictionarySign[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  // token → all tags (lesson name + difficulty + custom tags)
  const [tokenToTags, setTokenToTags] = useState<Record<string, string[]>>({})
  const [tagToSigns, setTagToSigns] = useState<Record<string, DictionarySign[]>>({})
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
        const tagSet = new Set<string>()

        for (const lesson of lessons) {
          const lessonTags: string[] = [lesson.lesson_name]
          if (lesson.difficulty) lessonTags.push(lesson.difficulty)
          lessonTags.push(...lesson.tags)

          for (const tag of lessonTags) tagSet.add(tag)

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

        const tagSignsMap: Record<string, DictionarySign[]> = {}

        for (let i = 0; i < lessons.length; i++) {
          const lessonTags = (lessons[i] as LessonSummary & { _tags: string[] })._tags
          for (const sign of details[i].signs ?? []) {
            if (!tagMap[sign.token]) tagMap[sign.token] = []
            for (const tag of lessonTags) {
              if (!tagMap[sign.token].includes(tag)) tagMap[sign.token].push(tag)
              if (!tagSignsMap[tag]) tagSignsMap[tag] = []
              if (!tagSignsMap[tag].some((s) => s.token === sign.token)) {
                tagSignsMap[tag].push({ ...sign, tags: [] }) // tags filled in below
              }
            }
          }
        }

        // Attach full tag list to each sign in tagToSigns
        for (const signs of Object.values(tagSignsMap)) {
          for (const sign of signs) sign.tags = tagMap[sign.token] ?? []
        }

        setTokenToTags(tagMap)
        setTagToSigns(tagSignsMap)
        setAllTags(Array.from(tagSet))
        setAllSigns(signsData.signs.map((s) => ({ ...s, tags: tagMap[s.token] ?? [] })))
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
        setSearchSigns(data.signs.map((s) => ({ ...s, tags: tokenToTags[s.token] ?? [] })))
      } catch (err) {
        console.error(err)
      } finally {
        setSearchLoading(false)
      }
    }, 300)
    return () => {
      if (searchDebounce.current) clearTimeout(searchDebounce.current)
    }
  }, [search, tokenToTags])

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
        ...data.signs.map((s) => ({ ...s, tags: tokenToTags[s.token] ?? [] })),
      ])
      setHasMore(data.has_more)
      setOffset((o) => o + PAGE_SIZE)
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingMore(false)
    }
  }, [loadingMore, hasMore, offset, tokenToTags])

  const filteredSigns = useMemo(() => {
    if (search.trim().length > 0) return searchSigns
    if (activeTag !== "All") return tagToSigns[activeTag] ?? []
    return allSigns
  }, [allSigns, searchSigns, tagToSigns, activeTag, search])

  if (selectedSign) {
    return (
      <SignDetailPage
        sign={selectedSign}
        relatedSigns={allSigns}
        onBack={() => setSelectedSign(null)}
        onSelectSign={setSelectedSign}
        onNavigate={onNavigate}
        onSignOut={onSignOut}
        isAdmin={isAdmin}
        isLoggedIn={isLoggedIn}
      />
    )
  }

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
      <AppNavbar
        activeMode="dictionary"
        onNavigate={(dest) => onNavigate(dest)}
        onLogout={onSignOut ?? (() => {})}
        isAdmin={isAdmin}
        isLoggedIn={isLoggedIn}
      />

      {/* Hero */}
      <section className="bg-[#6176f7] pt-12 pb-8">
        <div className="max-w-[900px] mx-auto px-6">
          <h1 className="text-[30px] font-bold text-white leading-9 mb-3">SgSL Dictionary</h1>
          <p className="text-[14px] text-white/80 mb-6">
            Browse and search {loading ? "…" : total} Singapore Sign Language signs
          </p>
          <div className="relative w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#99a1af]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search signs by word or description..."
              className="w-full h-[52px] pl-12 pr-5 rounded-[14px] bg-white text-[16px] text-[#1e2939] placeholder:text-[#99a1af] shadow-md outline-none focus:ring-2 focus:ring-white/30"
            />
          </div>
          <p className="text-[12px] text-white/50 mt-3">
            Sign data sourced from{" "}
            <a
              href="https://blogs.ntu.edu.sg/sgslsignbank/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-white/80 transition-colors"
            >
              NTU SgSL Signbank
            </a>
          </p>
        </div>
      </section>

      {/* Content */}
      <main className="max-w-[900px] mx-auto px-6 py-8">
        {/* Filter chips */}
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-3">
            <SlidersHorizontal className="w-4 h-4 text-[#4a5565]" />
            <span className="text-[14px] font-medium text-[#4a5565]">Filter by tag</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {["All", ...allTags].map((tag) => (
              <button
                key={tag}
                onClick={() => setActiveTag(tag)}
                className={`px-3 py-1.5 rounded-full text-[12px] font-medium transition-all border ${
                  activeTag === tag
                    ? "bg-[#6176f7] text-white border-transparent shadow-sm"
                    : "bg-white text-[#4a5565] border-[#e5e7eb] hover:border-[#6176f7]/40"
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        {/* Results count */}
        <p className="text-[14px] text-[#6a7282] mb-5">
          {searchLoading ? (
            <span>Searching…</span>
          ) : (
            <>
              Showing <span className="font-semibold text-[#1e2939]">{filteredSigns.length}</span>
              {!search && activeTag === "All" && total > allSigns.length && (
                <span> of <span className="font-semibold text-[#1e2939]">{total}</span></span>
              )} signs
            </>
          )}
        </p>

        {/* Grid */}
        {loading || searchLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 rounded-full border-2 border-[#6176f7] border-t-transparent animate-spin" />
          </div>
        ) : error ? (
          <p className="text-center text-red-500 py-10">{error}</p>
        ) : filteredSigns.length === 0 ? (
          <p className="text-center text-[#6a7282] py-10">No signs found.</p>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredSigns.map((sign) => {
                const label = formatSignLabel(sign.token)
                return (
                  <button
                    key={sign.token}
                    onClick={() => setSelectedSign(sign)}
                    className="bg-white border border-[#f3f4f6] rounded-[14px] overflow-hidden hover:border-[#6176f7]/30 hover:shadow-md transition-all text-left cursor-pointer w-full"
                  >
                    <div className="flex items-center justify-center bg-gray-50 h-[160px] overflow-hidden">
                      <img
                        src={sign.gif_url}
                        alt={`Sign for ${label}`}
                        className="h-full w-full object-contain"
                      />
                    </div>
                    <div className="p-4">
                      <p className="text-[16px] font-semibold text-[#101828] mb-1.5">{label}</p>
                      {sign.tags.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {sign.tags.map((tag) => {
                            const style = getTagStyle(tag)
                            return (
                              <span
                                key={tag}
                                className="px-2 py-0.5 rounded-full text-[12px] font-medium border"
                                style={{
                                  backgroundColor: style.bg,
                                  color: style.color,
                                  borderColor: style.border ?? style.bg,
                                }}
                              >
                                {tag}
                              </span>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Load more */}
            {hasMore && !search.trim() && activeTag === "All" && (
              <div className="flex justify-center mt-8">
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-full border border-[#e5e7eb] text-[14px] font-medium text-[#4a5565] hover:border-[#6176f7]/40 hover:text-[#6176f7] transition-all disabled:opacity-60"
                >
                  {loadingMore ? (
                    <>
                      <span className="w-4 h-4 rounded-full border-2 border-[#6176f7] border-t-transparent animate-spin" />
                      Loading…
                    </>
                  ) : (
                    `Load more (${total - allSigns.length} remaining)`
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-[#f9fafb] border-t border-gray-100 mt-8">
        <div className="max-w-[900px] mx-auto px-6 pt-10 pb-6">
          <div className="grid grid-cols-3 gap-12 mb-8">
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-[10px] bg-[#6176f7] flex items-center justify-center flex-shrink-0">
                  <img src="/home/icon-logo-footer.svg" alt="" className="w-4 h-4" />
                </div>
                <span className="text-[16px] font-semibold text-[#1e2939]">Kinnect</span>
              </div>
              <p className="text-[14px] leading-[22.75px] text-[#6a7282]">
                Empowering communication through Singapore Sign Language making SgSL accessible to everyone.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <p className="text-[14px] font-semibold text-[#364153]">Explore</p>
              <ul className="flex flex-col gap-2">
                <li>
                  <button
                    onClick={() => onNavigate("home")}
                    className="text-[14px] text-[#6a7282] hover:text-[#6176f7] transition-colors"
                  >
                    Home
                  </button>
                </li>
                <li>
                  <span className="text-[14px] font-medium text-[#6176f7]">SgSL Dictionary</span>
                </li>
                <li>
                  <button
                    onClick={() => onNavigate("learn")}
                    className="text-[14px] text-[#6a7282] hover:text-[#6176f7] transition-colors"
                  >
                    Learn SgSL
                  </button>
                </li>
              </ul>
            </div>

            <div className="flex flex-col gap-3">
              <p className="text-[14px] font-semibold text-[#364153]">About</p>
              <p className="text-[14px] leading-5 text-[#6a7282]">
                Singapore Sign Language (SgSL) is the natural language used by the Deaf community in Singapore.
              </p>
            </div>
          </div>

          <div className="border-t border-[#e5e7eb] pt-6 flex items-center justify-between">
            <p className="text-[12px] text-[#99a1af]">© 2026 Kinnect. All rights reserved.</p>
            <p className="text-[12px] text-[#99a1af] flex items-center gap-1">
              Made with
              <img src="/home/icon-heart.svg" alt="love" className="w-3 h-3" />
              for the Deaf community in Singapore
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
