import { useRef, useState } from "react"
import { getTagStyle } from "@/lib/categories"
import { type SignDetail, type SignVariant, formatSignLabel } from "@/components/signs/types"

interface SignMediaCardProps {
  sign: SignDetail
  relatedSigns?: SignDetail[]
  onSelectSign?: (sign: SignDetail) => void
  showRelatedInline?: boolean
  loading?: boolean
}

export function SignMediaCard({
  sign,
  relatedSigns = [],
  onSelectSign,
  showRelatedInline = false,
  loading = false,
}: SignMediaCardProps) {
  const label = formatSignLabel(sign.token)
  const variants: SignVariant[] = [
    { sign_name: sign.sign_name, variant_label: null, gif_url: sign.gif_url },
    ...(sign.variants ?? []),
  ]

  const [activeIdx, setActiveIdx] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)
  const activeGif = variants[activeIdx]?.gif_url ?? sign.gif_url

  const translationEquivalents = (sign.translation_equivalents ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t && t.toUpperCase() !== "N/A")

  const hasVisualGuide = sign.visual_guide && sign.visual_guide.toUpperCase() !== "N/A"

  return (
    <div className="bg-white border border-[#e5e7eb] rounded-[20px] overflow-hidden shadow-sm">
      {/* Active GIF */}
      <div className="relative bg-[#f8f9ff] flex items-center justify-center h-[300px]">
        {loading ? (
          <div className="w-8 h-8 rounded-full border-2 border-[#6176f7] border-t-transparent animate-spin" />
        ) : (
          <img
            src={activeGif}
            alt={`Sign for ${label}`}
            className="h-full w-full object-contain"
          />
        )}
        {variants.length > 1 && (
          <span className="absolute top-3 right-3 bg-black/40 text-white text-[11px] font-medium px-2 py-0.5 rounded-full">
            {activeIdx + 1} / {variants.length}
          </span>
        )}
      </div>

      {/* Variant strip */}
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

        {(sign.tags ?? []).length > 0 && (
          <div className="flex items-center gap-2 flex-wrap mb-4">
            {(sign.tags ?? []).map((tag) => {
              const style = getTagStyle(tag)
              return (
                <span
                  key={tag}
                  className="px-2.5 py-1 rounded-full text-[12px] font-medium border"
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

        {sign.description && (
          <p className="text-[14px] leading-relaxed text-[#4a5565] mb-4">{sign.description}</p>
        )}

        {hasVisualGuide && (
          <div className="mb-4">
            <p className="text-[11px] font-semibold text-[#6a7282] uppercase tracking-wider mb-1.5">
              Visual Guide
            </p>
            <p className="text-[14px] text-[#4a5565]">{sign.visual_guide}</p>
          </div>
        )}

        {translationEquivalents.length > 0 && (
          <div className="mb-4">
            <p className="text-[11px] font-semibold text-[#6a7282] uppercase tracking-wider mb-2">
              Translation Equivalents
            </p>
            <div className="flex flex-wrap gap-2">
              {translationEquivalents.map((eq) => (
                <span
                  key={eq}
                  className="px-2.5 py-1 rounded-full text-[12px] font-medium text-[#6176f7] border border-[#6176f7]/30 bg-[#6176f7]/5"
                >
                  {eq}
                </span>
              ))}
            </div>
          </div>
        )}

        {showRelatedInline && relatedSigns.length > 0 && (
          <div>
            <p className="text-[11px] font-semibold text-[#6a7282] uppercase tracking-wider mb-3">
              Related Signs
            </p>
            <div className="flex flex-wrap gap-2">
              {relatedSigns.map((s) => (
                <button
                  key={s.token}
                  onClick={() => onSelectSign?.(s)}
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
  )
}
