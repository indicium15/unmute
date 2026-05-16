import { cva } from "class-variance-authority"

export const badgeVariants = cva(
  "inline-flex items-center rounded-[8px] px-2.5 py-1 text-xs font-medium transition-all duration-200",
  {
    variants: {
      variant: {
        default:
          "bg-bg-input border border-border-soft text-text-secondary",
        active:
          "border border-accent-terracotta bg-accent-soft text-accent-terracotta",
        missing:
          "border border-red-300 text-red-400 line-through",
        accent:
          "bg-gradient-accent text-white font-semibold tracking-wide shadow-[0_2px_8px_rgba(97,118,247,0.3)]",
        secondary:
          "bg-bg-input text-text-muted",
        outline:
          "border border-border-warm text-text-secondary",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)
