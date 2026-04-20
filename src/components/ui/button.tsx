import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-bold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 cursor-pointer",
  {
    variants: {
      variant: {
        default:     "bg-brand text-white hover:bg-brand-dark shadow-sm active:scale-[0.98]",
        destructive: "bg-danger-bg text-danger border border-danger hover:bg-red-100",
        outline:     "border-2 border-brand text-brand bg-transparent hover:bg-brand-ghost",
        secondary:   "bg-accent2-soft text-brand-dark hover:bg-accent2",
        ghost:       "text-ink-3 hover:bg-ink-6 hover:text-ink",
        link:        "text-brand underline-offset-4 hover:underline p-0 h-auto",
        white:       "bg-white text-brand-dark border border-ink-6 hover:bg-ink-6 shadow-xs",
      },
      size: {
        default: "h-10 px-5 py-2",
        sm:      "h-8 px-3 text-xs",
        lg:      "h-12 px-7 text-base",
        xl:      "h-14 px-8 text-base",
        icon:    "h-10 w-10 p-0",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
