"use client";

import { useState, useCallback } from "react";
import { HelpCircle } from "lucide-react";
import { GuidesOverlay } from "@/components/guides-overlay";

export function HelpLink() {
  const [open, setOpen] = useState(false);
  const handleClose = useCallback(() => setOpen(false), []);

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        className="p-2"
        title="Help"
      >
        <HelpCircle className="size-5 text-muted-foreground/50 transition-opacity duration-150 hover:opacity-80" />
      </button>
      <GuidesOverlay open={open} onClose={handleClose} />
    </>
  );
}
