"use client";

import Link from "next/link";
import { Settings } from "lucide-react";
import { usePathname } from "next/navigation";

export function SettingsLink() {
  const pathname = usePathname();
  const isActive = pathname === "/settings";

  return (
    <Link
      href="/settings"
      className="p-2"
      title="Settings"
    >
      <Settings className={`size-5 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
    </Link>
  );
}
