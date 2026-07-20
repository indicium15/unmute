import { useState, useEffect, useRef, useMemo, useCallback } from "react"
import { AlertCircle, ArrowLeft, ChevronLeft, ChevronRight, Loader2, Mic, Pause, Play, Search, Square, Timer } from "lucide-react"
import { AppNavbar, type NavMode } from "@/components/AppNavbar"
import { Footer } from "@/components/Footer"
import { FeedbackWidget } from "@/components/FeedbackWidget"
import { SignMediaCard } from "@/components/signs/SignMediaCard"
import { SignParametersTable } from "@/components/signs/SignParametersTable"
import { SignUnitsStrip } from "@/components/signs/SignUnitsStrip"
import { RelatedSignsSection } from "@/components/signs/RelatedSignsSection"
import { formatSignLabel } from "@/components/signs/types"
import { useVoiceRecording } from "@/hooks/useVoiceRecording"
import { useSignCatalog } from "@/hooks/useSignCatalog"
import { useSignDetail } from "@/hooks/useSignDetail"
import type { TranslationResult } from "@/hooks/useTranslation"

const STEP_DURATION_MS = 3000

function formatCountdown(seconds: number): string {
  if (seconds >= 60) {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${String(s).padStart(2, "0")}`
  }
  return `${seconds}s`
}

interface TranslatePageProps {
  onNavigate: (dest: NavMode | "home") => void
  onSignOut?: () => void
  isAdmin?: boolean
  isLoggedIn?: boolean
  result: TranslationResult | null
  isLoading: boolean
  error?: string | null
  retryAfter?: number | null
  onTranslate: (text: string) => Promise<TranslationResult | null>
  onVoiceResult: (result: TranslationResult) => void
  initialText?: string
  onInitialTextConsumed?: () => void
  onViewSignInDictionary: (token: string) => void
}

export function TranslatePage({
  onNavigate,
  onSignOut,
  isAdmin,
  isLoggedIn = true,
  result,
  isLoading,
  error,
  retryAfter,
  onTranslate,
  onVoiceResult,
  initialText,
  onInitialTextConsumed,
  onViewSignInDictionary,
}: TranslatePageProps) {
  const [inputText, setInputText] = useState(initialText ?? "")
  const [activeIndex, setActiveIndex] = useState(0)
  const [autoplay, setAutoplay] = useState(true)
  const [countdown, setCountdown] = useState<number | null>(null)
  const hasAutoTranslated = useRef(false)

  const catalog = useSignCatalog()

  useEffect(() => {
    if (initialText && !hasAutoTranslated.current) {
      hasAutoTranslated.current = true
      setInputText(initialText)
      onInitialTextConsumed?.()
      if (!result) {
        onTranslate(initialText)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Reset step navigation whenever a new translation result arrives
  useEffect(() => {
    setActiveIndex(0)
    setAutoplay(true)
  }, [result])

  const handleVoiceResult = useCallback(
    (voiceResult: TranslationResult) => {
      if (voiceResult.transcription) {
        setInputText(voiceResult.transcription)
      }
      onVoiceResult(voiceResult)
    },
    [onVoiceResult]
  )

  const {
    isRecording,
    isProcessing,
    error: voiceError,
    retryAfter: voiceRetryAfter,
    toggleRecording,
  } = useVoiceRecording({
    onResult: handleVoiceResult,
    onTranscription: (text) => setInputText(text),
  })

  const activeRetryAfter = retryAfter ?? voiceRetryAfter ?? null
  const activeError = error ?? voiceError ?? null

  useEffect(() => {
    if (!activeRetryAfter) {
      setCountdown(null)
      return
    }
    const update = () => {
      const secs = Math.ceil((activeRetryAfter - Date.now()) / 1000)
      setCountdown(secs > 0 ? secs : null)
    }
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [activeRetryAfter])

  const isRateLimited = countdown !== null && countdown > 0

  const handleTranslateClick = useCallback(async () => {
    const text = inputText.trim()
    if (!text) return
    await onTranslate(text)
  }, [inputText, onTranslate])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleTranslateClick()
    }
  }

  const signItems = useMemo(
    () => (result?.plan ?? []).filter((p) => p.type === "sign" && p.sign_name),
    [result]
  )
  const totalSteps = signItems.length
  const activeSignItem = signItems[activeIndex]
  const { detail: activeSignDetail, loading: activeSignLoading } = useSignDetail(activeSignItem?.token)

  const goToIndex = useCallback((idx: number) => {
    setActiveIndex(idx)
    setAutoplay(false)
  }, [])

  const handlePrev = () => goToIndex(Math.max(0, activeIndex - 1))
  const handleNext = () => goToIndex(Math.min(totalSteps - 1, activeIndex + 1))
  const togglePlay = () => setAutoplay((v) => !v)

  // Autoplay: advance through steps on a timer, pausing on manual navigation
  useEffect(() => {
    if (!autoplay || totalSteps === 0 || activeIndex >= totalSteps - 1) return
    const id = setTimeout(() => setActiveIndex((i) => i + 1), STEP_DURATION_MS)
    return () => clearTimeout(id)
  }, [autoplay, activeIndex, totalSteps])

  const activeCategory = activeSignItem ? catalog.tokenToCategory[activeSignItem.token] : undefined
  const activeTags = activeSignItem ? catalog.tokenToTags[activeSignItem.token] ?? [] : []
  const related = activeSignItem
    ? catalog.relatedSigns(activeSignItem.token, activeTags, 4)
    : []

  const handleNewTranslation = () => {
    setInputText("")
  }

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
      <AppNavbar
        activeMode="translate"
        onNavigate={(dest) => onNavigate(dest)}
        onLogout={onSignOut ?? (() => {})}
        isAdmin={isAdmin}
        isLoggedIn={isLoggedIn}
      />

      {/* Hero */}
      <section className="bg-[#6176f7] pt-10 pb-8">
        <div className="max-w-[900px] mx-auto px-6">
          <button
            onClick={() => onNavigate("home")}
            className="flex items-center gap-1.5 text-white/80 hover:text-white text-[14px] font-medium mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <h1 className="text-[32px] font-bold text-white leading-tight mb-4">Translate</h1>

          <div className="flex items-center gap-2 bg-white rounded-[14px] shadow-md p-2">
            <Search className="w-5 h-5 text-[#99a1af] ml-2 flex-shrink-0" />
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="What would you like to say?"
              disabled={isLoading}
              className="flex-1 h-10 px-1 text-[15px] text-[#1e2939] placeholder:text-[#99a1af] outline-none bg-transparent disabled:opacity-60"
            />
            <button
              type="button"
              onClick={toggleRecording}
              disabled={isProcessing || isLoading || isRateLimited}
              title={isRecording ? "Stop recording" : "Record voice"}
              className={`inline-flex h-10 w-10 items-center justify-center rounded-full transition-all duration-200 flex-shrink-0 ${
                isRecording
                  ? "bg-[#6176f7]/10 text-[#6176f7]"
                  : "text-[#99a1af] hover:bg-[#f3f4f6] hover:text-[#4a5565]"
              } disabled:opacity-40`}
            >
              {isRecording ? <Square className="h-4 w-4 fill-current" /> : <Mic className="h-4 w-4" />}
            </button>
            <button
              onClick={handleTranslateClick}
              disabled={isLoading || !inputText.trim() || isRateLimited}
              className="h-10 px-5 rounded-[10px] bg-[#101828] text-white text-[14px] font-medium hover:bg-[#1e2939] transition-colors disabled:opacity-40 flex-shrink-0 flex items-center gap-2"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Translate
            </button>
          </div>

          {result && (
            <p className="text-[13px] text-white/70 mt-3">
              {signItems.length} sign{signItems.length === 1 ? "" : "s"} found for this phrase
            </p>
          )}

          {isRateLimited ? (
            <div className="flex gap-2 rounded-[12px] bg-white/10 px-3 py-2.5 mt-3 text-sm text-white">
              <Timer className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>
                Rate limit reached — try again in{" "}
                <span className="font-semibold tabular-nums">{formatCountdown(countdown!)}</span>
              </span>
            </div>
          ) : activeError ? (
            <div className="flex gap-2 rounded-[12px] bg-white/10 px-3 py-2.5 mt-3 text-sm text-white">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>{activeError}</span>
            </div>
          ) : null}
        </div>
      </section>

      {/* Content */}
      <main className="max-w-[900px] mx-auto px-6 py-8 flex flex-col gap-6">
        {result && result.unmatched && result.unmatched.length > 0 && (
          <div className="flex items-start gap-2 rounded-[14px] border border-amber-200 bg-amber-50 px-4 py-3">
            <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
            <p className="text-[14px] text-amber-700">
              Some words weren't found in our dictionary:{" "}
              {result.unmatched.map((w) => `"${w}"`).join(", ")}
            </p>
          </div>
        )}

        {signItems.length > 0 && (
          <div>
            <p className="text-[11px] font-semibold tracking-wider uppercase text-[#6a7282] mb-2">
              Signing Order
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {signItems.map((item, i) => (
                <div key={`${item.token}-${i}`} className="flex items-center gap-2">
                  <button
                    onClick={() => goToIndex(i)}
                    className={`px-3 py-1.5 rounded-full text-[13px] font-medium transition-colors ${
                      i === activeIndex
                        ? "bg-[#6176f7] text-white"
                        : i % 2 === 0
                        ? "bg-[#6176f7]/10 text-[#6176f7] hover:bg-[#6176f7]/20"
                        : "bg-[#ec4899]/10 text-[#ec4899] hover:bg-[#ec4899]/20"
                    }`}
                  >
                    #{i + 1} {formatSignLabel(item.token)}
                  </button>
                  {i < signItems.length - 1 && <span className="text-[#d1d5dc]">→</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {signItems.length > 0 && (
          <div className="flex items-center gap-3">
            <span className="flex-shrink-0 w-7 h-7 rounded-full bg-[#6176f7] text-white text-[13px] font-semibold flex items-center justify-center">
              {activeIndex + 1}
            </span>
            <div className="flex-1 h-1.5 rounded-full bg-[#f3f4f6] overflow-hidden">
              <div
                className="h-full bg-[#6176f7] transition-all duration-300"
                style={{ width: `${((activeIndex + 1) / totalSteps) * 100}%` }}
              />
            </div>
            <span className="flex-shrink-0 text-[12px] font-medium text-[#6a7282] uppercase tracking-wide">
              Step {activeIndex + 1} of {totalSteps}
            </span>
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={handlePrev}
                disabled={activeIndex === 0}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[#4a5565] hover:bg-[#f3f4f6] disabled:opacity-30 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={togglePlay}
                title={autoplay ? "Pause autoplay" : "Resume autoplay"}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[#4a5565] hover:bg-[#f3f4f6] transition-colors"
              >
                {autoplay ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </button>
              <button
                onClick={handleNext}
                disabled={activeIndex === totalSteps - 1}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[#4a5565] hover:bg-[#f3f4f6] disabled:opacity-30 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {activeSignItem && (
          <>
            <SignMediaCard
              sign={
                activeSignDetail
                  ? { ...activeSignDetail, tags: activeTags }
                  : {
                      token: activeSignItem.token,
                      sign_name: activeSignItem.sign_name ?? "",
                      gif_url: activeSignItem.assets?.gif ?? "",
                      tags: activeTags,
                    }
              }
              showRelatedInline={false}
              loading={activeSignLoading}
            />
            <SignParametersTable parameters={activeSignDetail?.parameters} />
            <SignUnitsStrip units={activeSignDetail?.units} />
            <RelatedSignsSection
              title={activeCategory ? `Explore Other ${activeCategory}` : "Explore Related Signs"}
              related={related}
              onSelectSign={(s) => onViewSignInDictionary(s.token)}
            />
            <div className="flex justify-center">
              <FeedbackWidget logDocId={result?.log_doc_id} />
            </div>
          </>
        )}

        {!result && !isLoading && (
          <div className="flex flex-col items-center justify-center gap-3 rounded-[14px] border border-dashed border-[#e5e7eb] bg-[#fafafa] px-4 py-16 text-center">
            <p className="max-w-xs text-sm leading-relaxed text-[#6a7282]">
              Type or record something above to see the sign sequence and step through each sign.
            </p>
          </div>
        )}

        {(result || signItems.length > 0) && (
          <div className="flex items-center gap-3">
            <button
              onClick={() => onNavigate("dictionary")}
              className="flex-1 h-[48px] rounded-[12px] border border-[#e5e7eb] text-[15px] font-medium text-[#4a5565] hover:border-[#6176f7]/40 hover:text-[#6176f7] transition-all"
            >
              Back to Dictionary
            </button>
            <button
              onClick={handleNewTranslation}
              className="flex-1 h-[48px] rounded-[12px] bg-[#6176f7] text-white text-[15px] font-medium hover:bg-[#4f63e5] transition-colors"
            >
              Translate a phrase
            </button>
          </div>
        )}
      </main>

      <Footer onNavigate={onNavigate} />
    </div>
  )
}
