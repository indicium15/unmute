import { useState } from "react"
import { ChevronDown, ChevronRight, ThumbsUp, ThumbsDown } from "lucide-react"
import { formatTimestamp, truncate } from "./format"
import { Field } from "./Field"
import type { TranslationLog, TranscriptionLog, FeedbackLog } from "./types"

export function TranslationRow({ log }: { log: TranslationLog }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <>
      <tr
        className="border-b border-[var(--color-border-soft)] hover:bg-[var(--color-bg-cream)] cursor-pointer transition-colors"
        onClick={() => setExpanded((e) => !e)}
      >
        <td className="py-3 px-4 text-xs text-text-muted whitespace-nowrap">
          {formatTimestamp(log.timestamp)}
        </td>
        <td className="py-3 px-4 text-sm text-text-secondary max-w-[160px] truncate">
          {log.user_email ?? "—"}
        </td>
        <td className="py-3 px-4">
          <span
            className={`text-xs font-medium px-2 py-0.5 rounded-full ${
              log.query_type === "voice"
                ? "bg-[var(--color-accent-soft)] text-[var(--color-accent-terracotta)]"
                : "bg-[var(--color-bg-cream)] text-text-secondary border border-[var(--color-border-warm)]"
            }`}
          >
            {log.query_type}
          </span>
        </td>
        <td className="py-3 px-4 text-sm text-text-primary max-w-[220px]">
          {truncate(log.input_text)}
        </td>
        <td className="py-3 px-4 text-xs text-text-muted">{log.detected_language ?? "—"}</td>
        <td className="py-3 px-4 text-xs text-text-secondary">
          {(log.gemini_gloss ?? []).length} tokens
        </td>
        <td className="py-3 px-4 text-xs text-text-secondary">
          {log.render_plan_count} signs
        </td>
        <td className="py-3 px-4 text-text-muted">
          {expanded ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </td>
      </tr>

      {expanded && (
        <tr className="bg-[var(--color-bg-cream)]">
          <td colSpan={8} className="px-6 py-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-sm">
              <Field label="Full Input" value={log.input_text} />
              {log.user_id && <Field label="User ID" value={log.user_id} mono />}
              <Field
                label="Gemini Gloss"
                value={(log.gemini_gloss ?? []).join(", ") || "—"}
              />
              {(log.gemini_unmatched ?? []).length > 0 && (
                <Field
                  label="Unmatched Tokens"
                  value={(log.gemini_unmatched ?? []).join(", ")}
                  accent
                />
              )}
              {log.gemini_notes && (
                <div className="md:col-span-2">
                  <Field label="Gemini Notes" value={log.gemini_notes} />
                </div>
              )}
              <Field
                label="Output Tokens"
                value={(log.output_tokens ?? []).join(", ") || "—"}
              />
              <Field
                label="Output Sign Names"
                value={(log.output_sign_names ?? []).join(", ") || "—"}
              />
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

export function TranscriptionRow({ log }: { log: TranscriptionLog }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <>
      <tr
        className="border-b border-[var(--color-border-soft)] hover:bg-[var(--color-bg-cream)] cursor-pointer transition-colors"
        onClick={() => setExpanded((e) => !e)}
      >
        <td className="py-3 px-4 text-xs text-text-muted whitespace-nowrap">
          {formatTimestamp(log.timestamp)}
        </td>
        <td className="py-3 px-4 text-sm text-text-secondary max-w-[180px] truncate">
          {log.user_email ?? "—"}
        </td>
        <td className="py-3 px-4 text-sm text-text-primary max-w-[360px]">
          {truncate(log.transcription, 80)}
        </td>
        <td className="py-3 px-4 text-xs text-text-muted">
          {log.detected_language ?? "—"}
        </td>
        <td className="py-3 px-4 text-text-muted">
          {expanded ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </td>
      </tr>

      {expanded && (
        <tr className="bg-[var(--color-bg-cream)]">
          <td colSpan={5} className="px-6 py-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-sm">
              <Field label="Full Transcription" value={log.transcription} />
              {log.user_id && <Field label="User ID" value={log.user_id} mono />}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

export function FeedbackRow({ log }: { log: FeedbackLog }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <>
      <tr
        className="border-b border-[var(--color-border-soft)] hover:bg-[var(--color-bg-cream)] cursor-pointer transition-colors"
        onClick={() => setExpanded((e) => !e)}
      >
        <td className="py-3 px-4 text-xs text-text-muted whitespace-nowrap">
          {formatTimestamp(log.timestamp)}
        </td>
        <td className="py-3 px-4 text-sm text-text-secondary max-w-[180px] truncate">
          {log.user_email ?? "—"}
        </td>
        <td className="py-3 px-4">
          {log.rating === "positive" ? (
            <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200">
              <ThumbsUp className="w-3 h-3" /> Helpful
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-[var(--color-accent-soft)] text-[var(--color-accent-terracotta)] border border-[var(--color-accent-soft)]">
              <ThumbsDown className="w-3 h-3" /> Not helpful
            </span>
          )}
        </td>
        <td className="py-3 px-4 text-sm text-text-primary max-w-[280px]">
          {log.comment ? truncate(log.comment, 80) : <span className="text-text-muted italic">No comment</span>}
        </td>
        <td className="py-3 px-4 text-xs text-text-muted font-mono">
          {log.translation_log_id ? truncate(log.translation_log_id, 12) : "—"}
        </td>
        <td className="py-3 px-4 text-text-muted">
          {expanded ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </td>
      </tr>

      {expanded && (
        <tr className="bg-[var(--color-bg-cream)]">
          <td colSpan={6} className="px-6 py-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-sm">
              {log.comment && <Field label="Full Comment" value={log.comment} />}
              {log.user_id && <Field label="User ID" value={log.user_id} mono />}
              {log.translation_log_id && (
                <Field label="Translation Log ID" value={log.translation_log_id} mono />
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}
