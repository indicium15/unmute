export function formatSignLabel(token: string) {
  return token
    .replace(/[_-]+/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

export function shuffle<T>(arr: T[]): T[] {
  const out = [...arr]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

// The Figma design labels lesson difficulty tiers "Basic" instead of "Beginner" —
// map for display only; grouping/filtering still keys off the real `difficulty` value
// so existing lesson JSON and tag_config.json (also consumed by DictionaryPage) stay untouched.
const DIFFICULTY_TAB_LABELS: Record<string, string> = {
  Beginner: "Basic",
}

export function difficultyTabLabel(difficulty: string | null | undefined): string {
  if (!difficulty) return "Other"
  return DIFFICULTY_TAB_LABELS[difficulty] ?? difficulty
}
