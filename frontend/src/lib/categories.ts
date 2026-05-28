export interface CategoryMeta {
  color: string
  difficulty: "Beginner" | "Intermediate"
  description: string
  usage: string[]
}

export const CATEGORIES: Record<string, CategoryMeta> = {
  "Greetings & Basics": {
    color: "#6176f7",
    difficulty: "Beginner",
    description: "A common sign used in everyday greetings and basic communication in Singapore Sign Language.",
    usage: [
      "Used when greeting or acknowledging someone",
      "Can be used in both formal and informal settings",
      "Often combined with facial expressions for added meaning",
    ],
  },
  "Feelings": {
    color: "#f59e0b",
    difficulty: "Beginner",
    description: "An expressive sign in Singapore Sign Language used to convey emotions and feelings in conversation.",
    usage: [
      "Used to express personal emotions",
      "Can be intensified with facial expressions",
      "Commonly used in everyday emotional conversations",
    ],
  },
  "Family": {
    color: "#14b8a6",
    difficulty: "Intermediate",
    description: "A sign used to describe family relationships and members in Singapore Sign Language.",
    usage: [
      "Used when referring to family members",
      "Often used when introducing relatives",
      "Can be combined with other signs for context",
    ],
  },
  "Questions": {
    color: "#a855f7",
    difficulty: "Beginner",
    description: "A question sign in Singapore Sign Language used to inquire and seek information.",
    usage: [
      "Used to ask for information or clarification",
      "Typically paired with a questioning facial expression",
      "Can be used at the start or end of a signed sentence",
    ],
  },
  "Numbers": {
    color: "#3b82f6",
    difficulty: "Intermediate",
    description: "A numerical sign in Singapore Sign Language used for counting and expressing quantities.",
    usage: [
      "Used when counting or stating quantities",
      "Can represent both cardinal and ordinal numbers",
      "Often used in combination with other signs",
    ],
  },
  "Colors": {
    color: "#ec4899",
    difficulty: "Beginner",
    description: "A color sign in Singapore Sign Language used to describe and identify colors.",
    usage: [
      "Used when describing the color of an object",
      "Can be paired with the object sign for clarity",
      "Useful in everyday descriptive conversations",
    ],
  },
  "Food & Drink": {
    color: "#f97316",
    difficulty: "Beginner",
    description: "A sign used to communicate about food and beverages in Singapore Sign Language.",
    usage: [
      "Used when referring to specific food or drinks",
      "Helpful when ordering or discussing meals",
      "Can be combined with quantity signs",
    ],
  },
}

const FALLBACK: CategoryMeta = {
  color: "#6b7280",
  difficulty: "Beginner",
  description: "A sign in Singapore Sign Language.",
  usage: ["Used in everyday Singapore Sign Language communication"],
}

export function getCategoryMeta(category?: string): CategoryMeta {
  if (!category) return FALLBACK
  return CATEGORIES[category] ?? FALLBACK
}
