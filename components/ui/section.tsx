import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const sectionVariants = cva(
  "rounded-lg border bg-card transition-all duration-300",
  {
    variants: {
      padding: {
        none: "",
        sm: "p-4",
        md: "p-6",
        lg: "p-8",
      },
      hover: {
        none: "",
        lift: "hover:shadow-lg",
        subtle: "hover:shadow-md",
        border: "hover:border-primary/20",
        all: "hover:shadow-lg hover:border-primary/20",
      },
      clickable: {
        true: "cursor-pointer",
        false: "",
      },
    },
    compoundVariants: [
      {
        hover: "lift",
        clickable: true,
        className: "active:scale-[0.99]",
      },
      {
        hover: "all",
        clickable: true,
        className: "active:scale-[0.99]",
      },
    ],
    defaultVariants: {
      padding: "md",
      hover: "none",
      clickable: false,
    },
  }
)

interface SectionProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof sectionVariants> {}

const Section = React.forwardRef<HTMLDivElement, SectionProps>(
  ({ className, padding, hover, clickable, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(sectionVariants({ padding, hover, clickable, className }))}
        {...props}
      />
    )
  }
)
Section.displayName = "Section"

export { Section, sectionVariants }
