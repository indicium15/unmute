export interface LearningSign {
  token: string
  sign_name: string
  gif_url: string
}

export interface LessonSignVariant {
  sign_name: string | null
  variant_label: string | null
  gif_url: string
}

export interface LessonSignUnit {
  step: string | null
  image_url: string
}

export interface LessonSign extends LearningSign {
  description?: string | null
  visual_guide?: string | null
  translation_equivalents?: string | null
  parameters?: Record<string, Record<string, string>>
  units?: LessonSignUnit[]
  variants?: LessonSignVariant[]
}

export interface LessonSummary {
  lesson_id: string
  lesson_name: string
  description: string
  emoji: string
  sign_count: number
  difficulty: string | null
  tags: string[]
}

export interface LessonDetail {
  lesson_id: string
  lesson_name: string
  description: string
  emoji: string
  difficulty: string | null
  tags: string[]
  signs: LessonSign[]
}

export interface LessonProgress {
  lesson_id: string
  signs_viewed: string[]
  completed: boolean
  completed_at: string | null
  quiz_attempts: number
  quiz_best_score: number | null
  quiz_best_total: number | null
  last_quiz_score: number | null
  last_quiz_total: number | null
  last_attempted_at: string | null
  created_at: string | null
  updated_at: string | null
}
