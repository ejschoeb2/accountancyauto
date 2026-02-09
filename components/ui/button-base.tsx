import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonBaseVariants = cva(
  "inline-flex items-center justify-center rounded-lg transition-all duration-200 active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none shrink-0 outline-none focus-visible:ring-ring/50 focus-visible:ring-[3px]",
  {
    variants: {
      variant: {
        blue: "bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 hover:text-blue-500",
        destructive: "bg-destructive/10 hover:bg-destructive/20 text-destructive hover:text-destructive",
        amber: "bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 hover:text-amber-700",
        neutral: "bg-neutral/10 hover:bg-neutral/20 text-foreground hover:text-foreground",
        green: "bg-green-500/10 hover:bg-green-500/20 text-green-600 hover:text-green-700",
        muted: "bg-status-neutral/10 hover:bg-status-neutral/20 text-status-neutral hover:text-status-neutral",
        info: "bg-status-info/10 hover:bg-status-info/20 text-status-info hover:text-status-info",
        sky: "bg-sky-500/10 hover:bg-sky-500/20 text-sky-500 hover:text-sky-500",
        violet: "bg-violet-500/10 hover:bg-violet-500/20 text-violet-500 hover:text-violet-500",
        ghost: "hover:shadow-md",
        red: "bg-status-danger/10 hover:bg-status-danger/20 text-status-danger hover:text-status-danger",
      },
      buttonType: {
        "icon-only": "h-9 w-9",
        "icon-text": "gap-2 px-4 py-2 h-10 text-sm font-medium",
        "text-only": "px-4 py-2 h-10 text-sm font-medium",
      },
      isSelected: {
        true: "",
        false: "",
      },
    },
    compoundVariants: [
      // Blue selected states
      {
        variant: "blue",
        isSelected: true,
        className: "bg-blue-500/30 text-blue-600 hover:bg-blue-500/30",
      },
      // Destructive selected states
      {
        variant: "destructive",
        isSelected: true,
        className: "bg-destructive/30 text-destructive hover:bg-destructive/30",
      },
      // Amber selected states
      {
        variant: "amber",
        isSelected: true,
        className: "bg-amber-500/30 text-amber-700 hover:bg-amber-500/30",
      },
      // Neutral selected states
      {
        variant: "neutral",
        isSelected: true,
        className: "bg-neutral/30 text-foreground hover:bg-neutral/30",
      },
      // Green selected states
      {
        variant: "green",
        isSelected: true,
        className: "bg-green-500/30 text-green-700 hover:bg-green-500/30",
      },
      // Muted selected states (switches to blue when selected)
      {
        variant: "muted",
        isSelected: true,
        className: "bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 hover:text-blue-500",
      },
      // Info selected states
      {
        variant: "info",
        isSelected: true,
        className: "bg-status-info/30 text-status-info hover:bg-status-info/30",
      },
      // Sky selected states
      {
        variant: "sky",
        isSelected: true,
        className: "bg-sky-500/30 text-sky-600 hover:bg-sky-500/30",
      },
      // Violet selected states
      {
        variant: "violet",
        isSelected: true,
        className: "bg-violet-500/30 text-violet-600 hover:bg-violet-500/30",
      },
      // Red selected states
      {
        variant: "red",
        isSelected: true,
        className: "bg-status-danger/30 text-status-danger hover:bg-status-danger/30",
      },
      // Ghost selected states
      {
        variant: "ghost",
        isSelected: true,
        buttonType: "icon-only",
        className: "bg-foreground/10 hover:bg-foreground/10",
      },
      {
        variant: "ghost",
        isSelected: true,
        buttonType: "icon-text",
        className: "border-2 border-foreground",
      },
      {
        variant: "ghost",
        isSelected: true,
        buttonType: "text-only",
        className: "border-2 border-foreground",
      },
    ],
    defaultVariants: {
      variant: "blue",
      buttonType: "text-only",
      isSelected: false,
    },
  }
)

interface ButtonBaseProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonBaseVariants> {}

const ButtonBase = React.forwardRef<HTMLButtonElement, ButtonBaseProps>(
  ({ className, variant, buttonType, isSelected, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonBaseVariants({ variant, buttonType, isSelected, className }))}
      {...props}
    />
  )
)
ButtonBase.displayName = "ButtonBase"

export { ButtonBase, buttonBaseVariants }
export type { ButtonBaseProps }
