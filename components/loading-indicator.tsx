import Image from "next/image";

export function LoadingIndicator({ size = 24 }: { size?: number }) {
  return (
    <div className="flex items-center justify-center">
      <Image
        src="/logofini.png"
        alt="Loading"
        width={size}
        height={size}
        className="animate-pulse-scale"
      />
    </div>
  );
}
