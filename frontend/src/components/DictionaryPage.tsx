import { useState, useMemo, useEffect } from "react"
import { Search, SlidersHorizontal } from "lucide-react"
import { AppNavbar, type NavMode } from "@/components/AppNavbar"
import { SignDetailPage } from "@/components/SignDetailPage"
import { Footer } from "@/components/Footer"
import { getTagStyle } from "@/lib/categories"
import { useSignCatalog, type CatalogSign } from "@/hooks/useSignCatalog"

function formatSignLabel(token: string): string {
  return token
    .replace(/[_-]+/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (l) => l.toUpperCase())
}

export interface DictionaryPageProps {
  onNavigate: (dest: NavMode | "home") => void
  onSignOut?: () => void
  isAdmin?: boolean
  isLoggedIn?: boolean
  initialToken?: string
  onInitialTokenConsumed?: () => void
}

export function DictionaryPage({
  onNavigate,
  onSignOut,
  isAdmin,
  isLoggedIn = true,
  initialToken,
  onInitialTokenConsumed,
}: DictionaryPageProps) {
  const [activeTag, setActiveTag] = useState("All")
  const [selectedSign, setSelectedSign] = useState<CatalogSign | null>(null)

  const {
    search,
    setSearch,
    allSigns,
    searchSigns,
    searchLoading,
    tagToSigns,
    allTags,
    loading,
    error,
    hasMore,
    loadingMore,
    total,
    loadMore,
  } = useSignCatalog()

  // Deep-link: auto-open a specific sign's detail page once the catalog has loaded
  useEffect(() => {
    if (!initialToken || allSigns.length === 0) return
    const match = allSigns.find((s) => s.token === initialToken)
    if (match) setSelectedSign(match)
    onInitialTokenConsumed?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialToken, allSigns])

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
            <span className="text-[14px] font-medium text-[#4a5565]">Filter by category</span>
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
                const badges = [sign.category, sign.difficulty].filter(
                  (t): t is string => Boolean(t)
                )
                return (
                  <button
                    key={sign.token}
                    onClick={() => setSelectedSign(sign)}
                    className="bg-white border border-[#f3f4f6] rounded-[14px] p-4 hover:border-[#6176f7]/30 hover:shadow-md transition-all text-left cursor-pointer w-full"
                  >
                    <p className="text-[16px] font-semibold text-[#101828] mb-1.5">{label}</p>
                    {badges.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {badges.map((tag) => {
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

      <Footer onNavigate={onNavigate} />
    </div>
  )
}
