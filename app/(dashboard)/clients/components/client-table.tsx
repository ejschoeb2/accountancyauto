"use client";

import { useState, useMemo, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
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
import { format } from "date-fns";
import { Search, X, SlidersHorizontal, Calendar, Percent } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { TrafficLightBadge } from "@/app/(dashboard)/dashboard/components/traffic-light-badge";
import type { TrafficLightStatus } from "@/lib/dashboard/traffic-light";
import { EditableCell } from "./editable-cell";
import { BulkActionsToolbar } from "./bulk-actions-toolbar";
import { BulkEditModal } from "./bulk-edit-modal";
import { SendEmailModal } from "./send-email-modal";
import {
  type Client,
  type BulkUpdateFields,
  updateClientMetadata,
  bulkUpdateClients,
} from "@/app/actions/clients";

export interface ClientStatusInfo {
  status: string;
  next_deadline: string | null;
}

interface ClientTableProps {
  initialData: Client[];
  statusMap: Record<string, ClientStatusInfo>;
  initialFilter?: string;
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

// Status filter config
const STATUS_LABELS: Record<TrafficLightStatus, string> = {
  red: "Overdue",
  amber: "Chasing",
  green: "On Track",
  grey: "Inactive",
};

const STATUS_BUTTON_ACTIVE_CLASS: Record<TrafficLightStatus, string> = {
  red: "bg-status-danger hover:bg-status-danger text-white",
  amber: "bg-status-warning hover:bg-status-warning text-white",
  green: "bg-status-success hover:bg-status-success text-white",
  grey: "bg-status-neutral hover:bg-status-neutral text-white",
};

export function ClientTable({ initialData, statusMap, initialFilter }: ClientTableProps) {
  const router = useRouter();
  const [data, setData] = useState<Client[]>(initialData);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [sortBy, setSortBy] = useState<string>("deadline-asc");

  // Initialize filters based on initialFilter parameter
  const getInitialStatusFilters = () => {
    if (initialFilter === "red") return new Set<TrafficLightStatus>(["red"]);
    if (initialFilter === "amber") return new Set<TrafficLightStatus>(["amber"]);
    return new Set<TrafficLightStatus>();
  };

  const [activeTypeFilters, setActiveTypeFilters] = useState<Set<string>>(new Set());
  const [activeVatFilter, setActiveVatFilter] = useState<string | null>(null);
  const [activeStatusFilters, setActiveStatusFilters] = useState<Set<TrafficLightStatus>>(getInitialStatusFilters());
  const [pausedFilter, setPausedFilter] = useState<boolean>(initialFilter === "paused");
  const [showFilters, setShowFilters] = useState(initialFilter ? true : false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [isSendEmailModalOpen, setIsSendEmailModalOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function toggleStatusFilter(status: TrafficLightStatus) {
    setActiveStatusFilters((prev) => {
      const next = new Set(prev);
      if (next.has(status)) {
        next.delete(status);
      } else {
        next.add(status);
      }
      return next;
    });
  }

  function toggleTypeFilter(type: string) {
    setActiveTypeFilters((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  }

  function toggleVatFilter(value: string) {
    setActiveVatFilter((prev) => (prev === value ? null : value));
  }

  // Filter and sort data based on tag filters + status filter + sort option
  const filteredData = useMemo(() => {
    let filtered = data.filter((client) => {
      // Paused filter
      if (pausedFilter && !client.reminders_paused) {
        return false;
      }
      // Client type filter
      if (activeTypeFilters.size > 0 && (!client.client_type || !activeTypeFilters.has(client.client_type))) {
        return false;
      }
      // VAT status filter
      if (activeVatFilter === "vat" && !client.vat_registered) {
        return false;
      }
      if (activeVatFilter === "no-vat" && client.vat_registered) {
        return false;
      }
      // Traffic light status filter
      if (activeStatusFilters.size > 0) {
        const clientStatus = statusMap[client.id]?.status as TrafficLightStatus | undefined;
        if (!clientStatus || !activeStatusFilters.has(clientStatus)) {
          return false;
        }
      }
      return true;
    });

    // Apply sorting based on sortBy value
    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case "name-asc":
          return (a.display_name || a.company_name).localeCompare(b.display_name || b.company_name);
        case "name-desc":
          return (b.display_name || b.company_name).localeCompare(a.display_name || a.company_name);
        case "deadline-asc": {
          const deadlineA = statusMap[a.id]?.next_deadline;
          const deadlineB = statusMap[b.id]?.next_deadline;
          if (!deadlineA && !deadlineB) return 0;
          if (!deadlineA) return 1;
          if (!deadlineB) return -1;
          return deadlineA.localeCompare(deadlineB);
        }
        case "deadline-desc": {
          const deadlineA = statusMap[a.id]?.next_deadline;
          const deadlineB = statusMap[b.id]?.next_deadline;
          if (!deadlineA && !deadlineB) return 0;
          if (!deadlineA) return -1;
          if (!deadlineB) return 1;
          return deadlineB.localeCompare(deadlineA);
        }
        case "status-green":
          return statusMap[a.id]?.status === "green" ? -1 : statusMap[b.id]?.status === "green" ? 1 : 0;
        case "status-amber":
          return statusMap[a.id]?.status === "amber" ? -1 : statusMap[b.id]?.status === "amber" ? 1 : 0;
        case "status-red":
          return statusMap[a.id]?.status === "red" ? -1 : statusMap[b.id]?.status === "red" ? 1 : 0;
        case "type-asc":
          return (a.client_type || "").localeCompare(b.client_type || "");
        case "vat-registered":
          return b.vat_registered === a.vat_registered ? 0 : b.vat_registered ? -1 : 1;
        default:
          return 0;
      }
    });

    return sorted;
  }, [data, activeTypeFilters, activeVatFilter, activeStatusFilters, pausedFilter, statusMap, sortBy]);

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
        header: () => (
          <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Client Name
          </span>
        ),
        cell: ({ row }) => {
          const client = row.original;
          return (
            <div>
              <span
                className="text-muted-foreground font-semibold group-hover:text-foreground transition-colors"
              >
                {client.display_name || client.company_name}
              </span>
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
        id: "status",
        header: () => (
          <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Status
          </span>
        ),
        cell: ({ row }) => {
          const info = statusMap[row.original.id];
          if (!info) return <span className="text-muted-foreground">—</span>;

          const statusColors: Record<string, { bg: string; text: string }> = {
            red: { bg: 'bg-status-danger/10', text: 'text-status-danger' },
            amber: { bg: 'bg-status-warning/10', text: 'text-status-warning' },
            green: { bg: 'bg-status-success/10', text: 'text-status-success' },
            grey: { bg: 'bg-status-neutral/10', text: 'text-status-neutral' },
          };

          const colors = statusColors[info.status] || statusColors.grey;
          const labels: Record<string, string> = {
            red: 'Overdue',
            amber: 'Chasing',
            green: 'On Track',
            grey: 'Inactive',
          };

          return (
            <div className={`px-3 py-2 rounded-md ${colors.bg} inline-flex items-center`}>
              <span className={`text-sm font-medium ${colors.text}`}>
                {labels[info.status] || '—'}
              </span>
            </div>
          );
        },
        enableSorting: false,
      },
      {
        id: "next_deadline",
        header: () => (
          <span className="text-sm font-semibold text-foreground/70 uppercase tracking-wide">
            Next Deadline
          </span>
        ),
        cell: ({ row }) => {
          const info = statusMap[row.original.id];
          if (!info?.next_deadline) return <span className="text-muted-foreground">—</span>;
          return (
            <div className="size-9 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Calendar className="size-5 text-blue-600" />
            </div>
          );
        },
        sortingFn: (rowA, rowB) => {
          const a = statusMap[rowA.original.id]?.next_deadline;
          const b = statusMap[rowB.original.id]?.next_deadline;
          if (!a && !b) return 0;
          if (!a) return 1;
          if (!b) return -1;
          return a.localeCompare(b);
        },
      },
      {
        accessorKey: "client_type",
        header: () => (
          <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Client Type
          </span>
        ),
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
        header: () => (
          <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Year End
          </span>
        ),
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
        header: () => (
          <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            VAT Registered
          </span>
        ),
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
        header: () => (
          <span className="text-sm font-semibold text-foreground/70 uppercase tracking-wide">
            VAT Quarter
          </span>
        ),
        cell: ({ row }) => {
          const client = row.original;
          // Only show if VAT registered
          if (!client.vat_registered) {
            return <span className="text-muted-foreground">—</span>;
          }
          return (
            <div className="size-9 rounded-lg bg-purple-500/10 flex items-center justify-center">
              <Percent className="size-5 text-purple-600" />
            </div>
          );
        },
      },
    ],
    [handleCellEdit, statusMap]
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

  const activeFilterCount =
    activeTypeFilters.size +
    (activeVatFilter ? 1 : 0) +
    activeStatusFilters.size +
    (pausedFilter ? 1 : 0);

  function clearAllFilters() {
    setActiveTypeFilters(new Set());
    setActiveVatFilter(null);
    setActiveStatusFilters(new Set());
    setPausedFilter(false);
  }

  return (
    <div className="space-y-4">
      {/* Search Input and Controls */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        {/* Search Input */}
        <div className="relative flex-1 max-w-sm">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
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
              <X className="size-4" />
            </Button>
          )}
        </div>

        {/* Controls toolbar - Filter, Sort */}
        <div className="flex gap-2 sm:ml-auto items-center">
          <Button
            variant={showFilters ? "default" : "outline"}
            size="sm"
            onClick={() => setShowFilters((v) => !v)}
            className="gap-1.5 h-8"
          >
            <SlidersHorizontal className="size-4" />
            Filter
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1.5 text-xs rounded-full">
                {activeFilterCount}
              </Badge>
            )}
          </Button>
          <span className="text-sm font-display font-bold text-foreground">Sort by:</span>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-[180px] h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name-asc">Name (A-Z)</SelectItem>
              <SelectItem value="name-desc">Name (Z-A)</SelectItem>
              <SelectItem value="deadline-asc">Deadline (Earliest)</SelectItem>
              <SelectItem value="deadline-desc">Deadline (Latest)</SelectItem>
              <SelectItem value="status-green">Status (On Track)</SelectItem>
              <SelectItem value="status-amber">Status (Chasing)</SelectItem>
              <SelectItem value="status-red">Status (Overdue)</SelectItem>
              <SelectItem value="type-asc">Type (A-Z)</SelectItem>
              <SelectItem value="vat-registered">VAT Registered</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Collapsible filter panel */}
      {showFilters && (
        <div className="rounded-lg border bg-card p-4 space-y-4">
          {/* Status */}
          <div className="space-y-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</span>
            <div className="flex flex-wrap gap-2">
              {(["red", "amber", "green", "grey"] as const).map((status) => (
                <Button
                  key={status}
                  variant={activeStatusFilters.has(status) ? "default" : "outline"}
                  size="sm"
                  onClick={() => toggleStatusFilter(status)}
                  className={
                    activeStatusFilters.has(status)
                      ? STATUS_BUTTON_ACTIVE_CLASS[status]
                      : ""
                  }
                >
                  {STATUS_LABELS[status]}
                </Button>
              ))}
            </div>
          </div>

          {/* Client Type */}
          <div className="space-y-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Client Type</span>
            <div className="flex flex-wrap gap-2">
              {CLIENT_TYPE_OPTIONS.map((opt) => (
                <Button
                  key={opt.value}
                  variant={activeTypeFilters.has(opt.value) ? "default" : "outline"}
                  size="sm"
                  onClick={() => toggleTypeFilter(opt.value)}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
          </div>

          {/* VAT Status */}
          <div className="space-y-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">VAT Status</span>
            <div className="flex flex-wrap gap-2">
              <Button
                variant={activeVatFilter === "vat" ? "default" : "outline"}
                size="sm"
                onClick={() => toggleVatFilter("vat")}
              >
                VAT Registered
              </Button>
              <Button
                variant={activeVatFilter === "no-vat" ? "default" : "outline"}
                size="sm"
                onClick={() => toggleVatFilter("no-vat")}
              >
                Not VAT Registered
              </Button>
            </div>
          </div>

          {/* Clear all */}
          {activeFilterCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAllFilters}
              className="text-muted-foreground"
            >
              Clear all filters
            </Button>
          )}
        </div>
      )}

      {/* Results count */}
      <div className="text-sm font-medium text-foreground/70">
        Showing <span className="font-semibold text-foreground">{table.getRowModel().rows.length}</span> of <span className="font-semibold text-foreground">{data.length}</span> clients
      </div>

      {/* Table */}
      <div className="rounded-xl border shadow-sm hover:shadow-lg transition-shadow duration-300">
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
                  className="group cursor-pointer"
                  onClick={(e) => {
                    // Don't navigate if clicking on checkbox, input, select, or button elements
                    const target = e.target as HTMLElement;
                    if (
                      target.closest('[data-slot="checkbox"]') ||
                      target.closest('input') ||
                      target.closest('select') ||
                      target.closest('button') ||
                      target.closest('[role="button"]')
                    ) {
                      return;
                    }
                    router.push(`/clients/${row.original.id}`);
                  }}
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
        onSendEmail={() => setIsSendEmailModalOpen(true)}
        onClearSelection={() => setRowSelection({})}
      />

      {/* Bulk Edit Modal */}
      <BulkEditModal
        open={isBulkModalOpen}
        onClose={() => setIsBulkModalOpen(false)}
        selectedClients={selectedClients}
        onSave={handleBulkUpdate}
      />

      {/* Send Email Modal */}
      <SendEmailModal
        open={isSendEmailModalOpen}
        onClose={() => setIsSendEmailModalOpen(false)}
        selectedClients={selectedClients}
      />
    </div>
  );
}
