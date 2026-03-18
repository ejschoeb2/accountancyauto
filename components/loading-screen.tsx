import { PromptLogo } from "@/components/prompt-logo";

export function LoadingScreen() {
  return (
    <div className="fixed inset-0 bg-background flex items-center justify-center animate-fade-in">
      <div className="flex items-center gap-2 animate-pulse-scale">
        <PromptLogo size={28} className="text-violet-600" />
        <span className="text-2xl font-bold tracking-tight">Prompt</span>
      </div>
    </div>
  );
}
