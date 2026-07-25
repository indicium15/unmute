export type AdminTab = "dashboard" | "usage" | "users" | "admins" | "logs"
export type LogTab = "translation" | "transcription" | "feedback"

export interface TranslationLog {
  id: string
  // Historical records only - translation_logs no longer stores who made the
  // request (the translate page doesn't require login).
  user_id?: string
  user_email?: string | null
  timestamp: string
  query_type: "text" | "voice"
  input_text: string
  detected_language: string | null
  gemini_gloss: string[]
  gemini_unmatched: string[]
  gemini_notes: string | null
  output_tokens: string[]
  output_sign_names: string[]
  render_plan_count: number
}

export interface TranscriptionLog {
  id: string
  // Historical records only - transcription_logs no longer stores who made
  // the request (the translate page doesn't require login).
  user_id?: string
  user_email?: string | null
  timestamp: string
  transcription: string
  detected_language: string | null
}

export interface FeedbackLog {
  id: string
  // Optional - feedback can now be submitted anonymously since the translate
  // page is accessible without login.
  user_id?: string
  user_email?: string | null
  timestamp: string
  rating: "positive" | "negative"
  translation_log_id: string | null
  comment: string | null
}

export interface DashboardStats {
  total_users: number
  queries_last_30_days: number
  active_users_30d: number
  queries_by_day: { date: string; count: number }[]
}

export interface UsageDay {
  date: string
  input_tokens: number
  output_tokens: number
  total_tokens: number
  cost_usd: number
}

export interface EndpointUsage {
  input_tokens: number
  output_tokens: number
  total_tokens: number
  cost_usd: number
}

export interface TokenUsageStats {
  total_input_tokens: number
  total_output_tokens: number
  total_tokens: number
  total_cost_usd: number
  by_endpoint: Record<string, EndpointUsage>
  usage_by_day: UsageDay[]
}

export interface UserRecord {
  id: string
  uid: string
  email: string | null
  status: "pending" | "approved" | "revoked"
  registered_at: string
  approved_at?: string
  approved_by?: string
  is_admin?: boolean
}
