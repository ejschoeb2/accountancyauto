"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, AlertTriangle, Loader2, Check, Search, X } from "lucide-react";
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
            <div className="flex items-center justify-center">
              <div
                className={`size-5 rounded border-2 flex items-center justify-center transition-colors ${
                  isSelected
                    ? "bg-destructive border-destructive text-white"
                    : "border-border"
                }`}
              >
                {isSelected && <Check className="size-3" />}
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: "display_name",
        header: "Client Name",
        cell: ({ row }) =>
          row.original.display_name || row.original.company_name,
        sortingFn: (rowA, rowB) => {
          const a = (rowA.original.display_name || rowA.original.company_name).toLowerCase();
          const b = (rowB.original.display_name || rowB.original.company_name).toLowerCase();
          return a.localeCompare(b);
        },
      },
      {
        accessorKey: "client_type",
        header: "Type",
        cell: ({ getValue }) => getValue() || "—",
      },
      {
        accessorKey: "year_end_date",
        header: "Year End",
        cell: ({ getValue }) => {
          const val = getValue() as string | null;
          if (!val) return "—";
          const d = new Date(val + "T00:00:00");
          return d.toLocaleDateString("en-GB", {
            day: "numeric",
            month: "short",
          });
        },
      },
      {
        accessorKey: "primary_email",
        header: "Email",
        cell: ({ getValue }) => getValue() || "—",
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
    <>
      {/* Header */}
      <div className="flex items-center gap-3">
        <ButtonBase
          variant="ghost"
          buttonType="icon-only"
          onClick={() => router.push("/settings?tab=billing")}
        >
          <ArrowLeft className="size-5" />
        </ButtonBase>
        <div>
          <h1>Downgrade to {targetPlanName}</h1>
          <p className="text-sm text-muted-foreground">
            Select clients to remove before downgrading
          </p>
        </div>
      </div>

      {/* Alert banner */}
      <div
        className={`flex items-start gap-3 rounded-lg border p-4 ${
          canConfirm
            ? "bg-green-500/10 border-green-500/30"
            : "bg-amber-500/10 border-amber-500/30"
        }`}
      >
        <AlertTriangle
          className={`size-5 shrink-0 mt-0.5 ${
            canConfirm ? "text-green-600" : "text-amber-600"
          }`}
        />
        <div className="space-y-1">
          <p className={`text-sm font-medium ${canConfirm ? "text-green-600" : "text-amber-600"}`}>
            {canConfirm
              ? `You've selected enough clients. Ready to downgrade.`
              : `Select ${remaining} more client${remaining === 1 ? "" : "s"} to remove`}
          </p>
          <p className="text-sm text-muted-foreground">
            The {targetPlanName} plan supports up to {targetLimit} clients.
            You currently have {clients.length} client{clients.length === 1 ? "" : "s"}.
            {!canConfirm &&
              ` Choose ${clientsToRemove} to permanently remove.`}
          </p>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-lg border p-4 bg-destructive/10 border-destructive/30">
          <AlertTriangle className="size-5 shrink-0 mt-0.5 text-destructive" />
          <p className="text-sm font-medium text-destructive">{error}</p>
        </div>
      )}

      {/* Search + action bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative max-w-sm flex-1">
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

        <div className="flex items-center gap-3">
          <p className="text-sm text-muted-foreground">
            {selectedIds.size} of {clientsToRemove} selected
          </p>
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
              `Confirm downgrade`
            )}
          </ButtonBase>
        </div>
      </div>

      {/* Client table */}
      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      style={{ width: header.getSize() !== 150 ? header.getSize() : undefined }}
                    >
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
                  <TableCell colSpan={columns.length} className="text-center py-8 text-muted-foreground">
                    No clients found
                  </TableCell>
                </TableRow>
              ) : (
                table.getRowModel().rows.map((row) => {
                  const isSelected = selectedIds.has(row.original.id);
                  return (
                    <TableRow
                      key={row.id}
                      onClick={() => toggleRow(row.original.id)}
                      className={`cursor-pointer transition-colors ${
                        isSelected
                          ? "bg-destructive/5 hover:bg-destructive/10"
                          : "hover:bg-muted/50"
                      }`}
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
    </>
  );
}
