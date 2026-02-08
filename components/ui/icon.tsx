import { cn } from "@/lib/utils";

type IconSize = "sm" | "md" | "lg" | "xl";

const SIZE_MAP: Record<IconSize, string> = {
  sm: "text-[16px]",
  md: "text-[20px]",
  lg: "text-[24px]",
  xl: "text-[32px]",
};

interface IconProps {
  name: string;
  size?: IconSize;
  className?: string;
  filled?: boolean;
  style?: React.CSSProperties;
}

export function Icon({ name, size = "md", className, filled = false, style }: IconProps) {
  return (
    <span
      className={cn(
        "material-symbols-outlined leading-none inline-flex items-center justify-center shrink-0 select-none",
        SIZE_MAP[size],
        filled && "font-variation-settings-fill",
        className
      )}
      style={
        filled
          ? { fontVariationSettings: "'FILL' 1", ...style }
          : style
      }
      aria-hidden="true"
    >
      {name}
    </span>
  );
}
