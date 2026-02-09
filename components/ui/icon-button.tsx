import * as React from "react"
import { ButtonBase, type ButtonBaseProps } from "./button-base"

interface IconButtonProps extends Omit<ButtonBaseProps, "buttonType"> {}

const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ variant = "neutral", ...props }, ref) => (
    <ButtonBase ref={ref} buttonType="icon-only" variant={variant} {...props} />
  )
)
IconButton.displayName = "IconButton"

// Re-export the variants for backward compatibility
import { buttonBaseVariants as iconButtonVariants } from "./button-base"

export { IconButton, iconButtonVariants }
