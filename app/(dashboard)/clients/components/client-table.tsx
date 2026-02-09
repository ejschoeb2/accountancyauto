"use client";

import { useState, useMemo, useCallback, useTransition } from "react";
import dynamic from "next/dynamic";
import { Upload } from "lucide-react";
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
import { Search, X, SlidersHorizontal, Calendar, ChevronDown } from "lucide-react";
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
import { IconButtonWithText } from "@/components/ui/icon-button-with-text";
import { ButtonWithText } from "@/components/ui/button-with-text";
import { Section } from "@/components/ui/section";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";

import { TrafficLightBadge } from "@/app/(dashboard)/dashboard/components/traffic-light-badge";
import type { TrafficLightStatus } from "@/lib/dashboard/traffic-light";
import { EditableCell } from "./editable-cell";
import { BulkActionsToolbar } from "./bulk-actions-toolbar";
import { BulkEditModal } from "./bulk-edit-modal";
import { SendEmailModal } from "./send-email-modal";

// Lazy load the CSV import dialog to avoid hydration issues
const CsvImportDialog = dynamic(() => import("./csv-import-dialog").then(m => ({ default: m.CsvImportDialog })), { ssr: false });
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

// VAT stagger group options
const VAT_STAGGER_GROUP_OPTIONS = [
  { value: "1", label: "Stagger 1 (Mar/Jun/Sep/Dec)" },
  { value: "2", label: "Stagger 2 (Jan/Apr/Jul/Oct)" },
  { value: "3", label: "Stagger 3 (Feb/May/Aug/Nov)" },
];

// Status filter config
const STATUS_LABELS: Record<TrafficLightStatus, string> = {
  red: "Overdue",
  amber: "Chasing",
  green: "On Track",
  grey: "Inactive",
};

// Sort option labels
const SORT_LABELS: Record<string, string> = {
  "name-asc": "Name (A-Z)",
  "name-desc": "Name (Z-A)",
  "deadline-asc": "Deadline (Earliest)",
  "deadline-desc": "Deadline (Latest)",
  "status-green": "Status (On Track)",
  "status-amber": "Status (Chasing)",
  "status-red": "Status (Overdue)",
  "type-asc": "Type (A-Z)",
  "vat-registered": "VAT Registered",
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
  const [isCsvDialogOpen, setIsCsvDialogOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleImportComplete = () => {
    window.location.reload();
  };

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
            <button className="size-9 rounded-lg bg-status-neutral/10 hover:bg-status-neutral/20 flex items-center justify-center transition-all duration-200 outline-none focus-visible:ring-ring/50 focus-visible:ring-[3px]">
              <Calendar className="size-5 text-status-neutral" />
            </button>
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
        accessorKey: "vat_stagger_group",
        header: () => (
          <span className="text-sm font-semibold text-foreground/70 uppercase tracking-wide">
            VAT Stagger
          </span>
        ),
        cell: ({ row }) => {
          const client = row.original;
          // Only show if VAT registered
          if (!client.vat_registered) {
            return <span className="text-muted-foreground">—</span>;
          }
          return (
            <EditableCell
              value={client.vat_stagger_group?.toString() ?? null}
              type="select"
              options={VAT_STAGGER_GROUP_OPTIONS}
              onSave={async (value) => {
                startTransition(async () => {
                  await handleCellEdit(client.id, "vat_stagger_group", value ? parseInt(value as string) : null);
                });
              }}
            />
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

        {/* Controls toolbar - Import CSV, Filter, Sort */}
        <div className="flex gap-2 sm:ml-auto items-center">
          <IconButtonWithText
            type="button"
            variant="sky"
            onClick={() => setIsCsvDialogOpen(true)}
            title="Import clients from CSV"
          >
            <Upload className="h-5 w-5" />
            Import CSV
          </IconButtonWithText>
          <IconButtonWithText
            type="button"
            variant="violet"
            onClick={() => setShowFilters((v) => !v)}
            title={showFilters ? "Close filters" : "Open filters"}
          >
            <SlidersHorizontal className="h-5 w-5" />
            Filter
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="h-5 min-w-5 px-1.5 text-xs rounded-full">
                {activeFilterCount}
              </Badge>
            )}
          </IconButtonWithText>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 h-10 text-sm font-medium transition-all duration-200 active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none shrink-0 outline-none focus-visible:ring-ring/50 focus-visible:ring-[3px] bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 hover:text-amber-700">
                {SORT_LABELS[sortBy]}
                <ChevronDown className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuRadioGroup value={sortBy} onValueChange={setSortBy}>
                <DropdownMenuRadioItem value="name-asc">Name (A-Z)</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="name-desc">Name (Z-A)</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="deadline-asc">Deadline (Earliest)</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="deadline-desc">Deadline (Latest)</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="status-green">Status (On Track)</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="status-amber">Status (Chasing)</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="status-red">Status (Overdue)</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="type-asc">Type (A-Z)</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="vat-registered">VAT Registered</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Collapsible filter panel */}
      {showFilters && (
        <Section padding="sm" className="space-y-4">
          {/* Status */}
          <div className="space-y-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</span>
            <div className="flex flex-wrap gap-2">
              {(["red", "amber", "green", "grey"] as const).map((status) => {
                return (
                  <ButtonWithText
                    key={status}
                    onClick={() => toggleStatusFilter(status)}
                    isSelected={activeStatusFilters.has(status)}
                    variant="muted"
                  >
                    {STATUS_LABELS[status]}
                  </ButtonWithText>
                );
              })}
            </div>
          </div>

          {/* Client Type */}
          <div className="space-y-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Client Type</span>
            <div className="flex flex-wrap gap-2">
              {CLIENT_TYPE_OPTIONS.map((opt) => (
                <ButtonWithText
                  key={opt.value}
                  onClick={() => toggleTypeFilter(opt.value)}
                  isSelected={activeTypeFilters.has(opt.value)}
                  variant="muted"
                >
                  {opt.label}
                </ButtonWithText>
              ))}
            </div>
          </div>

          {/* VAT Status */}
          <div className="space-y-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">VAT Status</span>
            <div className="flex flex-wrap gap-2">
              <ButtonWithText
                onClick={() => toggleVatFilter("vat")}
                isSelected={activeVatFilter === "vat"}
                variant="muted"
              >
                VAT Registered
              </ButtonWithText>
              <ButtonWithText
                onClick={() => toggleVatFilter("no-vat")}
                isSelected={activeVatFilter === "no-vat"}
                variant="muted"
              >
                Not VAT Registered
              </ButtonWithText>
            </div>
          </div>

          {/* Clear all */}
          {activeFilterCount > 0 && (
            <ButtonWithText
              onClick={clearAllFilters}
              variant="muted"
            >
              Clear all filters
            </ButtonWithText>
          )}
        </Section>
      )}

      {/* Results count */}
      <div className="text-sm font-medium text-foreground/70">
        Showing <span className="font-semibold text-foreground">{table.getRowModel().rows.length}</span> of <span className="font-semibold text-foreground">{data.length}</span> clients
      </div>

      {/* Table */}
      <div className="rounded-xl border shadow-sm hover:shadow-lg transition-shadow duration-300 bg-white">
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

      {/* CSV Import Dialog */}
      <CsvImportDialog
        open={isCsvDialogOpen}
        onOpenChange={setIsCsvDialogOpen}
        onImportComplete={handleImportComplete}
      />
    </div>
  );
}
