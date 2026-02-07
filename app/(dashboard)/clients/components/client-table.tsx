"use client";

import { useState, useMemo, useCallback, useTransition } from "react";
import Link from "next/link";
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type RowSelectionState,
  type SortingState,
} from "@tanstack/react-table";
import { format, parseISO } from "date-fns";
import { enGB } from "date-fns/locale";
import { Icon } from "@/components/ui/icon";
import { toast } from "sonner";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

import { EditableCell } from "./editable-cell";
import { BulkActionsToolbar } from "./bulk-actions-toolbar";
import { BulkEditModal } from "./bulk-edit-modal";
import {
  type Client,
  type BulkUpdateFields,
  updateClientMetadata,
  bulkUpdateClients,
} from "@/app/actions/clients";

interface ClientTableProps {
  initialData: Client[];
}

// Client type options
const CLIENT_TYPE_OPTIONS = [
  { value: "Limited Company", label: "Limited Company" },
  { value: "Sole Trader", label: "Sole Trader" },
  { value: "Partnership", label: "Partnership" },
  { value: "LLP", label: "LLP" },
];

// VAT quarter options
const VAT_QUARTER_OPTIONS = [
  { value: "Jan-Mar", label: "Jan-Mar" },
  { value: "Apr-Jun", label: "Apr-Jun" },
  { value: "Jul-Sep", label: "Jul-Sep" },
  { value: "Oct-Dec", label: "Oct-Dec" },
];

