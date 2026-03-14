export function LoadingScreen() {
  return (
    <div className="fixed inset-0 bg-background flex items-center justify-center animate-fade-in">
      <div className="flex items-center gap-2 animate-pulse-scale">
        <img src="/promptlogov1.svg" alt="Prompt" width={28} height={28} />
        <span className="text-2xl font-bold tracking-tight">Prompt</span>
      </div>
    </div>
  );
}
