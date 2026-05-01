import { cva } from "class-variance-authority"

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[12px] font-medium transition-all duration-200 cursor-pointer disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-gradient-accent text-white shadow-[0_4px_20px_rgba(217,112,64,0.35)] hover:shadow-[0_6px_28px_rgba(217,112,64,0.45)] hover:-translate-y-px active:translate-y-0 active:scale-[0.98]",
        destructive:
          "bg-red-600 text-white hover:bg-red-500",
        outline:
          "border border-border-warm bg-transparent text-text-secondary hover:border-accent-terracotta hover:text-accent-terracotta hover:bg-accent-soft/30",
        secondary:
          "bg-bg-input text-text-secondary border border-border-soft hover:bg-bg-cream hover:text-text-primary",
        ghost:
          "hover:bg-bg-input hover:text-text-primary text-text-secondary",
        link:
          "text-accent-terracotta underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-5 py-2.5 text-sm",
        sm: "h-9 rounded-[10px] px-4 text-xs",
        lg: "h-12 rounded-[14px] px-7 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)
