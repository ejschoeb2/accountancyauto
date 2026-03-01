"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export interface OrgRow {
  id: string;
  name: string;
  slug: string;
  plan_tier: string | null;
  subscription_status: string | null;
  trial_ends_at: string | null;
  stripe_subscription_id: string | null;
  client_count_limit: number | null;
  created_at: string;
  clientCount: number;
  userCount: number;
}

interface OrgTableProps {
  orgs: OrgRow[];
}

const STATUS_CONFIG: Record<string, { label: string; bgClass: string; textClass: string }> = {
  active:    { label: "Active",           bgClass: "bg-green-500/10",       textClass: "text-green-600" },
  trialing:  { label: "Trial",            bgClass: "bg-blue-500/10",        textClass: "text-blue-500" },
  past_due:  { label: "Payment overdue",  bgClass: "bg-amber-500/10",       textClass: "text-amber-600" },
  cancelled: { label: "Cancelled",        bgClass: "bg-destructive/10",     textClass: "text-destructive" },
  unpaid:    { label: "Unpaid",           bgClass: "bg-destructive/10",     textClass: "text-destructive" },
};

const DEFAULT_STATUS_CONFIG = { label: "No subscription", bgClass: "bg-status-neutral/10", textClass: "text-status-neutral" };

function formatPlanTier(tier: string | null): string {
  if (!tier) return "—";
  return tier
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatTrialExpiry(trialEndsAt: string | null): string | null {
  if (!trialEndsAt) return null;
  const now = new Date();
  const end = new Date(trialEndsAt);
  const diffDays = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays > 0) return `${diffDays} day${diffDays === 1 ? "" : "s"} left`;
  if (diffDays === 0) return "Expires today";
  const ago = Math.abs(diffDays);
  return `Expired ${ago} day${ago === 1 ? "" : "s"} ago`;
}

function SortIcon({ isSorted }: { isSorted: false | "asc" | "desc" }) {
  if (isSorted === "asc") return <ArrowUp className="size-3.5 ml-1 inline" />;
  if (isSorted === "desc") return <ArrowDown className="size-3.5 ml-1 inline" />;
  return <ArrowUpDown className="size-3.5 ml-1 inline opacity-40" />;
}

const columns: ColumnDef<OrgRow>[] = [
  {
    accessorKey: "name",
    header: () => (
      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Name</span>
    ),
    cell: ({ row }) => (
      <span className="font-medium">{row.original.name}</span>
    ),
    enableSorting: false,
  },
  {
    accessorKey: "slug",
    header: () => (
      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Slug</span>
    ),
    cell: ({ row }) => (
      <span className="font-mono text-sm text-muted-foreground">{row.original.slug}</span>
    ),
    enableSorting: false,
  },
  {
    accessorKey: "plan_tier",
    header: ({ column }) => (
      <button
        className="flex items-center text-xs font-semibold text-muted-foreground uppercase tracking-wide cursor-pointer hover:text-foreground transition-colors"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Plan
        <SortIcon isSorted={column.getIsSorted()} />
      </button>
    ),
    cell: ({ row }) => (
      <span>{formatPlanTier(row.original.plan_tier)}</span>
    ),
    enableSorting: true,
  },
  {
    accessorKey: "subscription_status",
    header: ({ column }) => (
      <button
        className="flex items-center text-xs font-semibold text-muted-foreground uppercase tracking-wide cursor-pointer hover:text-foreground transition-colors"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Status
        <SortIcon isSorted={column.getIsSorted()} />
      </button>
    ),
    cell: ({ row }) => {
      const status = row.original.subscription_status;
      const config = (status && STATUS_CONFIG[status]) ? STATUS_CONFIG[status] : DEFAULT_STATUS_CONFIG;
      return (
        <div className={`px-3 py-1 rounded-md inline-flex items-center ${config.bgClass}`}>
          <span className={`text-sm font-medium ${config.textClass}`}>{config.label}</span>
        </div>
      );
    },
    enableSorting: true,
  },
  {
    id: "trial_ends_at",
    accessorKey: "trial_ends_at",
    header: () => (
      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Trial</span>
    ),
    cell: ({ row }) => {
      if (row.original.subscription_status !== "trialing") {
        return <span className="text-muted-foreground">—</span>;
      }
      const expiry = formatTrialExpiry(row.original.trial_ends_at);
      if (!expiry) return <span className="text-muted-foreground">—</span>;
      const isExpired = expiry.startsWith("Expired");
      return (
        <span className={isExpired ? "text-destructive text-sm" : "text-sm"}>
          {expiry}
        </span>
      );
    },
    enableSorting: false,
  },
  {
    accessorKey: "clientCount",
    header: () => (
      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide text-right block">Clients</span>
    ),
    cell: ({ row }) => (
      <span className="block text-right tabular-nums">{row.original.clientCount}</span>
    ),
    enableSorting: false,
  },
  {
    accessorKey: "userCount",
    header: () => (
      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide text-right block">Users</span>
    ),
    cell: ({ row }) => (
      <span className="block text-right tabular-nums">{row.original.userCount}</span>
    ),
    enableSorting: false,
  },
];

export function OrgTable({ orgs }: OrgTableProps) {
  const router = useRouter();
  const [sorting, setSorting] = useState<SortingState>([]);

  const table = useReactTable({
    data: orgs,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="border rounded-lg overflow-hidden shadow-sm">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id} className="bg-muted/30 hover:bg-muted/30">
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id} className="py-3">
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                className="cursor-pointer group hover:bg-muted/50 transition-colors"
                onClick={() => router.push(`/admin/${row.original.slug}`)}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id} className="py-3">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                No organisations found.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
