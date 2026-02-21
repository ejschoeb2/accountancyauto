"use client";

import Link from "next/link";
import { Settings } from "lucide-react";
import { usePathname } from "next/navigation";

interface SettingsLinkProps {
  orgRole?: string;
}

export function SettingsLink({ orgRole = "member" }: SettingsLinkProps) {
  const pathname = usePathname();
  const isActive = pathname === "/settings";

  // Members do not have access to settings
  if (orgRole !== "admin") {
    return null;
  }

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
