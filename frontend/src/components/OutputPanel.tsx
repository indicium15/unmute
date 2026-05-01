import { useState, useEffect } from "react"
import { RefreshCw, Play, ThumbsUp, ThumbsDown, Send, Sparkles } from "lucide-react"
import { auth } from "@/lib/firebase"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { PlanItem } from "@/hooks/useTranslation"
import { cn } from "@/lib/utils"

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000"

async function authHeaders(): Promise<Record<string, string>> {
  const user = auth.currentUser
  if (!user) return { "Content-Type": "application/json" }
  const token = await user.getIdToken()
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` }
}

interface OutputPanelProps {
  plan: PlanItem[]
  currentToken?: string
  currentGifUrl?: string
  currentPlaybackKey?: string
  isPlaying: boolean
  onReplay: () => void
  logDocId?: string
}

type FeedbackRating = "positive" | "negative"

function FeedbackWidget({ logDocId }: { logDocId?: string }) {
  const [rating, setRating] = useState<FeedbackRating | null>(null)
  const [comment, setComment] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    setRating(null)
    setComment("")
    setSubmitted(false)
    setSubmitting(false)
  }, [logDocId])

  const handleRating = (r: FeedbackRating) => setRating((prev) => (prev === r ? null : r))

  const handleSubmit = async () => {
    if (!rating) return
    setSubmitting(true)
    try {
      const headers = await authHeaders()
      await fetch(`${API_BASE_URL}/api/feedback`, {
        method: "POST",
        headers,
        body: JSON.stringify({ rating, log_doc_id: logDocId ?? null, comment: comment.trim() || null }),
      })
      setSubmitted(true)
    } catch {
      setSubmitted(true)
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <p className="text-xs text-text-muted text-center py-1 animate-fade-in">
        Thanks for your feedback!
      </p>
    )
  }

  return (
    <div className="flex flex-col items-center gap-3 animate-fade-in">
      <p className="text-xs text-text-muted tracking-wide">Was this translation helpful?</p>
      <div className="flex gap-2">
        <button
          onClick={() => handleRating("positive")}
          className={cn(
            "flex items-center gap-1.5 px-4 py-2 rounded-[10px] text-sm font-medium border transition-all duration-200",
            rating === "positive"
              ? "border-accent-terracotta bg-accent-soft text-accent-terracotta"
              : "border-border-warm text-text-secondary hover:border-accent-terracotta hover:text-accent-terracotta hover:bg-accent-soft/40"
          )}
        >
          <ThumbsUp className="w-3.5 h-3.5" />
          Helpful
        </button>
        <button
          onClick={() => handleRating("negative")}
          className={cn(
            "flex items-center gap-1.5 px-4 py-2 rounded-[10px] text-sm font-medium border transition-all duration-200",
            rating === "negative"
              ? "border-accent-terracotta bg-accent-soft text-accent-terracotta"
              : "border-border-warm text-text-secondary hover:border-accent-terracotta hover:text-accent-terracotta hover:bg-accent-soft/40"
          )}
        >
          <ThumbsDown className="w-3.5 h-3.5" />
          Not helpful
        </button>
      </div>

      {rating && (
        <div className="w-full max-w-sm flex flex-col gap-2 animate-fade-in">
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Add a comment (optional)"
            rows={2}
            className="w-full px-3 py-2.5 text-sm rounded-[10px] bg-bg-input border border-border-soft text-text-primary placeholder:text-text-muted outline-none focus:border-accent-terracotta transition-colors resize-none"
          />
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            size="sm"
            className="self-end"
          >
            <Send className="w-3.5 h-3.5" />
            {submitting ? "Sending…" : "Submit"}
          </Button>
        </div>
      )}
    </div>
  )
}

export function OutputPanel({
  plan,
  currentToken,
  currentGifUrl,
  currentPlaybackKey,
  isPlaying,
  onReplay,
  logDocId,
}: OutputPanelProps) {
  const hasContent = plan.length > 0

  return (
    <Card className="h-full p-4 sm:p-5 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[10px] font-semibold tracking-[0.22em] uppercase text-text-muted">Playback</p>
        {isPlaying && (
          <Badge variant="accent" className="text-[0.62rem]">
            Playing
          </Badge>
        )}
      </div>

      {/* GIF player */}
      <div className="flex flex-col overflow-hidden rounded-[18px] border border-border-warm bg-[#0A0908] shadow-inner">
        <div className="relative flex aspect-[4/3] min-h-[300px] max-h-[520px] items-center justify-center bg-black">
          {currentToken && (
            <Badge variant="accent" className="absolute right-3 top-3 z-10 max-w-[160px] truncate text-[0.65rem] px-2 py-0.5">
              {currentToken}
            </Badge>
          )}

          {currentGifUrl ? (
            <img
              key={currentPlaybackKey ?? currentGifUrl}
              src={currentGifUrl}
              alt="Sign Language"
              className="h-full w-full object-contain animate-fade-in"
            />
          ) : (
            <div className="flex flex-col items-center gap-3 text-text-muted">
              <div className="flex h-16 w-16 items-center justify-center rounded-full border border-accent-terracotta/30 bg-accent-soft/20 text-accent-warm shadow-[0_0_32px_rgba(217,112,64,0.12)]">
                {hasContent ? <Sparkles className="h-6 w-6" /> : <Play className="ml-1 h-6 w-6" />}
              </div>
              <span className="text-xs text-text-muted">
                {hasContent ? "Ready to play" : "Translate something to preview a sign"}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Controls + Feedback ────────────────────────────────────────── */}
      <div className="flex flex-col items-center gap-4 pt-1">
        <Button
          variant="outline"
          onClick={onReplay}
          disabled={isPlaying || plan.length === 0}
          size="sm"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Play again
        </Button>

        <div className="divider w-full" />

        {hasContent ? (
          <FeedbackWidget logDocId={logDocId} />
        ) : null}
      </div>
    </Card>
  )
}
