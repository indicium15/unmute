import { ArrowLeft } from "lucide-react"
import { AppNavbar, type NavMode } from "@/components/AppNavbar"
import { Footer } from "@/components/Footer"
import { SignMediaCard } from "@/components/signs/SignMediaCard"
import { SignParametersTable } from "@/components/signs/SignParametersTable"
import { SignUnitsStrip } from "@/components/signs/SignUnitsStrip"
import { RelatedSignsSection } from "@/components/signs/RelatedSignsSection"
import { type SignDetail, formatSignLabel } from "@/components/signs/types"

export type { SignVariant, SignDetail } from "@/components/signs/types"

interface SignDetailPageProps {
  sign: SignDetail
  relatedSigns: SignDetail[]
  onBack: () => void
  onSelectSign: (sign: SignDetail) => void
  onNavigate: (dest: NavMode | "home") => void
  onSignOut?: () => void
  isAdmin?: boolean
  isLoggedIn?: boolean
}

export function SignDetailPage({
  sign,
  relatedSigns,
  onBack,
  onSelectSign,
  onNavigate,
  onSignOut,
  isAdmin,
  isLoggedIn = true,
}: SignDetailPageProps) {
  const label = formatSignLabel(sign.token)

  // Related signs share at least one tag with this sign
  const related = relatedSigns
    .filter((s) => s.token !== sign.token && s.tags.some((t) => sign.tags.includes(t)))
    .slice(0, 4)

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
      <section className="bg-[#6176f7] pt-10 pb-8">
        <div className="max-w-[640px] mx-auto px-6">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-white/80 hover:text-white text-[14px] font-medium mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            {sign.tags.map((tag) => (
              <span
                key={tag}
                className="px-2.5 py-1 rounded-full text-[12px] font-medium text-white"
                style={{ backgroundColor: "rgba(255,255,255,0.25)" }}
              >
                {tag}
              </span>
            ))}
          </div>
          <h1 className="text-[32px] font-bold text-white leading-tight mb-1">{label}</h1>
        </div>
      </section>

      {/* Main content */}
      <main className="max-w-[640px] mx-auto px-6 py-8 flex flex-col gap-6">
        <SignMediaCard
          sign={sign}
          relatedSigns={related}
          onSelectSign={onSelectSign}
          showRelatedInline
        />

        <SignParametersTable parameters={sign.parameters} />

        <SignUnitsStrip units={sign.units} />

        <RelatedSignsSection related={related} onSelectSign={onSelectSign} />

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

      <Footer onNavigate={onNavigate} />
    </div>
  )
}
