import * as React from "react"
import { ButtonBase, type ButtonBaseProps } from "./button-base"

interface ButtonWithTextProps extends Omit<ButtonBaseProps, "buttonType"> {}

const ButtonWithText = React.forwardRef<HTMLButtonElement, ButtonWithTextProps>(
  ({ variant = "blue", ...props }, ref) => (
    <ButtonBase ref={ref} buttonType="text-only" variant={variant} {...props} />
  )
)
ButtonWithText.displayName = "ButtonWithText"

// Re-export the variants for backward compatibility
import { buttonBaseVariants as buttonWithTextVariants } from "./button-base"

export { ButtonWithText, buttonWithTextVariants }
