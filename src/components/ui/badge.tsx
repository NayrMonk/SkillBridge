import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold transition-colors",
  {
    variants: {
      variant: {
        default:    "bg-brand-ghost text-brand-dark border border-brand/30",
        secondary:  "bg-ink-6 text-ink-3",
        outline:    "border border-ink-5 text-ink-3",
        verified:   "bg-success-bg text-success border border-success",
        active:     "bg-brand-ghost text-brand-dark border border-brand/30",
        hot:        "bg-[#FF4500] text-white",
        featured:   "bg-gradient-to-r from-amber-400 to-red-400 text-white",
        pending:    "bg-warn-bg text-warn border border-warn/50",
        hired:      "bg-success-bg text-success border border-success/50",
        rejected:   "bg-danger-bg text-danger border border-danger/50",
        open:       "bg-info-bg text-info border border-info/30",
        completed:  "bg-success-bg text-success border border-success/50",
        destructive:"bg-danger-bg text-danger",
        in_progress:"bg-brand-ghost text-brand-dark border border-brand/30",
      },
    },
    defaultVariants: { variant: "default" },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
