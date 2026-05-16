import { useState } from "react"
import { AlertCircle, ArrowUp, Clock, Loader2, Mic, Square } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { GlossDisplay } from "@/components/GlossDisplay"
import { useVoiceRecording } from "@/hooks/useVoiceRecording"
import type { TranslationResult } from "@/hooks/useTranslation"
import { cn } from "@/lib/utils"

interface InputPanelProps {
  onTranslate: (text: string) => Promise<TranslationResult | null>
  onVoiceResult: (result: TranslationResult) => void
  isLoading: boolean
  error?: string | null
  result: TranslationResult | null
}

interface RecentTranslation {
  id: string
  label: string
  result: TranslationResult
}

export function InputPanel({ onTranslate, onVoiceResult, isLoading, error, result }: InputPanelProps) {
  const [inputText, setInputText] = useState("")
  const [recentTranslations, setRecentTranslations] = useState<RecentTranslation[]>([])

  const addRecentTranslation = (label: string, translationResult: TranslationResult) => {
    const trimmedLabel = label.trim() || "Voice translation"
    setRecentTranslations((items) => {
      const nextItem = {
        id: `${Date.now()}-${trimmedLabel}`,
        label: trimmedLabel,
        result: translationResult,
      }
      return [nextItem, ...items.filter((item) => item.label !== trimmedLabel)].slice(0, 5)
    })
  }

  const handleVoiceResult = (voiceResult: TranslationResult) => {
    const label = voiceResult.transcription?.trim() || "Voice translation"
    addRecentTranslation(label, voiceResult)
    onVoiceResult(voiceResult)
  }

  const {
    isRecording,
    isProcessing,
    error: voiceError,
    toggleRecording,
  } = useVoiceRecording({
    onResult: handleVoiceResult,
  })

  const handleTranslate = async () => {
    const text = inputText.trim()
    if (!text) return
    const translationResult = await onTranslate(text)
    if (translationResult) {
      addRecentTranslation(text, translationResult)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleTranslate()
    }
  }

  const handleRecentClick = (item: RecentTranslation) => {
    setInputText(item.label === "Voice translation" ? "" : item.label)
  }

  const statusMessage = isRecording
    ? "Recording… tap the square to stop"
    : isProcessing
    ? "Processing voice input…"
    : null

  const hasRecentTranslations = recentTranslations.length > 0
  const unmatched = result?.unmatched ?? []

  return (
    <Card className="h-full p-4 sm:p-5 flex flex-col gap-5">
      <div>
        <p className="text-[10px] font-semibold tracking-[0.22em] uppercase text-text-muted">Input</p>
      </div>

      <div className="flex flex-col gap-3 animate-fade-in">
        <div
          className={cn(
            "group flex min-h-[200px] flex-col rounded-[18px] border border-border-soft bg-bg-input transition-all duration-200",
            "focus-within:border-accent-terracotta focus-within:bg-bg-card focus-within:ring-2 focus-within:ring-accent-terracotta/15"
          )}
        >
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="What would you like to say?"
            rows={5}
            className="min-h-[136px] flex-1 resize-none bg-transparent px-5 pt-4 pb-2 font-sans text-sm leading-relaxed text-text-primary outline-none placeholder:text-text-muted disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isLoading || isProcessing}
          />

          <div className="flex items-center justify-between gap-3 px-3 pb-3">
            <button
              type="button"
              onClick={toggleRecording}
              disabled={isProcessing || isLoading}
              title={isRecording ? "Stop recording" : "Record voice"}
              className={cn(
                "inline-flex h-10 w-10 items-center justify-center rounded-full transition-all duration-200",
                "text-text-muted hover:bg-bg-card hover:text-text-secondary disabled:pointer-events-none disabled:opacity-45",
                isRecording && "bg-accent-soft text-accent-terracotta shadow-[0_0_0_6px_rgba(97,118,247,0.10)]"
              )}
            >
              {isRecording ? <Square className="h-4 w-4 fill-current" /> : <Mic className="h-4 w-4" />}
            </button>

            {statusMessage && (
              <p className="hidden flex-1 truncate text-center text-xs text-text-muted sm:block">
                {statusMessage}
              </p>
            )}

            <button
              type="button"
              onClick={handleTranslate}
              disabled={isLoading || isRecording || isProcessing || !inputText.trim()}
              title="Translate"
              className={cn(
                "inline-flex h-11 w-11 items-center justify-center rounded-full transition-all duration-200",
                "bg-[#101828] text-white shadow-[0_4px_14px_rgba(0,0,0,0.20)] hover:-translate-y-px hover:bg-[#1e2939]",
                "active:translate-y-0 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-35 disabled:shadow-none"
              )}
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {statusMessage && (
          <p className="text-xs text-text-muted sm:hidden">{statusMessage}</p>
        )}

        {(error || voiceError) && (
          <div className="flex gap-2 rounded-[12px] border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-600">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>{error || voiceError}</span>
          </div>
        )}
      </div>

      <div className="divider" />

      <div className="flex min-h-0 flex-1 flex-col gap-5">
        {result ? (
          <div className="animate-fade-in-up">
            <div className="flex flex-col gap-3">
              <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-text-muted">
                Sign Sequence
              </p>
              <GlossDisplay
                gloss={result.gloss || []}
                unmatched={unmatched}
              />
            </div>

            {unmatched.length > 0 && (
              <div className="mt-4 rounded-[14px] border border-red-200 bg-red-50 px-3 py-3">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-red-500">
                  Unmatched
                </p>
                <div className="flex flex-wrap gap-2">
                  {unmatched.map((token) => (
                    <Badge key={token} variant="missing">
                      {token}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {result.notes && (
              <p className="mt-4 rounded-[14px] border border-border-soft bg-bg-input/50 px-3 py-3 text-xs leading-relaxed text-text-muted">
                {result.notes}
              </p>
            )}
          </div>
        ) : hasRecentTranslations ? (
          <div className="rounded-[14px] border border-border-soft bg-bg-input/35 px-4 py-4 text-sm text-text-muted">
            Pick a recent translation to reuse it here.
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center rounded-[14px] border border-dashed border-border-soft bg-bg-input/25 px-4 py-8 text-center">
            <p className="max-w-xs text-sm leading-relaxed text-text-muted">
              Type or record something to see the sign sequence, notes, and recent translations here.
            </p>
          </div>
        )}

        {hasRecentTranslations && (
          <div className="mt-auto flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-text-muted" />
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-text-muted">
                Recent
              </p>
            </div>
            <div className="flex flex-col gap-2">
              {recentTranslations.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleRecentClick(item)}
                  className="group flex items-center justify-between gap-3 rounded-[12px] border border-border-soft bg-bg-input/45 px-3 py-2.5 text-left transition-all duration-200 hover:border-border-warm hover:bg-bg-input"
                >
                  <span className="min-w-0 flex-1 truncate text-sm text-text-secondary group-hover:text-text-primary">
                    {item.label}
                  </span>
                  <Badge variant="secondary" className="shrink-0 text-[0.65rem]">
                    {item.result.gloss?.length ?? 0} signs
                  </Badge>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}
