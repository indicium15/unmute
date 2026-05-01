import * as React from "react"
import { cn } from "@/lib/utils"

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(
  ({ className, ...props }, ref) => (
    <textarea
      className={cn(
        "flex min-h-[120px] w-full rounded-[14px] border border-border-soft bg-bg-input px-5 py-4 font-sans text-sm text-text-primary leading-relaxed placeholder:text-text-muted focus:border-accent-terracotta focus:bg-bg-card focus:outline-none focus:ring-2 focus:ring-accent-terracotta/15 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200 resize-none",
        className
      )}
      ref={ref}
      {...props}
    />
  )
)
Textarea.displayName = "Textarea"

export { Textarea }
