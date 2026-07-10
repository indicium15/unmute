import { useState, useEffect } from "react"
import { ThumbsUp, ThumbsDown, Send } from "lucide-react"
import { auth } from "@/lib/firebase"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000"

async function authHeaders(): Promise<Record<string, string>> {
  const user = auth.currentUser
  if (!user) return { "Content-Type": "application/json" }
  const token = await user.getIdToken()
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` }
}

type FeedbackRating = "positive" | "negative"

export function FeedbackWidget({ logDocId }: { logDocId?: string }) {
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
