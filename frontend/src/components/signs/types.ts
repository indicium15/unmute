export interface SignVariant {
  sign_name: string
  variant_label: string | null
  gif_url: string
}

export interface SignUnit {
  step: string
  image_url: string
}

export interface SignDetail {
  token: string
  sign_name: string
  gif_url: string
  tags: string[]
  variants?: SignVariant[]
  description?: string
  visual_guide?: string
  translation_equivalents?: string
  parameters?: Record<string, Record<string, string>>
  units?: SignUnit[]
}

export function formatSignLabel(token: string): string {
  return token
    .replace(/[_-]+/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (l) => l.toUpperCase())
}
