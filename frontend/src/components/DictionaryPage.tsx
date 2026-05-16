import { useState, useEffect, useMemo } from "react"
import { Search, SlidersHorizontal, LogOut } from "lucide-react"
import { auth } from "@/lib/firebase"

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000"

async function authHeaders(): Promise<Record<string, string>> {
  const user = auth.currentUser
  if (!user) return {}
  const token = await user.getIdToken()
  return { Authorization: `Bearer ${token}` }
}

const CATEGORY_COLORS: Record<string, string> = {
  "Greetings & Basics": "#6176f7",
  "Feelings": "#f59e0b",
  "Family": "#14b8a6",
  "Questions": "#a855f7",
  "Numbers": "#3b82f6",
  "Colors": "#ec4899",
  "Food & Drink": "#f97316",
}

const CATEGORY_DIFFICULTY: Record<string, "Beginner" | "Intermediate"> = {
  "Greetings & Basics": "Beginner",
  "Feelings": "Beginner",
  "Family": "Intermediate",
  "Questions": "Beginner",
  "Numbers": "Intermediate",
  "Colors": "Beginner",
  "Food & Drink": "Beginner",
}

function getCategoryColor(category?: string): string {
  if (!category) return "#6b7280"
  return CATEGORY_COLORS[category] ?? "#6b7280"
}

function getDifficulty(category?: string): "Beginner" | "Intermediate" {
  if (!category) return "Beginner"
  return CATEGORY_DIFFICULTY[category] ?? "Beginner"
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
  category?: string
}

interface LessonSummary {
  lesson_id: string
  lesson_name: string
}

interface LessonDetail {
  lesson_name: string
  signs: Array<{ token: string; sign_name: string; gif_url: string }>
}

interface SignsResponse {
  signs: Array<{ token: string; sign_name: string; gif_url: string }>
}

export interface DictionaryPageProps {
  onNavigate: (dest: "translate" | "learn" | "home") => void
  onSignOut: () => void
}

