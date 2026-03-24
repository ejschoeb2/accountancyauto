"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, HelpCircle, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_ITEMS, ADMIN_ITEM } from "@/components/nav-links";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

interface MobileNavProps {
  isSuperAdmin?: boolean;
  orgRole?: string;
}

export function MobileNav({ isSuperAdmin }: MobileNavProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const items = isSuperAdmin ? [...NAV_ITEMS, ADMIN_ITEM] : NAV_ITEMS;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Open navigation menu"
        >
          <Menu className="size-5" />
        </button>
      </SheetTrigger>
      <SheetContent side="left" className="w-64">
        <SheetHeader>
          <SheetTitle className="text-lg font-bold tracking-tight">
            Prompt
          </SheetTitle>
        </SheetHeader>
        <nav className="flex flex-col gap-1 px-4">
          {items.map(({ href, label }) => {
            const isActive =
              pathname === href || pathname.startsWith(href + "/");
            return (
              <SheetClose asChild key={href}>
                <Link
                  href={href}
                  className={cn(
                    "rounded-md px-3 py-2 text-sm transition-colors",
                    isActive
                      ? "bg-muted text-foreground font-medium"
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  )}
                >
                  {label}
                </Link>
              </SheetClose>
            );
          })}

          <div className="my-2 h-px bg-border" />

          <SheetClose asChild>
            <Link
              href="/guides"
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
            >
              <HelpCircle className="size-4" />
              Guides
            </Link>
          </SheetClose>

          <SheetClose asChild>
            <Link
              href="/settings"
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
            >
              <Settings className="size-4" />
              Settings
            </Link>
          </SheetClose>
        </nav>
      </SheetContent>
    </Sheet>
  );
}
