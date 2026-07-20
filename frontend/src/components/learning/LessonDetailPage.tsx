import { useEffect, useState } from "react"
import { ArrowLeft, BookOpen, ChevronRight, Lightbulb, Tag } from "lucide-react"
import { AppNavbar, type NavMode } from "@/components/AppNavbar"
import { formatSignLabel } from "./utils"
import type { LessonDetail, LessonProgress, LessonSign } from "./types"

interface LessonDetailPageProps {
  lesson: LessonDetail
  progress?: LessonProgress
  onBack: () => void
  onStartQuiz: () => void
  onSignViewed: (token: string) => void
  onNavigate: (dest: NavMode | "home") => void
  onSignOut: () => void
  isAdmin?: boolean
  isLoggedIn?: boolean
}

function ParamValue({ value }: { value?: string }) {
  if (!value || value === "N/A") {
    return <span className="text-[13px] text-[#99a1af]">—</span>
  }
  return (
    <span className="inline-block rounded-full bg-[#fef2f2] px-2 py-0.5 text-[12px] font-medium text-[#b91c1c]">
      {value}
    </span>
  )
}

export function LessonDetailPage({
  lesson,
  progress,
  onBack,
  onStartQuiz,
  onSignViewed,
  onNavigate,
  onSignOut,
  isAdmin,
  isLoggedIn,
}: LessonDetailPageProps) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [activeVariantIdx, setActiveVariantIdx] = useState(0)

  const total = lesson.signs.length
  const sign: LessonSign | undefined = lesson.signs[selectedIndex]
  const signsViewed = new Set(progress?.signs_viewed ?? [])

  useEffect(() => {
    setActiveVariantIdx(0)
  }, [selectedIndex])

  useEffect(() => {
    if (sign) onSignViewed(sign.token)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sign?.token])

  if (!sign) return null

  const variants = [
    { sign_name: sign.sign_name, variant_label: null as string | null, gif_url: sign.gif_url },
    ...(sign.variants ?? []),
  ]
  const activeGif = variants[activeVariantIdx]?.gif_url ?? sign.gif_url
  const label = formatSignLabel(sign.token)

  const equivalents = (sign.translation_equivalents ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s && s !== "N/A")

  const hasVisualGuide = sign.visual_guide && sign.visual_guide !== "N/A"
  const parameterRows = Object.entries(sign.parameters ?? {})
  const units = sign.units ?? []

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
      <AppNavbar
        activeMode="learn"
        onNavigate={(dest) => onNavigate(dest)}
        onLogout={onSignOut}
        isAdmin={isAdmin}
        isLoggedIn={isLoggedIn}
      />

      {/* Hero */}
      <section className="bg-[#6176f7] px-6 py-8">
        <div className="mx-auto max-w-[1152px]">
          <button
            onClick={onBack}
            className="mb-4 flex items-center gap-1.5 text-[14px] font-medium text-white/80 transition-colors hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <h1 className="text-center text-[30px] font-bold leading-9 text-white">{lesson.lesson_name}</h1>
          <div className="mt-4 flex items-center justify-center gap-3">
            <div className="h-2 max-w-[400px] flex-1 overflow-hidden rounded-full bg-white/30">
              <div
                className="h-full rounded-full bg-white transition-all"
                style={{ width: `${((selectedIndex + 1) / total) * 100}%` }}
              />
            </div>
            <span className="shrink-0 text-[12px] font-medium text-white/80">
              {selectedIndex + 1}/{total}
            </span>
          </div>
        </div>
      </section>

      {/* Content */}
      <div className="mx-auto flex max-w-[1152px] gap-6 px-6 py-8">
        {/* Sidebar */}
        <aside className="flex w-[280px] flex-shrink-0 flex-col gap-2">
          {lesson.signs.map((s, idx) => {
            const isCurrent = idx === selectedIndex
            const isDone = signsViewed.has(s.token) && !isCurrent
            return (
              <button
                key={`${s.token}-${idx}`}
                onClick={() => setSelectedIndex(idx)}
                className={`flex items-center justify-between rounded-[14px] px-4 py-3 text-left text-[14px] font-semibold transition-all ${
                  isCurrent
                    ? "border-2 border-[#6176f7] bg-white text-[#101828]"
                    : isDone
                    ? "border border-transparent bg-[#f0fdf4] text-[#101828]"
                    : "border border-transparent bg-white text-[#101828] hover:bg-gray-50"
                }`}
              >
                <span className="truncate">{formatSignLabel(s.token)}</span>
                {isDone ? (
                  <span className="ml-2 shrink-0 rounded-full bg-[#dcfce7] px-2 py-0.5 text-[11px] font-semibold text-[#008236]">
                    Done
                  </span>
                ) : (
                  <ChevronRight className="ml-2 h-4 w-4 shrink-0 text-[#99a1af]" />
                )}
              </button>
            )
          })}

          <button
            onClick={onStartQuiz}
            className="mt-2 flex items-center justify-center gap-2 rounded-[14px] bg-[#6176f7] px-4 py-3 text-[14px] font-semibold text-white shadow-sm transition-colors hover:bg-[#5068f0]"
          >
            <Lightbulb className="h-4 w-4" />
            Quiz
          </button>
        </aside>

        {/* Main panel */}
        <main className="min-w-0 flex-1">
          <h2 className="text-[22px] font-bold text-[#101828]">{label}</h2>

          {variants.length > 1 && (
            <div className="mt-4">
              <p className="mb-2 text-[13px] font-semibold text-[#101828]">Sign Variants</p>
              <div className="flex flex-wrap gap-2">
                {variants.map((v, idx) => (
                  <button
                    key={v.variant_label ?? "primary"}
                    onClick={() => setActiveVariantIdx(idx)}
                    className={`rounded-[10px] border px-4 py-1.5 text-[13px] font-medium transition-colors ${
                      idx === activeVariantIdx
                        ? "border-transparent bg-[#6176f7] text-white"
                        : "border-[#e5e7eb] bg-white text-[#4a5565] hover:border-[#6176f7]/40"
                    }`}
                  >
                    {idx === 0 ? label : `${label}${v.variant_label}`}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mt-4 rounded-[16px] border border-[#e5e7eb] bg-white p-6 shadow-sm">
            <p className="mb-3 text-[13px] font-semibold text-[#101828]">Sign Details</p>
            <div className="relative flex h-[280px] items-center justify-center overflow-hidden rounded-[14px] bg-[#f8f9ff]">
              <img key={activeGif} src={activeGif} alt={`Sign for ${label}`} className="h-full w-full object-contain" />
            </div>

            {sign.description && (
              <p className="mt-4 text-[14px] leading-relaxed text-[#4a5565]">{sign.description}</p>
            )}

            {hasVisualGuide && (
              <div className="mt-5 border-t border-[#f3f4f6] pt-4">
                <div className="mb-1.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-[#6a7282]">
                  <BookOpen className="h-3.5 w-3.5" />
                  Visual Guide
                </div>
                <p className="flex items-start gap-1.5 text-[14px] text-[#4a5565]">
                  <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#99a1af]" />
                  {sign.visual_guide}
                </p>
              </div>
            )}

            {equivalents.length > 0 && (
              <div className="mt-5 border-t border-[#f3f4f6] pt-4">
                <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-[#6a7282]">
                  <Tag className="h-3.5 w-3.5" />
                  Translation Equivalents
                </div>
                <div className="flex flex-wrap gap-2">
                  {equivalents.map((eq) => (
                    <span
                      key={eq}
                      className="rounded-full border border-[#6176f7]/30 bg-[#6176f7]/5 px-3 py-1 text-[13px] text-[#6176f7]"
                    >
                      {eq}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {parameterRows.length > 0 && (
            <div className="mt-6">
              <p className="mb-3 text-[16px] font-bold text-[#101828]">Parameters of Sign</p>
              <div className="overflow-hidden rounded-[12px] border border-[#e5e7eb]">
                <table className="w-full border-collapse text-left text-[13px]">
                  <thead>
                    <tr className="bg-[#f9fafb]">
                      <th className="p-3 font-semibold text-[#101828]"></th>
                      <th className="p-3 font-semibold text-[#101828]">Dominant Hand</th>
                      <th className="p-3 font-semibold text-[#101828]">Non-Dominant Hand</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parameterRows.map(([param, values], idx) => (
                      <tr key={param} className={idx % 2 === 1 ? "bg-[#f9fafb]" : "bg-white"}>
                        <th className="p-3 align-top font-semibold text-[#101828]">{param}</th>
                        <td className="p-3 align-top">
                          <ParamValue value={values["Dominant Hand"]} />
                        </td>
                        <td className="p-3 align-top">
                          <ParamValue value={values["Non-Dominant Hand"]} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {units.length > 0 && (
            <div className="mt-6">
              <p className="mb-3 text-[16px] font-bold text-[#101828]">Units of Sign</p>
              <div className="grid grid-cols-3 gap-4">
                {units.map((unit, idx) => (
                  <div key={idx} className="rounded-[12px] border border-[#e5e7eb] p-4 text-center">
                    <div className="mx-auto mb-2 flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-gray-100">
                      <img src={unit.image_url} alt={unit.step ?? `Step ${idx + 1}`} className="h-full w-full object-cover" />
                    </div>
                    <p className="text-[12px] text-[#6a7282]">Step {idx + 1}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-6 flex gap-3">
            <button
              onClick={() => setSelectedIndex((i) => Math.max(0, i - 1))}
              disabled={selectedIndex === 0}
              className="flex-1 rounded-[12px] border border-[#e5e7eb] py-3 text-[14px] font-medium text-[#4a5565] transition-colors hover:border-[#6176f7]/40 hover:text-[#6176f7] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Previous
            </button>
            <button
              onClick={() => setSelectedIndex((i) => Math.min(total - 1, i + 1))}
              disabled={selectedIndex === total - 1}
              className="flex-1 rounded-[12px] bg-[#6176f7] py-3 text-[14px] font-medium text-white transition-colors hover:bg-[#5068f0] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </main>
      </div>
    </div>
  )
}
