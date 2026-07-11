import { Tag } from "lucide-react"
import { getTagStyle } from "@/lib/categories"
import { type SignDetail, formatSignLabel } from "@/components/signs/types"

interface RelatedSignsSectionProps {
  title?: string
  related: SignDetail[]
  onSelectSign: (sign: SignDetail) => void
}

export function RelatedSignsSection({
  title = "Explore Related Signs",
  related,
  onSelectSign,
}: RelatedSignsSectionProps) {
  if (related.length === 0) return null

  return (
    <div className="bg-white border border-[#e5e7eb] rounded-[20px] p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <Tag className="w-4 h-4 text-[#6a7282]" />
        <span className="text-[15px] font-semibold text-[#101828]">{title}</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {related.map((s) => (
          <button
            key={s.token}
            onClick={() => onSelectSign(s)}
            className="p-4 rounded-[12px] border border-[#f3f4f6] bg-[#fafafa] hover:border-[#6176f7]/30 hover:shadow-sm transition-all text-left"
          >
            <p className="text-[15px] font-semibold text-[#101828] mb-2">
              {formatSignLabel(s.token)}
            </p>
            <div className="flex items-center gap-1.5 flex-wrap">
              {(s.tags ?? []).map((tag) => {
                const style = getTagStyle(tag)
                return (
                  <span
                    key={tag}
                    className="px-2 py-0.5 rounded-full text-[11px] font-medium border"
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
          </button>
        ))}
      </div>
    </div>
  )
}
