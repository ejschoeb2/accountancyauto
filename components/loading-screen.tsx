import Image from "next/image";

export function LoadingScreen() {
  return (
    <div className="fixed inset-0 bg-background flex items-center justify-center animate-fade-in">
      <Image
        src="/logofini.png"
        alt="Phase Two Logo"
        width={64}
        height={64}
        className="animate-pulse-scale"
        priority
      />
    </div>
  );
}
