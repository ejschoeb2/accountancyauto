"use client";

import Link from "next/link";
import { HelpCircle } from "lucide-react";

export function HelpLink() {
  return (
    <Link
      href="/help"
      className="p-2"
      title="Help"
      target="_blank"
    >
      <HelpCircle className="size-5 text-muted-foreground/50 transition-opacity duration-150 hover:opacity-80" />
    </Link>
  );
}
