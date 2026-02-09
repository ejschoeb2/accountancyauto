import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-display font-bold transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive active:scale-[0.97]",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-xs hover:shadow-md",
        destructive:
          "bg-destructive text-white shadow-xs hover:shadow-md focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        outline:
          "border bg-background shadow-xs hover:border-foreground/20 hover:shadow-md dark:bg-input/30 dark:border-input",
        secondary:
          "bg-secondary text-secondary-foreground shadow-xs hover:shadow-md",
        ghost:
          "hover:shadow-md",
        link: "text-primary underline-offset-4 hover:underline",
        blue: "bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 hover:text-blue-500 shadow-xs",
        red: "bg-red-500/10 hover:bg-red-500/20 text-red-600 hover:text-red-700 shadow-xs",
        amber: "bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 hover:text-amber-700 shadow-xs",
        green: "bg-green-500/10 hover:bg-green-500/20 text-green-600 hover:text-green-700 shadow-xs",
        neutral: "bg-neutral/10 hover:bg-neutral/20 text-foreground hover:text-foreground shadow-xs",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        xs: "h-6 gap-1 rounded-md px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-9",
        "icon-xs": "size-6 rounded-md [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
      isSelected: {
        true: "",
        false: "",
      },
    },
    compoundVariants: [
      {
        variant: "blue",
        isSelected: true,
        className: "bg-blue-500/30 text-blue-600 hover:bg-blue-500/30",
      },
      {
        variant: "red",
        isSelected: true,
        className: "bg-red-500/30 text-red-700 hover:bg-red-500/30",
      },
      {
        variant: "destructive",
        isSelected: true,
        className: "bg-destructive/30 text-destructive hover:bg-destructive/30",
      },
      {
        variant: "amber",
        isSelected: true,
        className: "bg-amber-500/30 text-amber-700 hover:bg-amber-500/30",
      },
      {
        variant: "neutral",
        isSelected: true,
        className: "bg-neutral/30 text-foreground hover:bg-neutral/30",
      },
      {
        variant: "green",
        isSelected: true,
        className: "bg-green-500/30 text-green-700 hover:bg-green-500/30",
      },
    ],
    defaultVariants: {
      variant: "default",
      size: "default",
      isSelected: false,
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  isSelected = false,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, isSelected, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
