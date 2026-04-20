import * as React from "react"
import { cn } from "@/lib/utils"

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[100px] w-full rounded-lg border border-ink-5 bg-white px-3.5 py-2.5",
          "text-[0.9375rem] text-ink placeholder:text-ink-4 leading-relaxed",
          "transition-all duration-150 resize-y",
          "focus-visible:outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/10",
          "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-canvas",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Textarea.displayName = "Textarea"

export { Textarea }
