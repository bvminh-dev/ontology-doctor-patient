import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[#0064E0] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-[#0064E0] text-white shadow hover:bg-[#0143B5] hover:scale-[1.1] active:scale-[0.9] active:opacity-50",
        destructive:
          "bg-[#E41E3F] text-white shadow hover:bg-[#C80A28] hover:scale-[1.1] active:scale-[0.9]",
        outline:
          "border border-[rgba(10,19,23,0.12)] bg-transparent text-[rgba(28,43,51,0.5)] hover:bg-[rgba(70,90,105,0.7)] hover:text-white",
        secondary:
          "bg-[#F1F4F7] text-[#1C2B33] shadow-sm hover:bg-[#DEE3E9]",
        ghost: "hover:bg-[rgba(70,90,105,0.12)] hover:text-[#1C2B33]",
        link: "text-[#385898] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-[22px] py-[10px]",
        sm: "h-8 px-4 py-[6px] text-xs",
        lg: "h-11 px-[22px] py-[10px] text-base",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
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
      <Comp
        className={cn("rounded-[100px]", buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
