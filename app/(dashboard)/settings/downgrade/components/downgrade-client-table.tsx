"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle, Loader2, Search, X, ArrowDown, Trash2 } from "lucide-react";
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { ButtonBase } from "@/components/ui/button-base";
import { CheckButton } from "@/components/ui/check-button";
import { Card } from "@/components/ui/card";
import type { Client } from "@/app/actions/clients";
import type { PlanTier } from "@/lib/stripe/plans";

interface DowngradeClientTableProps {
  clients: Client[];
  clientsToRemove: number;
  targetTier: PlanTier;
  targetPlanName: string;
  targetLimit: number;
  currentPlanName: string;
  orgId: string;
}

export function DowngradeClientTable({
  clients,
  clientsToRemove,
  targetTier,
  targetPlanName,
  targetLimit,
  currentPlanName,
  orgId,
}: DowngradeClientTableProps) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remaining = clientsToRemove - selectedIds.size;
  const canConfirm = remaining <= 0;

  function toggleRow(clientId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(clientId)) {
        next.delete(clientId);
      } else {
        next.add(clientId);
      }
      return next;
    });
  }

  const columns = useMemo<ColumnDef<Client>[]>(
    () => [
      {
        id: "selected",
        header: "",
        size: 48,
        enableSorting: false,
        cell: ({ row }) => {
          const isSelected = selectedIds.has(row.original.id);
          return (
            <div
              className="flex items-center justify-center cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                toggleRow(row.original.id);
              }}
            >
              <CheckButton
                checked={isSelected}
                onCheckedChange={() => toggleRow(row.original.id)}
                aria-label="Select row"
              />
            </div>
          );
        },
      },
      {
        accessorKey: "display_name",
        header: () => (
          <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Client Name
          </span>
        ),
        cell: ({ row }) => (
          <span className="text-muted-foreground transition-colors">
            {row.original.display_name || row.original.company_name}
          </span>
        ),
        sortingFn: (rowA, rowB) => {
          const a = (rowA.original.display_name || rowA.original.company_name).toLowerCase();
          const b = (rowB.original.display_name || rowB.original.company_name).toLowerCase();
          return a.localeCompare(b);
        },
      },
      {
        accessorKey: "client_type",
        header: () => (
          <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Type
          </span>
        ),
        cell: ({ getValue }) => (
          <span className="text-sm text-muted-foreground">
            {(getValue() as string) || "—"}
          </span>
        ),
      },
      {
        accessorKey: "year_end_date",
        header: () => (
          <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Year End
          </span>
        ),
        cell: ({ getValue }) => {
          const val = getValue() as string | null;
          if (!val) return <span className="text-sm text-muted-foreground">—</span>;
          const d = new Date(val + "T00:00:00");
          return (
            <span className="text-sm text-muted-foreground">
              {d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
            </span>
          );
        },
      },
      {
        accessorKey: "primary_email",
        header: () => (
          <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Email
          </span>
        ),
        cell: ({ getValue }) => (
          <span className="text-sm text-muted-foreground">
            {(getValue() as string) || "—"}
          </span>
        ),
      },
    ],
    [selectedIds]
  );

  const table = useReactTable({
    data: clients,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    globalFilterFn: (row, _columnId, filterValue) => {
      const name = (row.original.display_name || row.original.company_name).toLowerCase();
      const email = (row.original.primary_email || "").toLowerCase();
      const search = filterValue.toLowerCase();
      return name.includes(search) || email.includes(search);
    },
  });

  async function handleConfirmDowngrade() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/stripe/downgrade-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId,
          targetTier,
          clientIdsToRemove: Array.from(selectedIds),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to downgrade plan");
        setLoading(false);
        return;
      }

      router.push("/settings?tab=billing");
      router.refresh();
    } catch (err) {
      console.error("Downgrade error:", err);
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <Card className="gap-1.5">
      {/* Header */}
      <div className="px-8">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="space-y-1">
            <h2 className="text-2xl font-semibold">Downgrade to {targetPlanName}</h2>
            <p className="text-sm text-muted-foreground">
              Select clients to remove before downgrading
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ButtonBase
              variant="muted"
              buttonType="icon-text"
              onClick={() => router.push("/settings?tab=billing")}
            >
              <X className="size-4" />
              Cancel
            </ButtonBase>
            <ButtonBase
              variant="destructive"
              buttonType="icon-text"
              onClick={handleConfirmDowngrade}
              disabled={!canConfirm || loading}
            >
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Downgrading...
                </>
              ) : (
                <>
                  <ArrowDown className="size-4" />
                  Confirm downgrade
                </>
              )}
            </ButtonBase>
          </div>
        </div>
      </div>

      {/* Alert banner */}
      <div className="px-8">
        {canConfirm ? (
          <div className="flex items-center gap-3 p-4 bg-green-500/10 rounded-xl">
            <CheckCircle className="size-5 text-green-600 shrink-0" />
            <p className="text-sm text-green-600">
              You&apos;ve selected enough clients. Ready to downgrade.
            </p>
          </div>
        ) : (
          <div className="flex items-start gap-3 p-4 bg-amber-500/10 rounded-xl">
            <AlertTriangle className="size-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-amber-600">
                Select {remaining} more client{remaining === 1 ? "" : "s"} to remove
              </p>
              <p className="text-sm text-amber-600/80">
                The {targetPlanName} plan supports up to {targetLimit} clients.
                You currently have {clients.length}. Choose {clientsToRemove} to permanently remove.
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-3 p-4 bg-red-500/10 rounded-xl mt-3">
            <AlertTriangle className="size-5 text-red-500 shrink-0" />
            <p className="text-sm text-red-500">{error}</p>
          </div>
        )}
      </div>

      {/* Search bar */}
      <div className="px-8 mt-2">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search clients..."
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="pl-9 pr-9"
          />
          {globalFilter && (
            <button
              onClick={() => setGlobalFilter("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
      </div>

      {/* Full-width table matching clients page */}
      <div className="-mx-[1px] -mb-[1px] mt-2 border-t shadow-sm hover:shadow-lg transition-shadow duration-300 bg-white rounded-b-xl overflow-hidden">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  No clients found.
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => {
                const isSelected = selectedIds.has(row.original.id);
                return (
                  <TableRow
                    key={row.id}
                    data-state={isSelected && "selected"}
                    onClick={() => toggleRow(row.original.id)}
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}
