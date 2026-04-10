import { useState, useEffect } from "react"
import { RefreshCw, Play, ThumbsUp, ThumbsDown, Send } from "lucide-react"
import { auth } from "@/lib/firebase"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { AvatarViewer } from "@/components/AvatarViewer"
import type { PlanItem } from "@/hooks/useTranslation"
import type { AvatarController } from "@/lib/avatar-controller"

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
  isPlaying: boolean
  onReplay: () => void
  onAvatarReady: (controller: AvatarController) => void
  logDocId?: string
}

type FeedbackRating = "positive" | "negative"

function FeedbackWidget({ logDocId }: { logDocId?: string }) {
  const [rating, setRating] = useState<FeedbackRating | null>(null)
  const [comment, setComment] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Reset whenever a new translation comes in
  useEffect(() => {
    setRating(null)
    setComment("")
    setSubmitted(false)
    setSubmitting(false)
  }, [logDocId])

  const handleRating = (r: FeedbackRating) => {
    // Toggle off if clicking the same one again
    setRating((prev) => (prev === r ? null : r))
  }

  const handleSubmit = async () => {
    if (!rating) return
    setSubmitting(true)
    try {
      const headers = await authHeaders()
      await fetch(`${API_BASE_URL}/api/feedback`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          rating,
          log_doc_id: logDocId ?? null,
          comment: comment.trim() || null,
        }),
      })
      setSubmitted(true)
    } catch {
      // Silently fail — feedback is best-effort
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
          className={`flex items-center gap-1.5 px-4 py-2 rounded-[12px] text-sm font-medium border transition-all ${
            rating === "positive"
              ? "bg-[var(--color-accent-soft)] border-[var(--color-accent-terracotta)] text-[var(--color-accent-terracotta)]"
              : "border-[var(--color-border-warm)] text-text-secondary hover:border-[var(--color-accent-terracotta)] hover:text-[var(--color-accent-terracotta)]"
          }`}
        >
          <ThumbsUp className="w-3.5 h-3.5" />
          Helpful
        </button>

        <button
          onClick={() => handleRating("negative")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-[12px] text-sm font-medium border transition-all ${
            rating === "negative"
              ? "bg-[var(--color-accent-soft)] border-[var(--color-accent-terracotta)] text-[var(--color-accent-terracotta)]"
              : "border-[var(--color-border-warm)] text-text-secondary hover:border-[var(--color-accent-terracotta)] hover:text-[var(--color-accent-terracotta)]"
          }`}
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
            className="w-full px-3 py-2 text-sm rounded-[12px] bg-[var(--color-bg-input)] border border-[var(--color-border-warm)] text-text-primary placeholder:text-text-light outline-none focus:border-[var(--color-accent-terracotta)] resize-none transition-colors"
          />
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="self-end flex items-center gap-1.5 px-4 py-2 rounded-[12px] bg-[var(--color-accent-terracotta)] text-white text-sm font-medium hover:bg-[var(--color-accent-warm)] disabled:opacity-60 transition-colors"
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
  isPlaying,
  onReplay,
  onAvatarReady,
  logDocId,
}: OutputPanelProps) {
  const hasContent = plan.length > 0

  return (
    <Card className="p-8 flex flex-col gap-5 min-h-[600px]">
      {hasContent ? (
        <div className="flex flex-col gap-5 flex-1 animate-fade-in-up">
          {/* Players Grid - Vertical Stack */}
          <div className="flex flex-col gap-5 flex-1">
            {/* GIF Player - Top */}
            <div className="flex-1 min-h-0 flex flex-col rounded-[20px] border border-border-soft bg-bg-cream overflow-hidden">
              <div className="px-4 py-3 border-b border-border-soft bg-bg-card flex items-center justify-between">
                <span className="text-xs font-semibold tracking-[0.08em] uppercase text-text-muted">
                  Reference
                </span>
                {currentToken && (
                  <Badge variant="accent" className="text-[0.65rem] px-2.5 py-1">
                    {currentToken}
                  </Badge>
                )}
              </div>
              <div className="flex-1 flex items-center justify-center bg-bg-input relative">
                {currentGifUrl ? (
                  <img
                    src={currentGifUrl}
                    alt="Sign Language"
                    className="max-h-full max-w-full object-contain"
                    style={{ maxHeight: "400px", maxWidth: "400px" }}
                  />
                ) : (
                  <div className="flex flex-col items-center gap-2.5 text-text-light">
                    <Play className="w-11 h-11 opacity-40" />
                    <span className="text-sm">Ready when you are</span>
                  </div>
                )}
              </div>
            </div>

            {/* 3D Avatar - Bottom */}
            <div className="flex-1 min-h-[300px] flex flex-col rounded-[20px] border border-border-soft bg-bg-cream overflow-hidden">
              <div className="px-4 py-3 border-b border-border-soft bg-bg-card flex items-center justify-between">
                <span className="text-xs font-semibold tracking-[0.08em] uppercase text-text-muted">
                  Avatar
                </span>
                <Badge variant="accent" className="text-[0.65rem] px-2.5 py-1">
                  Live
                </Badge>
              </div>
              <AvatarViewer onReady={onAvatarReady} />
            </div>
          </div>

          {/* Controls + Feedback */}
          <div className="flex flex-col items-center gap-4 pt-5">
            <Button
              variant="outline"
              onClick={onReplay}
              disabled={isPlaying || plan.length === 0}
            >
              <RefreshCw className="w-[18px] h-[18px]" />
              Play again
            </Button>

            {/* Divider */}
            <div className="w-full h-px bg-[var(--color-border-soft)]" />

            <FeedbackWidget logDocId={logDocId} />
          </div>
        </div>
      ) : (
        /* Empty State */
        <div className="flex-1 flex flex-col items-center justify-center text-text-light">
          <Play className="w-16 h-16 opacity-30 mb-4" />
          <p className="text-sm">Enter text or use voice input to see the translation</p>
        </div>
      )}
    </Card>
  )
}
