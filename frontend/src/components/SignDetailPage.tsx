import { useRef, useState } from "react"
import { ArrowLeft, BookOpen, ChevronRight, Tag } from "lucide-react"
import { AppNavbar, type NavMode } from "@/components/AppNavbar"
import { getCategoryMeta } from "@/lib/categories"

function formatSignLabel(token: string): string {
  return token
    .replace(/[_-]+/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (l) => l.toUpperCase())
}

export interface SignVariant {
  sign_name: string
  variant_label: string | null
  gif_url: string
}

export interface SignDetail {
  token: string
  sign_name: string
  gif_url: string
  category?: string
  variants?: SignVariant[]
}

interface SignDetailPageProps {
  sign: SignDetail
  relatedSigns: SignDetail[]
  onBack: () => void
  onSelectSign: (sign: SignDetail) => void
  onNavigate: (dest: NavMode | "home") => void
  onSignOut: () => void
  isAdmin?: boolean
}

export function SignDetailPage({
  sign,
  relatedSigns,
  onBack,
  onSelectSign,
  onNavigate,
  onSignOut,
  isAdmin,
}: SignDetailPageProps) {
  const label = formatSignLabel(sign.token)
  const { color, difficulty, description, usage } = getCategoryMeta(sign.category)

  // Always prepend the primary so the strip starts from it
  const variants: SignVariant[] = [
    { sign_name: sign.sign_name, variant_label: null, gif_url: sign.gif_url },
    ...(sign.variants ?? []),
  ]

  const [activeIdx, setActiveIdx] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)

  const activeGif = variants[activeIdx]?.gif_url ?? sign.gif_url

  const related = relatedSigns
    .filter((s) => s.token !== sign.token && s.category === sign.category)
    .slice(0, 4)

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
      <AppNavbar
        activeMode="dictionary"
        onNavigate={(dest) => onNavigate(dest)}
        onLogout={onSignOut}
        isAdmin={isAdmin}
      />

      {/* Hero */}
      <section className="bg-[#6176f7] pt-10 pb-8">
        <div className="max-w-[640px] mx-auto px-6">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-white/80 hover:text-white text-[14px] font-medium mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <div className="flex items-center gap-2 mb-3">
            {sign.category && (
              <span
                className="px-2.5 py-1 rounded-full text-[12px] font-medium text-white"
                style={{ backgroundColor: "rgba(255,255,255,0.25)" }}
              >
                {sign.category}
              </span>
            )}
            <span
              className="px-2.5 py-1 rounded-full text-[12px] font-medium text-white"
              style={{ backgroundColor: "rgba(255,255,255,0.25)" }}
            >
              {difficulty}
            </span>
          </div>
          <h1 className="text-[32px] font-bold text-white leading-tight mb-1">{label}</h1>
        </div>
      </section>

      {/* Main content */}
      <main className="max-w-[640px] mx-auto px-6 py-8">
        {/* Sign card */}
        <div className="bg-white border border-[#e5e7eb] rounded-[20px] overflow-hidden shadow-sm mb-6">
          {/* Active GIF */}
          <div className="relative bg-[#f8f9ff] flex items-center justify-center h-[300px]">
            <img
              src={activeGif}
              alt={`Sign for ${label}`}
              className="h-full w-full object-contain"
            />
            {variants.length > 1 && (
              <span className="absolute top-3 right-3 bg-black/40 text-white text-[11px] font-medium px-2 py-0.5 rounded-full">
                {activeIdx + 1} / {variants.length}
              </span>
            )}
          </div>

          {/* Variant strip — only shown when there are multiple */}
          {variants.length > 1 && (
            <div className="border-t border-[#f3f4f6] bg-[#fafafa] px-4 py-3">
              <p className="text-[11px] font-semibold text-[#6a7282] uppercase tracking-wider mb-2">
                Variants
              </p>
              <div
                ref={scrollRef}
                className="flex gap-2 overflow-x-auto pb-1"
                style={{ scrollbarWidth: "none" }}
              >
                {variants.map((v, i) => (
                  <button
                    key={v.variant_label ?? "primary"}
                    onClick={() => setActiveIdx(i)}
                    className={`flex-shrink-0 w-[88px] h-[72px] rounded-[10px] overflow-hidden border-2 transition-all ${
                      i === activeIdx
                        ? "border-[#6176f7] shadow-sm"
                        : "border-transparent hover:border-[#6176f7]/40"
                    }`}
                  >
                    <img
                      src={v.gif_url}
                      alt={`Variant ${i + 1}`}
                      className="w-full h-full object-contain bg-[#f8f9ff]"
                    />
                  </button>
                ))}
              </div>
            </div>
          )}


          {/* Details */}
          <div className="p-6">
            <h2 className="text-[22px] font-bold text-[#101828] mb-3">{label}</h2>

            <div className="flex items-center gap-2 flex-wrap mb-4">
              {sign.category && (
                <span
                  className="px-2.5 py-1 rounded-full text-[12px] font-medium text-white"
                  style={{ backgroundColor: color }}
                >
                  {sign.category}
                </span>
              )}
              <span
                className={`px-2.5 py-1 rounded-full text-[12px] font-medium border ${
                  difficulty === "Beginner"
                    ? "bg-[#f0fdf4] border-[#b9f8cf] text-[#008236]"
                    : "bg-[#fefce8] border-[#fff085] text-[#a65f00]"
                }`}
              >
                {difficulty}
              </span>
            </div>

            <p className="text-[15px] text-[#4a5565] leading-relaxed mb-5">{description}</p>

            {/* Common Usage */}
            <div className="mb-5">
              <div className="flex items-center gap-2 mb-3">
                <BookOpen className="w-4 h-4 text-[#6a7282] flex-shrink-0" />
                <span className="text-[11px] font-semibold text-[#6a7282] uppercase tracking-wider">
                  Common Usage
                </span>
              </div>
              <ul className="flex flex-col gap-2">
                {usage.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-[14px] text-[#4a5565]">
                    <ChevronRight className="w-4 h-4 text-[#6176f7] flex-shrink-0 mt-0.5" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Related Signs */}
            {related.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Tag className="w-4 h-4 text-[#6a7282]" />
                  <span className="text-[11px] font-semibold text-[#6a7282] uppercase tracking-wider">
                    Related Signs
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {related.map((s) => (
                    <button
                      key={s.token}
                      onClick={() => onSelectSign(s)}
                      className="px-3 py-1 rounded-full text-[13px] text-[#6176f7] border border-[#6176f7]/30 bg-[#6176f7]/5 hover:bg-[#6176f7]/10 transition-colors"
                    >
                      {formatSignLabel(s.token)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <p className="text-[12px] text-[#99a1af] mt-5">
              Sign data sourced from{" "}
              <a
                href="https://blogs.ntu.edu.sg/sgslsignbank/"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-[#6176f7] transition-colors"
              >
                NTU SgSL Signbank
              </a>
            </p>
          </div>
        </div>

        {/* Explore Related Signs */}
        {related.length > 0 && (
          <div className="bg-white border border-[#e5e7eb] rounded-[20px] p-6 shadow-sm mb-8">
            <div className="flex items-center gap-2 mb-4">
              <Tag className="w-4 h-4 text-[#6a7282]" />
              <span className="text-[15px] font-semibold text-[#101828]">Explore Related Signs</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {related.slice(0, 4).map((s) => (
                <button
                  key={s.token}
                  onClick={() => onSelectSign(s)}
                  className="p-4 rounded-[12px] border border-[#f3f4f6] bg-[#fafafa] hover:border-[#6176f7]/30 hover:shadow-sm transition-all text-left"
                >
                  <p className="text-[15px] font-semibold text-[#101828] mb-2">
                    {formatSignLabel(s.token)}
                  </p>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {s.category && (
                      <span
                        className="px-2 py-0.5 rounded-full text-[11px] font-medium text-white"
                        style={{ backgroundColor: getCategoryMeta(s.category).color }}
                      >
                        {s.category}
                      </span>
                    )}
                    <span
                      className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${
                        getCategoryMeta(s.category).difficulty === "Beginner"
                          ? "bg-[#f0fdf4] border-[#b9f8cf] text-[#008236]"
                          : "bg-[#fefce8] border-[#fff085] text-[#a65f00]"
                      }`}
                    >
                      {getCategoryMeta(s.category).difficulty}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex-1 h-[48px] rounded-[12px] border border-[#e5e7eb] text-[15px] font-medium text-[#4a5565] hover:border-[#6176f7]/40 hover:text-[#6176f7] transition-all"
          >
            Back to Dictionary
          </button>
          <button
            onClick={() => onNavigate("translate" as NavMode)}
            className="flex-1 h-[48px] rounded-[12px] bg-[#6176f7] text-white text-[15px] font-medium hover:bg-[#4f63e5] transition-colors"
          >
            Translate a phrase
          </button>
        </div>
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
                  <button
                    onClick={onBack}
                    className="text-[14px] text-[#6a7282] hover:text-[#6176f7] transition-colors"
                  >
                    SgSL Dictionary
                  </button>
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