export function DictionaryPage({ onNavigate, onSignOut }: DictionaryPageProps) {
  const [search, setSearch] = useState("")
  const [activeCategory, setActiveCategory] = useState("All")
  const [allSigns, setAllSigns] = useState<DictionarySign[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    let cancelled = false
    const init = async () => {
      try {
        const headers = await authHeaders()

        const [lessonsRes, signsRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/learning/lessons`, { headers }),
          fetch(`${API_BASE_URL}/api/learning/signs?q=&limit=200&offset=0`, { headers }),
        ])

        const [lessons, signsData]: [LessonSummary[], SignsResponse] = await Promise.all([
          lessonsRes.json(),
          signsRes.json(),
        ])

        const detailResults: LessonDetail[] = await Promise.all(
          lessons.map((l) =>
            fetch(`${API_BASE_URL}/api/learning/lessons/${l.lesson_id}`, { headers }).then((r) => r.json())
          )
        )

        if (cancelled) return

        const tokenToCategory: Record<string, string> = {}
        const cats: string[] = []
        for (const detail of detailResults) {
          const catName = detail.lesson_name
          if (!cats.includes(catName)) cats.push(catName)
          for (const sign of detail.signs) {
            tokenToCategory[sign.token] = catName
          }
        }

        setCategories(cats)
        setAllSigns(
          signsData.signs.map((s) => ({
            ...s,
            category: tokenToCategory[s.token],
          }))
        )
      } catch (err) {
        console.error(err)
        if (!cancelled) setError("Failed to load dictionary. Please try again.")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    init()
    return () => {
      cancelled = true
    }
  }, [])

  const filteredSigns = useMemo(() => {
    let result = allSigns
    if (activeCategory !== "All") {
      result = result.filter((s) => s.category === activeCategory)
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      result = result.filter(
        (s) =>
          formatSignLabel(s.token).toLowerCase().includes(q) ||
          s.sign_name.toLowerCase().includes(q)
      )
    }
    return result
  }, [allSigns, activeCategory, search])

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-100 shadow-sm">
        <div className="max-w-[1152px] mx-auto px-6 h-16 flex items-center justify-between">
          <button
            onClick={() => onNavigate("home")}
            className="flex items-center gap-2"
          >
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
            <button className="px-4 py-2 rounded-[10px] text-[14px] font-medium text-white bg-[#6176f7] shadow">
              Dictionary
            </button>
            <button
              onClick={() => onNavigate("learn")}
              className="px-4 py-2 rounded-[10px] text-[14px] font-normal text-[#4a5565] hover:bg-gray-100 transition-colors"
            >
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
          <h1 className="text-[30px] font-bold text-white leading-9 mb-3">SGSL Dictionary</h1>
          <p className="text-[14px] text-white/80 mb-6">
            Browse and search {loading ? "…" : allSigns.length} Singapore Sign Language signs
          </p>
          <div className="relative w-full max-w-[848px]">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#99a1af]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search signs by word or description..."
              className="w-full h-[52px] pl-12 pr-5 rounded-[14px] bg-white text-[16px] text-[#1e2939] placeholder:text-[#99a1af] shadow-md outline-none focus:ring-2 focus:ring-white/30"
            />
          </div>
        </div>
      </section>

      {/* Content */}
      <main className="max-w-[1152px] mx-auto px-6 py-8">
        {/* Filter chips */}
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-3">
            <SlidersHorizontal className="w-4 h-4 text-[#4a5565]" />
            <span className="text-[14px] font-medium text-[#4a5565]">Filter by category</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {["All", ...categories].map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-3 py-1.5 rounded-full text-[12px] font-medium transition-all border ${
                  activeCategory === cat
                    ? "bg-[#6176f7] text-white border-transparent shadow-sm"
                    : "bg-white text-[#4a5565] border-[#e5e7eb] hover:border-[#6176f7]/40"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Results count */}
        <p className="text-[14px] text-[#6a7282] mb-5">
          Showing <span className="font-semibold text-[#1e2939]">{filteredSigns.length}</span> signs
        </p>

        {/* Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 rounded-full border-2 border-[#6176f7] border-t-transparent animate-spin" />
          </div>
        ) : error ? (
          <p className="text-center text-red-500 py-10">{error}</p>
        ) : filteredSigns.length === 0 ? (
          <p className="text-center text-[#6a7282] py-10">No signs found.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredSigns.map((sign) => {
              const label = formatSignLabel(sign.token)
              const color = getCategoryColor(sign.category)
              const difficulty = getDifficulty(sign.category)
              return (
                <div
                  key={sign.token}
                  className="bg-white border border-[#f3f4f6] rounded-[14px] p-4 hover:border-[#6176f7]/30 hover:shadow-sm transition-all"
                >
                  <p className="text-[16px] font-semibold text-[#101828] mb-1.5">{label}</p>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {sign.category && (
                      <span
                        className="px-2 py-0.5 rounded-full text-[12px] font-medium text-white"
                        style={{ backgroundColor: color }}
                      >
                        {sign.category}
                      </span>
                    )}
                    <span
                      className={`px-2 py-0.5 rounded-full text-[12px] font-medium border ${
                        difficulty === "Beginner"
                          ? "bg-[#f0fdf4] border-[#b9f8cf] text-[#008236]"
                          : "bg-[#fefce8] border-[#fff085] text-[#a65f00]"
                      }`}
                    >
                      {difficulty}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-[#f9fafb] border-t border-gray-100 mt-8">
        <div className="max-w-[1152px] mx-auto px-6 pt-10 pb-6">
          <div className="grid grid-cols-3 gap-12 mb-8">
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-[10px] bg-[#6176f7] flex items-center justify-center flex-shrink-0">
                  <img src="/home/icon-logo-footer.svg" alt="" className="w-4 h-4" />
                </div>
                <span className="text-[16px] font-semibold text-[#1e2939]">SGSL Learn</span>
              </div>
              <p className="text-[14px] leading-[22.75px] text-[#6a7282]">
                Empowering communication through Singapore Sign Language making SGSL accessible to everyone.
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
                  <span className="text-[14px] font-medium text-[#6176f7]">SGSL Dictionary</span>
                </li>
                <li>
                  <button
                    onClick={() => onNavigate("learn")}
                    className="text-[14px] text-[#6a7282] hover:text-[#6176f7] transition-colors"
                  >
                    Learn SGSL
                  </button>
                </li>
              </ul>
            </div>

            <div className="flex flex-col gap-3">
              <p className="text-[14px] font-semibold text-[#364153]">About</p>
              <p className="text-[14px] leading-5 text-[#6a7282]">
                Singapore Sign Language (SGSL) is the natural language used by the Deaf community in Singapore.
              </p>
            </div>
          </div>

          <div className="border-t border-[#e5e7eb] pt-6 flex items-center justify-between">
            <p className="text-[12px] text-[#99a1af]">© 2026 SGSL Learn. All rights reserved.</p>
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
