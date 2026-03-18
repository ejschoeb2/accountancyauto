import Image from "next/image";
import { cn } from "@/lib/utils";

interface PromptLogoProps {
  size?: number;
  className?: string;
}

export function PromptLogo({ size = 24, className }: PromptLogoProps) {
  return (
    <Image
      src="/logov9.svg"
      alt="Prompt"
      width={size}
      height={size}
      className={cn(className)}
    />
  );
}
