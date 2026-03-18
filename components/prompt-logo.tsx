import Image from "next/image";
import { cn } from "@/lib/utils";

interface PromptLogoProps {
  size?: number;
  className?: string;
}

// logov9.svg native aspect ratio: 22.5 x 18.5
const ASPECT = 18.5 / 22.5;

export function PromptLogo({ size = 24, className }: PromptLogoProps) {
  return (
    <Image
      src="/logov9.svg"
      alt="Prompt"
      width={size}
      height={Math.round(size * ASPECT)}
      className={cn(className)}
    />
  );
}
