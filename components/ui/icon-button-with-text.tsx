import * as React from "react"
import { ButtonBase, type ButtonBaseProps } from "./button-base"

interface IconButtonWithTextProps extends Omit<ButtonBaseProps, "buttonType"> {}

const IconButtonWithText = React.forwardRef<HTMLButtonElement, IconButtonWithTextProps>(
  ({ variant = "blue", ...props }, ref) => (
    <ButtonBase ref={ref} buttonType="icon-text" variant={variant} {...props} />
  )
)
IconButtonWithText.displayName = "IconButtonWithText"

// Re-export the variants for backward compatibility
import { buttonBaseVariants as iconButtonWithTextVariants } from "./button-base"

export { IconButtonWithText, iconButtonWithTextVariants }
