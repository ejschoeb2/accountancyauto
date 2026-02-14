import * as React from "react"
import { Check, Minus } from "lucide-react"
import { cn } from "@/lib/utils"

interface CheckButtonProps {
  checked?: boolean | "indeterminate"
  onCheckedChange?: (checked: boolean) => void
  disabled?: boolean
  className?: string
  "aria-label"?: string
  variant?: "default" | "success"
}

const CheckButton = React.forwardRef<HTMLButtonElement, CheckButtonProps>(
  ({ checked = false, onCheckedChange, disabled, className, "aria-label": ariaLabel, variant = "default" }, ref) => {
    const isChecked = checked === true
    const isIndeterminate = checked === "indeterminate"

    const colors = variant === "success"
      ? {
          bg: isChecked || isIndeterminate ? "bg-green-500/10 hover:bg-green-500/20" : "bg-status-neutral/10 hover:bg-status-neutral/20",
          icon: "text-green-600"
        }
      : {
          bg: isChecked || isIndeterminate ? "bg-blue-500/10 hover:bg-blue-500/20" : "bg-status-neutral/10 hover:bg-status-neutral/20",
          icon: "text-blue-500"
        }

    return (
      <button
        ref={ref}
        type="button"
        onClick={() => onCheckedChange?.(!isChecked)}
        disabled={disabled}
        className={cn(
          "size-8 rounded-lg flex items-center justify-center transition-all duration-200 active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed",
          colors.bg,
          className
        )}
        aria-label={ariaLabel}
        aria-checked={isIndeterminate ? "mixed" : isChecked}
        role="checkbox"
      >
        {isIndeterminate ? (
          <Minus className={cn("size-5", colors.icon)} />
        ) : isChecked ? (
          <Check className={cn("size-5", colors.icon)} />
        ) : null}
      </button>
    )
  }
)

CheckButton.displayName = "CheckButton"

export { CheckButton }
export type { CheckButtonProps }
