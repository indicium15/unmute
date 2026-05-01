import * as React from "react"
import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      className={cn(
        "flex h-11 w-full rounded-[12px] border border-border-soft bg-bg-input px-4 py-3 font-sans text-sm text-text-primary placeholder:text-text-muted focus:border-accent-terracotta focus:outline-none focus:ring-2 focus:ring-accent-terracotta/15 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200",
        className
      )}
      ref={ref}
      {...props}
    />
  )
)
Input.displayName = "Input"

export { Input }
