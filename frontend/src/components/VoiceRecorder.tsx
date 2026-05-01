import { useState } from "react"
import { Mic, Square, RotateCcw, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useVoiceRecording } from "@/hooks/useVoiceRecording"
import { useTranslation, type TranslationResult } from "@/hooks/useTranslation"
import { cn } from "@/lib/utils"

interface VoiceRecorderProps {
  onResult: (result: TranslationResult) => void
}

export function VoiceRecorder({ onResult }: VoiceRecorderProps) {
  const [showReview, setShowReview] = useState(false)
  const [editedTranscription, setEditedTranscription] = useState("")
  const { translate, isLoading: isTranslating } = useTranslation()

  const { isRecording, isProcessing, transcription, toggleRecording, clearTranscription } =
    useVoiceRecording({
      onResult: (result) => {
        onResult(result)
        setShowReview(false)
      },
      onTranscription: (text) => {
        setEditedTranscription(text)
        setShowReview(true)
      },
    })

  const handleConfirm = async () => {
    if (!editedTranscription.trim()) return
    const result = await translate(editedTranscription.trim())
    if (result) {
      onResult(result)
      setShowReview(false)
      clearTranscription()
    }
  }

  const handleRetry = () => {
    setShowReview(false)
    setEditedTranscription("")
    clearTranscription()
  }

  const statusText = isRecording
    ? "Recording… tap to stop"
    : isProcessing
    ? "Processing…"
    : "Tap to start speaking"

  return (
    <div className="flex flex-col items-center py-8 gap-5 animate-fade-in">
      {/* Mic button */}
      <div className="relative">
        {/* Pulsing ring when recording */}
        {isRecording && (
          <span className="absolute inset-0 rounded-full bg-accent-terracotta/20 animate-ping" />
        )}
        <button
          onClick={toggleRecording}
          disabled={isProcessing}
          className={cn(
            "relative w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300",
            "border-2 shadow-[0_4px_24px_rgba(0,0,0,0.5)]",
            isRecording
              ? "border-accent-terracotta bg-accent-soft animate-pulse-recording"
              : "border-border-warm bg-bg-input hover:border-accent-terracotta hover:bg-bg-card hover:scale-105 hover:shadow-[0_8px_32px_rgba(217,112,64,0.2)]",
            isProcessing && "opacity-50 cursor-not-allowed"
          )}
        >
          {isRecording ? (
            <Square className="w-9 h-9 text-accent-terracotta fill-current" />
          ) : (
            <Mic className="w-9 h-9 text-text-secondary" />
          )}
        </button>
      </div>

      <p className="text-sm text-text-secondary text-center">{statusText}</p>

      {/* Wave bars */}
      {isRecording && (
        <div className="flex items-center justify-center gap-[5px] h-8">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="w-[3px] bg-gradient-accent rounded-full animate-wave"
              style={{
                animationDelay: `${i * 0.13}s`,
                height: [8, 16, 26, 16, 8][i],
              }}
            />
          ))}
        </div>
      )}

      {/* Transcription review */}
      {showReview && transcription && (
        <div className="w-full p-5 bg-bg-input border border-border-soft rounded-[16px] animate-fade-in flex flex-col gap-3">
          <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-text-muted">
            What we heard
          </p>
          <Input
            value={editedTranscription}
            onChange={(e) => setEditedTranscription(e.target.value)}
            placeholder="Your words will appear here…"
          />
          <div className="flex gap-2">
            <Button
              className="flex-1"
              onClick={handleConfirm}
              disabled={isTranslating || !editedTranscription.trim()}
            >
              {isTranslating ? (
                <>
                  <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  Translating…
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Looks good
                </>
              )}
            </Button>
            <Button variant="outline" onClick={handleRetry}>
              <RotateCcw className="w-4 h-4" />
              Retry
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
