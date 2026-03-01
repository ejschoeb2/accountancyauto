import { Brain } from "lucide-react";

export function LoadingScreen() {
  return (
    <div className="fixed inset-0 bg-background flex items-center justify-center animate-fade-in">
      <div className="flex items-center gap-2 animate-pulse-scale">
        <Brain className="text-violet-600" size={28} />
        <span className="text-2xl font-bold tracking-tight">Prompt</span>
      </div>
    </div>
  );
}
