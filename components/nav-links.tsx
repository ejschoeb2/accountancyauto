"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const NAV_ITEMS: { href: string; label: string }[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/clients", label: "Clients" },
  { href: "/schedules", label: "Reminder Schedules" },
  { href: "/templates", label: "Email Templates" },
  { href: "/email-logs", label: "Activity" },
];

const ADMIN_ITEM: { href: string; label: string } = {
  href: "/admin",
  label: "Admin",
};

interface NavLinksProps {
  isSuperAdmin?: boolean;
  orgRole?: string;
}

export function NavLinks({ isSuperAdmin, orgRole = "member" }: NavLinksProps) {
  const pathname = usePathname();

  const items = isSuperAdmin ? [...NAV_ITEMS, ADMIN_ITEM] : NAV_ITEMS;

  return (
    <nav className="flex items-center gap-0">
      {items.map(({ href, label }) => {
        const isActive = pathname === href || pathname.startsWith(href + "/");

        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "px-4 py-2.5 text-base transition-opacity duration-150",
              isActive
                ? "text-foreground font-medium"
                : "text-muted-foreground/50 font-normal hover:opacity-80"
            )}
          >
            {label}
          </Link>

        );
      })}
    </nav>
  );
}
