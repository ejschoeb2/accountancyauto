"use client"

import * as React from "react"
import { Check } from "lucide-react"
import { Checkbox as CheckboxPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

function Checkbox({
  className,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "peer bg-muted/20 border-input dark:bg-input/30 data-[state=checked]:bg-primary/10 data-[state=checked]:text-primary dark:data-[state=checked]:bg-primary/10 data-[state=checked]:border-primary/20 focus-visible:border-primary focus-visible:ring-0 aria-invalid:border-destructive size-6 shrink-0 rounded-lg border shadow-xs transition-all outline-none disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="grid place-content-center text-current transition-none"
      >
        <Check className="size-5" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }
