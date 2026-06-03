export interface TagStyle {
  color: string
  bg: string
  border?: string
}

// Fallback palette used when a tag isn't in tag_config.json
const PALETTE: TagStyle[] = [
  { color: "#ffffff", bg: "#6176f7" },
  { color: "#ffffff", bg: "#14b8a6" },
  { color: "#ffffff", bg: "#f59e0b" },
  { color: "#ffffff", bg: "#a855f7" },
  { color: "#ffffff", bg: "#ec4899" },
  { color: "#ffffff", bg: "#3b82f6" },
  { color: "#ffffff", bg: "#f97316" },
  { color: "#ffffff", bg: "#10b981" },
]

function hashIndex(str: string, len: number): number {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0
  return h % len
}

let _tagConfig: Record<string, TagStyle> = {}

export function setTagConfig(config: Record<string, TagStyle>) {
  _tagConfig = config
}

export function getTagStyle(tag: string): TagStyle {
  if (_tagConfig[tag]) return _tagConfig[tag]
  return PALETTE[hashIndex(tag, PALETTE.length)]
}