export function ClientTable({ initialData }: ClientTableProps) {
  const [data, setData] = useState<Client[]>(initialData);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [clientTypeFilter, setClientTypeFilter] = useState<string>("all");
  const [vatStatusFilter, setVatStatusFilter] = useState<string>("all");
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Filter data based on dropdown filters
  const filteredData = useMemo(() => {
    return data.filter((client) => {
      // Client type filter
      if (clientTypeFilter !== "all" && client.client_type !== clientTypeFilter) {
        return false;
      }
      // VAT status filter
      if (vatStatusFilter === "vat" && !client.vat_registered) {
        return false;
      }
      if (vatStatusFilter === "no-vat" && client.vat_registered) {
        return false;
      }
      return true;
    });
  }, [data, clientTypeFilter, vatStatusFilter]);

  // Get selected clients
  const selectedClients = useMemo(() => {
    return Object.keys(rowSelection)
      .map((idx) => filteredData[parseInt(idx)])
      .filter(Boolean);
  }, [rowSelection, filteredData]);

  // Handle cell edit
  const handleCellEdit = useCallback(
    async (clientId: string, field: keyof Client, value: unknown) => {
      // Optimistic update
      const previousData = [...data];
      setData((prev) =>
        prev.map((client) =>
          client.id === clientId ? { ...client, [field]: value } : client
        )
      );

      try {
        await updateClientMetadata(clientId, { [field]: value });
      } catch (error) {
        // Revert on error
        setData(previousData);
        const message = error instanceof Error ? error.message : "Failed to update";
        toast.error(message);
        throw error;
      }
    },
    [data]
  );

  // Handle bulk update
  const handleBulkUpdate = useCallback(
    async (updates: BulkUpdateFields) => {
      const clientIds = selectedClients.map((c) => c.id);

      // Optimistic update
      const previousData = [...data];
      setData((prev) =>
        prev.map((client) =>
          clientIds.includes(client.id) ? { ...client, ...updates } : client
        )
      );

      try {
        await bulkUpdateClients(clientIds, updates);
        toast.success(`Updated ${clientIds.length} client${clientIds.length !== 1 ? "s" : ""}`);
        setRowSelection({});
      } catch (error) {
        // Revert on error
        setData(previousData);
        const message = error instanceof Error ? error.message : "Failed to update";
        toast.error(message);
        throw error;
      }
    },
    [selectedClients, data]
  );

  // Define columns
  const columns = useMemo<ColumnDef<Client>[]>(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <Checkbox
            checked={
              table.getIsAllPageRowsSelected()
                ? true
                : table.getIsSomePageRowsSelected()
                ? "indeterminate"
                : false
            }
            onCheckedChange={(value) =>
              table.toggleAllPageRowsSelected(!!value)
            }
            aria-label="Select all"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label="Select row"
          />
        ),
        enableSorting: false,
        enableHiding: false,
      },
      {
        accessorKey: "display_name",
        header: "Client Name",
        cell: ({ row }) => {
          const client = row.original;
          return (
            <div>
              <Link
                href={`/clients/${client.id}`}
                className="text-accent font-medium hover:underline"
              >
                {client.display_name || client.company_name}
              </Link>
              {client.primary_email && (
                <div className="text-sm text-muted-foreground">
                  {client.primary_email}
                </div>
              )}
              <div className="mt-1 flex gap-1">
                {client.has_overrides && (
                  <Badge variant="outline" className="text-xs border-accent text-accent">
                    Overrides
                  </Badge>
                )}
                {client.reminders_paused && (
                  <Badge variant="outline" className="text-xs border-status-warning text-status-warning">
                    Paused
                  </Badge>
                )}
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: "client_type",
        header: "Client Type",
        cell: ({ row }) => {
          const client = row.original;
          return (
            <EditableCell
              value={client.client_type}
              type="select"
              options={CLIENT_TYPE_OPTIONS}
              onSave={async (value) => {
                startTransition(async () => {
                  await handleCellEdit(client.id, "client_type", value);
                });
              }}
            />
          );
        },
      },
      {
        accessorKey: "year_end_date",
        header: "Year End",
        cell: ({ row }) => {
          const client = row.original;
          return (
            <EditableCell
              value={client.year_end_date}
              type="date"
              onSave={async (value) => {
                startTransition(async () => {
                  await handleCellEdit(client.id, "year_end_date", value);
                });
              }}
            />
          );
        },
      },
      {
        accessorKey: "vat_registered",
        header: "VAT Registered",
        cell: ({ row }) => {
          const client = row.original;
          return (
            <EditableCell
              value={client.vat_registered}
              type="boolean"
              onSave={async (value) => {
                startTransition(async () => {
                  await handleCellEdit(client.id, "vat_registered", value);
                });
              }}
            />
          );
        },
      },
      {
        accessorKey: "vat_quarter",
        header: "VAT Quarter",
        cell: ({ row }) => {
          const client = row.original;
          // Only show if VAT registered
          if (!client.vat_registered) {
            return <span className="text-muted-foreground">—</span>;
          }
          return (
            <EditableCell
              value={client.vat_quarter}
              type="select"
              options={VAT_QUARTER_OPTIONS}
              onSave={async (value) => {
                startTransition(async () => {
                  await handleCellEdit(client.id, "vat_quarter", value);
                });
              }}
            />
          );
        },
      },
    ],
    [handleCellEdit]
  );

  const table = useReactTable({
    data: filteredData,
    columns,
    state: {
      rowSelection,
      sorting,
      globalFilter,
    },
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="space-y-4">
      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Search Input */}
        <div className="relative flex-1 max-w-sm">
          <Icon name="search" size="sm" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by company name..."
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="pl-9 hover:border-foreground/20"
          />
          {globalFilter && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
              onClick={() => setGlobalFilter("")}
            >
              <Icon name="close" size="sm" />
            </Button>
          )}
        </div>

        {/* Client Type Filter */}
        <Select value={clientTypeFilter} onValueChange={setClientTypeFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="Limited Company">Limited Company</SelectItem>
            <SelectItem value="Sole Trader">Sole Trader</SelectItem>
            <SelectItem value="Partnership">Partnership</SelectItem>
            <SelectItem value="LLP">LLP</SelectItem>
          </SelectContent>
        </Select>

        {/* VAT Status Filter */}
        <Select value={vatStatusFilter} onValueChange={setVatStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All VAT status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="vat">VAT Registered</SelectItem>
            <SelectItem value="no-vat">Not VAT Registered</SelectItem>
          </SelectContent>
        </Select>

        {/* Clear Filters */}
        {(clientTypeFilter !== "all" || vatStatusFilter !== "all") && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setClientTypeFilter("all");
              setVatStatusFilter("all");
            }}
          >
            Clear filters
          </Button>
        )}
      </div>

      {/* Results count */}
      <div className="text-sm text-muted-foreground">
        Showing {table.getRowModel().rows.length} of {data.length} clients
      </div>

      {/* Table */}
      <div className="rounded-md border">
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
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className="hover:bg-accent/5"
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
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No clients found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Bulk Actions Toolbar */}
      <BulkActionsToolbar
        selectedCount={selectedClients.length}
        onBulkEdit={() => setIsBulkModalOpen(true)}
        onClearSelection={() => setRowSelection({})}
      />

      {/* Bulk Edit Modal */}
      <BulkEditModal
        open={isBulkModalOpen}
        onClose={() => setIsBulkModalOpen(false)}
        selectedClients={selectedClients}
        onSave={handleBulkUpdate}
      />
    </div>
  );
}
