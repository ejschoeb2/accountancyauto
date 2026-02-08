"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, FileText, CalendarDays, Mail, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS: { href: string; icon: LucideIcon; label: string }[] = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/clients", icon: Users, label: "Clients" },
  { href: "/templates", icon: FileText, label: "Templates & Schedules" },
  { href: "/delivery-log", icon: Mail, label: "Delivery Log" },
];

export function NavLinks() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-2">
      {NAV_ITEMS.map(({ href, icon: IconComponent, label }) => {
        const isActive = pathname === href || pathname.startsWith(href + "/");

        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-2.5 px-5 py-2.5 text-base font-medium transition-all duration-200 relative group",
              isActive
                ? "text-foreground"
                : "text-muted-foreground"
            )}
          >
            <IconComponent className="size-5" />
            <span className={cn(
              "relative",
              isActive
                ? "after:absolute after:bottom-[-2px] after:left-0 after:right-0 after:h-0.5 after:bg-primary"
                : "after:absolute after:bottom-[-2px] after:left-0 after:right-0 after:h-0.5 after:bg-border after:opacity-0 group-hover:after:opacity-100 after:transition-opacity"
            )}>
              {label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
