"use client"

import * as React from "react"
import { Check } from "lucide-react"
import { Checkbox as CheckboxPrimitive } from "radix-ui"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const checkboxVariants = cva(
  "peer shrink-0 rounded-md border-2 transition-all duration-200 outline-none active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:ring-ring/50 focus-visible:ring-[3px]",
  {
    variants: {
      variant: {
        blue: "border-blue-500/20 bg-blue-500/5 hover:bg-blue-500/10 data-[state=checked]:bg-blue-500/30 data-[state=checked]:border-blue-500/30 data-[state=checked]:text-blue-500",
        green: "border-green-500/20 bg-green-500/5 hover:bg-green-500/10 data-[state=checked]:bg-green-500/30 data-[state=checked]:border-green-500/30 data-[state=checked]:text-green-600",
        amber: "border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10 data-[state=checked]:bg-amber-500/30 data-[state=checked]:border-amber-500/30 data-[state=checked]:text-amber-600",
        destructive: "border-destructive/20 bg-destructive/5 hover:bg-destructive/10 data-[state=checked]:bg-destructive/30 data-[state=checked]:border-destructive/30 data-[state=checked]:text-destructive",
        neutral: "border-neutral/20 bg-neutral/5 hover:bg-neutral/10 data-[state=checked]:bg-neutral/30 data-[state=checked]:border-neutral/30 data-[state=checked]:text-foreground",
        violet: "border-violet-500/20 bg-violet-500/5 hover:bg-violet-500/10 data-[state=checked]:bg-violet-500/30 data-[state=checked]:border-violet-500/30 data-[state=checked]:text-violet-500",
        sky: "border-sky-500/20 bg-sky-500/5 hover:bg-sky-500/10 data-[state=checked]:bg-sky-500/30 data-[state=checked]:border-sky-500/30 data-[state=checked]:text-sky-500",
      },
      size: {
        sm: "size-4",
        md: "size-5",
        lg: "size-6",
      },
    },
    defaultVariants: {
      variant: "blue",
      size: "md",
    },
  }
)

interface CheckboxProps
  extends React.ComponentProps<typeof CheckboxPrimitive.Root>,
    VariantProps<typeof checkboxVariants> {}

function Checkbox({
  className,
  variant,
  size,
  ...props
}: CheckboxProps) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(checkboxVariants({ variant, size, className }))}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="grid place-content-center text-current transition-none"
      >
        <Check className={cn(
          "stroke-[3px]",
          size === "sm" && "size-3",
          size === "md" && "size-4",
          size === "lg" && "size-5"
        )} />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox, checkboxVariants }
export type { CheckboxProps }
