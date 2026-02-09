import * as React from "react"
import { Check, Minus } from "lucide-react"
import { cn } from "@/lib/utils"

interface CheckButtonProps {
  checked?: boolean | "indeterminate"
  onCheckedChange?: (checked: boolean) => void
  disabled?: boolean
  className?: string
  "aria-label"?: string
}

const CheckButton = React.forwardRef<HTMLButtonElement, CheckButtonProps>(
  ({ checked = false, onCheckedChange, disabled, className, "aria-label": ariaLabel }, ref) => {
    const isChecked = checked === true
    const isIndeterminate = checked === "indeterminate"

    return (
      <button
        ref={ref}
        type="button"
        onClick={() => onCheckedChange?.(!isChecked)}
        disabled={disabled}
        className={cn(
          "size-8 rounded-lg flex items-center justify-center transition-all duration-200 active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed",
          isChecked || isIndeterminate
            ? "bg-blue-500/10 hover:bg-blue-500/20"
            : "bg-status-neutral/10 hover:bg-status-neutral/20",
          className
        )}
        aria-label={ariaLabel}
        aria-checked={isIndeterminate ? "mixed" : isChecked}
        role="checkbox"
      >
        {isIndeterminate ? (
          <Minus className="size-5 text-blue-500" />
        ) : isChecked ? (
          <Check className="size-5 text-blue-500" />
        ) : null}
      </button>
    )
  }
)

CheckButton.displayName = "CheckButton"

export { CheckButton }
export type { CheckButtonProps }
