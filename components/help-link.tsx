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
      <HelpCircle className="size-5 text-muted-foreground hover:text-primary transition-colors" />
    </Link>
  );
}
