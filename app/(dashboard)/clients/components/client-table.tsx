"use client";

import { useState, useMemo, useCallback, useTransition } from "react";
import dynamic from "next/dynamic";
import { Upload, Pencil, X as XIcon, Plus, CheckCircle, XCircle, AlertCircle, Minus } from "lucide-react";
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
import { Search, X, SlidersHorizontal, Calendar } from "lucide-react";
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
import { CheckButton } from "@/components/ui/check-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IconButtonWithText } from "@/components/ui/icon-button-with-text";
import { ButtonWithText } from "@/components/ui/button-with-text";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
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
import { ToggleGroup } from "@/components/ui/toggle-group";
import { StatusDropdown } from "./status-dropdown";
import { FilingStatusBadge } from "./filing-status-badge";
import { BulkEditStatusModal } from "./bulk-edit-status-modal";
import type { FilingTypeStatus } from "@/lib/types/database";
import type { Row } from "@tanstack/react-table";

// Lazy load the CSV import dialog to avoid hydration issues
const CsvImportDialog = dynamic(() => import("./csv-import-dialog").then(m => ({ default: m.CsvImportDialog })), { ssr: false });
const CreateClientDialog = dynamic(() => import("./create-client-dialog").then(m => ({ default: m.CreateClientDialog })), { ssr: false });
import {
  type Client,
  type BulkUpdateFields,
  updateClientMetadata,
  bulkUpdateClients,
} from "@/app/actions/clients";

export interface ClientStatusInfo {
  status: string;
  next_deadline: string | null;
  next_deadline_type: string | null;
}

const FILING_TYPE_LABELS: Record<string, string> = {
  corporation_tax_payment: "Corp Tax",
  ct600_filing: "CT600",
  companies_house: "Companies House",
  vat_return: "VAT Return",
  self_assessment: "Self Assessment",
};

const ALL_FILING_TYPES = [
  'corporation_tax_payment',
  'ct600_filing',
  'companies_house',
  'vat_return',
  'self_assessment',
] as const;

interface ClientTableProps {
  initialData: Client[];
  statusMap: Record<string, ClientStatusInfo>;
  filingStatusMap: Record<string, FilingTypeStatus[]>;
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
  orange: "Critical",
  amber: "Approaching",
  blue: "Scheduled",
  green: "Records Received",
  grey: "Inactive",
};

// Sort option labels
const SORT_LABELS: Record<string, string> = {
  "name-asc": "Name (A-Z)",
  "name-desc": "Name (Z-A)",
  "deadline-asc": "Deadline (Earliest)",
  "deadline-desc": "Deadline (Latest)",
  "most-urgent": "Most Urgent",
  "type-asc": "Type (A-Z)",
};

export function ClientTable({ initialData, statusMap, filingStatusMap, initialFilter }: ClientTableProps) {
  const router = useRouter();
  const [data, setData] = useState<Client[]>(initialData);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [sortBy, setSortBy] = useState<string>("most-urgent");
  type ViewMode = 'data' | 'status';
  const [viewMode, setViewMode] = useState<ViewMode>('data');

  // Initialize filters based on initialFilter parameter
  const getInitialStatusFilters = () => {
    if (initialFilter === "red") return new Set<TrafficLightStatus>(["red"]);
    if (initialFilter === "amber") return new Set<TrafficLightStatus>(["amber"]);
    return new Set<TrafficLightStatus>();
  };

  const [activeTypeFilters, setActiveTypeFilters] = useState<Set<string>>(new Set());
  const [activeVatFilter, setActiveVatFilter] = useState<string | null>(null);
  const [activeVatStaggerFilters, setActiveVatStaggerFilters] = useState<Set<string>>(new Set());
  const [activeStatusFilters, setActiveStatusFilters] = useState<Set<TrafficLightStatus>>(getInitialStatusFilters());
  const [pausedFilter, setPausedFilter] = useState<boolean>(initialFilter === "paused");
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(initialFilter ? true : false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [isSendEmailModalOpen, setIsSendEmailModalOpen] = useState(false);
  const [isCsvDialogOpen, setIsCsvDialogOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isBulkStatusModalOpen, setIsBulkStatusModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleImportComplete = () => {
    window.location.reload();
  };

  const handleClientCreated = (newClient: Client) => {
    setData((prev) => [...prev, newClient]);
    router.refresh();
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

  function toggleVatStaggerFilter(stagger: string) {
    setActiveVatStaggerFilters((prev) => {
      const next = new Set(prev);
      if (next.has(stagger)) {
        next.delete(stagger);
      } else {
        next.add(stagger);
      }
      return next;
    });
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
      // VAT stagger filter
      if (activeVatStaggerFilters.size > 0) {
        if (!client.vat_stagger_group || !activeVatStaggerFilters.has(client.vat_stagger_group.toString())) {
          return false;
        }
      }
      // Traffic light status filter
      if (activeStatusFilters.size > 0) {
        const clientStatus = statusMap[client.id]?.status as TrafficLightStatus | undefined;
        if (!clientStatus || !activeStatusFilters.has(clientStatus)) {
          return false;
        }
      }
      // Date range filter for next deadline
      if (dateFrom || dateTo) {
        const nextDeadline = statusMap[client.id]?.next_deadline;
        if (!nextDeadline) return false;

        const deadlineDate = nextDeadline.split('T')[0]; // Get just the date part

        if (dateFrom && deadlineDate < dateFrom) {
          return false;
        }

        if (dateTo && deadlineDate > dateTo) {
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
        case "most-urgent": {
          // Count overdue and waiting statuses for each client
          const filingsA = filingStatusMap[a.id] || [];
          const filingsB = filingStatusMap[b.id] || [];

          const overdueCountA = filingsA.filter(f => !f.is_records_received && f.status === 'red').length;
          const overdueCountB = filingsB.filter(f => !f.is_records_received && f.status === 'red').length;

          // First sort by overdue count (more overdue = more urgent)
          if (overdueCountA !== overdueCountB) {
            return overdueCountB - overdueCountA;
          }

          // If same overdue count, sort by waiting count
          const waitingCountA = filingsA.filter(f => !f.is_records_received && f.status === 'green').length;
          const waitingCountB = filingsB.filter(f => !f.is_records_received && f.status === 'green').length;

          return waitingCountB - waitingCountA;
        }
        case "type-asc":
          return (a.client_type || "").localeCompare(b.client_type || "");
        default:
          return 0;
      }
    });

    return sorted;
  }, [data, activeTypeFilters, activeVatFilter, activeVatStaggerFilters, activeStatusFilters, pausedFilter, statusMap, sortBy, filingStatusMap, dateFrom, dateTo]);

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

  // Handle status update
  const handleStatusUpdate = useCallback(
    async (clientId: string, filingTypeId: string, newStatus: TrafficLightStatus | null) => {
      try {
        if (newStatus === null) {
          // Clear override (revert to calculated)
          await fetch(`/api/clients/${clientId}/filing-status?filing_type_id=${filingTypeId}`, {
            method: 'DELETE',
          });
        } else {
          // Set override
          await fetch(`/api/clients/${clientId}/filing-status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              filing_type_id: filingTypeId,
              override_status: newStatus,
            }),
          });
        }

        toast.success('Status updated');
        router.refresh(); // Refresh to get updated data
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to update status');
      }
    },
    [router]
  );


  // Define status view columns
  const statusColumns = useMemo<ColumnDef<Client>[]>(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <div className="flex items-center justify-center">
            <CheckButton
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
          </div>
        ),
        cell: ({ row }) => (
          <div
            className="flex items-center justify-center cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              row.toggleSelected(!row.getIsSelected());
            }}
          >
            <CheckButton
              checked={row.getIsSelected()}
              onCheckedChange={(value) => row.toggleSelected(!!value)}
              aria-label="Select row"
            />
          </div>
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
            <span className="text-muted-foreground group-hover:text-foreground transition-colors">
              {client.display_name || client.company_name}
            </span>
          );
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
            <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
              {client.client_type || '—'}
            </span>
          );
        },
      },
      // Filing type status columns (one per filing type)
      ...ALL_FILING_TYPES.map((filingTypeId) => ({
        id: filingTypeId,
        header: () => (
          <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            {FILING_TYPE_LABELS[filingTypeId]}
          </span>
        ),
        cell: ({ row }: { row: Row<Client> }) => {
          const client = row.original;
          const filingStatus = filingStatusMap[client.id]?.find(
            (f) => f.filing_type_id === filingTypeId
          );

          if (!filingStatus) {
            return <span className="text-muted-foreground">—</span>;
          }

          if (isEditMode) {
            // Show dropdown in edit mode
            return (
              <StatusDropdown
                clientId={client.id}
                filingTypeId={filingTypeId}
                currentStatus={filingStatus.status}
                isRecordsReceived={filingStatus.is_records_received}
                isOverride={filingStatus.is_override}
                onUpdate={handleStatusUpdate}
              />
            );
          }

          // Show badge in view mode
          return (
            <FilingStatusBadge
              status={filingStatus.status}
              isRecordsReceived={filingStatus.is_records_received}
              isOverride={filingStatus.is_override}
            />
          );
        },
        enableSorting: false,
      })),
    ],
    [filingStatusMap, isEditMode, handleStatusUpdate]
  );

  // Define columns
  const columns = useMemo<ColumnDef<Client>[]>(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <div className="flex items-center justify-center">
            <CheckButton
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
          </div>
        ),
        cell: ({ row }) => (
          <div
            className="flex items-center justify-center cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              row.toggleSelected(!row.getIsSelected());
            }}
          >
            <CheckButton
              checked={row.getIsSelected()}
              onCheckedChange={(value) => row.toggleSelected(!!value)}
              aria-label="Select row"
            />
          </div>
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
                className="text-muted-foreground group-hover:text-foreground transition-colors"
              >
                {client.display_name || client.company_name}
              </span>
              {client.reminders_paused && (
                <div className="mt-1">
                  <Badge variant="outline" className="text-xs border-status-warning text-status-warning">
                    Paused
                  </Badge>
                </div>
              )}
            </div>
          );
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
              isEditMode={isEditMode}
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
              isEditMode={isEditMode}
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
              isEditMode={isEditMode}
              onSave={async (value) => {
                startTransition(async () => {
                  await handleCellEdit(client.id, "vat_stagger_group", value ? parseInt(value as string) : null);
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
              isEditMode={isEditMode}
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
            <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
              {format(new Date(info.next_deadline), "dd MMM yyyy")}
            </span>
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
        id: "deadline_type",
        header: () => (
          <span className="text-sm font-semibold text-foreground/70 uppercase tracking-wide">
            Deadline Type
          </span>
        ),
        cell: ({ row }) => {
          const info = statusMap[row.original.id];
          const typeId = info?.next_deadline_type;
          if (!typeId) return <span className="text-muted-foreground">—</span>;
          return (
            <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
              {FILING_TYPE_LABELS[typeId] || typeId}
            </span>
          );
        },
        enableSorting: false,
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

          const statusConfig: Record<string, { bg: string; text: string; icon: React.ReactNode; label: string }> = {
            red: {
              bg: 'bg-status-danger/10',
              text: 'text-status-danger',
              icon: <XCircle className="h-4 w-4" />,
              label: 'Overdue',
            },
            orange: {
              bg: 'bg-status-critical/10',
              text: 'text-status-critical',
              icon: <AlertCircle className="h-4 w-4" />,
              label: 'Critical',
            },
            amber: {
              bg: 'bg-status-warning/10',
              text: 'text-status-warning',
              icon: <AlertCircle className="h-4 w-4" />,
              label: 'Approaching',
            },
            blue: {
              bg: 'bg-status-info/10',
              text: 'text-status-info',
              icon: <CheckCircle className="h-4 w-4" />,
              label: 'Scheduled',
            },
            green: {
              bg: 'bg-green-500/10',
              text: 'text-green-600',
              icon: <CheckCircle className="h-4 w-4" />,
              label: 'Records Received',
            },
            grey: {
              bg: 'bg-status-neutral/10',
              text: 'text-status-neutral',
              icon: <Minus className="h-4 w-4" />,
              label: 'Inactive',
            },
          };

          const config = statusConfig[info.status] || statusConfig.grey;

          return (
            <div className={`px-3 py-2 rounded-md ${config.bg} inline-flex items-center gap-2`}>
              <span className={config.text}>
                {config.icon}
              </span>
              <span className={`text-sm font-medium ${config.text}`}>
                {config.label}
              </span>
            </div>
          );
        },
        enableSorting: false,
      },
    ],
    [handleCellEdit, statusMap, isEditMode]
  );

  const table = useReactTable({
    data: filteredData,
    columns: viewMode === 'status' ? statusColumns : columns,
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
    activeVatStaggerFilters.size +
    activeStatusFilters.size +
    (pausedFilter ? 1 : 0);

  function clearAllFilters() {
    setActiveTypeFilters(new Set());
    setActiveVatFilter(null);
    setActiveVatStaggerFilters(new Set());
    setActiveStatusFilters(new Set());
    setPausedFilter(false);
    setDateFrom('');
    setDateTo('');
  }

  return (
    <div className="space-y-6 pb-0">
      {/* Page Header with Add Client / Import CSV */}
      <div className="max-w-7xl mx-auto space-y-4">
        {/* Page Header */}
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <h1>Clients</h1>
            <p className="text-muted-foreground">
              Manage your client records and reminder settings
            </p>
          </div>

          {/* View Toggle */}
          <ToggleGroup
            options={[
              { value: 'data', label: 'Client Data' },
              { value: 'status', label: 'Client Deadlines' },
            ]}
            value={viewMode}
            onChange={setViewMode}
            variant="muted"
          />
        </div>

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

        {/* Controls toolbar - Add, Import, Edit, Filter, Sort */}
        <div className="flex gap-2 sm:ml-auto items-center">
          <IconButtonWithText
            type="button"
            variant="green"
            onClick={() => setIsCreateDialogOpen(true)}
            title="Add a new client"
          >
            <Plus className="h-5 w-5" />
            Add Client
          </IconButtonWithText>
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
            variant={isEditMode ? "amber" : "violet"}
            onClick={() => setIsEditMode(!isEditMode)}
            title={isEditMode ? "Exit edit mode" : "Enter edit mode"}
          >
            {isEditMode ? <XIcon className="h-5 w-5" /> : <Pencil className="h-5 w-5" />}
            {isEditMode ? "Done" : "Edit"}
          </IconButtonWithText>
          <IconButtonWithText
            type="button"
            variant={showFilters ? "amber" : "violet"}
            onClick={() => setShowFilters((v) => !v)}
            title={showFilters ? "Close filters" : "Open filters"}
          >
            <SlidersHorizontal className="h-5 w-5" />
            {showFilters ? "Close Filters" : "Filter"}
          </IconButtonWithText>
          <div className="w-px h-6 bg-border mx-1" />
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">Sort by:</span>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="h-9 min-w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="most-urgent">Most Urgent</SelectItem>
                <SelectItem value="name-asc">Name (A-Z)</SelectItem>
                <SelectItem value="name-desc">Name (Z-A)</SelectItem>
                <SelectItem value="deadline-asc">Deadline (Earliest)</SelectItem>
                <SelectItem value="deadline-desc">Deadline (Latest)</SelectItem>
                <SelectItem value="type-asc">Type (A-Z)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Collapsible filter panel */}
      {showFilters && (
        <Card>
          <CardContent className="space-y-4">
            {/* Status and Clear Filters */}
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2 flex-1">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</span>
                <div className="flex flex-wrap gap-2">
                  {(["red", "orange", "amber", "blue", "green", "grey"] as const).map((status) => {
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
              <div className="space-y-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide invisible">Clear</span>
                <IconButtonWithText
                  type="button"
                  variant="destructive"
                  onClick={clearAllFilters}
                  title="Clear all filters"
                >
                  <X className="h-5 w-5" />
                  Clear all filters
                </IconButtonWithText>
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

            {/* VAT Stagger Group */}
            <div className="space-y-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">VAT Stagger Group</span>
              <div className="flex flex-wrap gap-2">
                {VAT_STAGGER_GROUP_OPTIONS.map((opt) => (
                  <ButtonWithText
                    key={opt.value}
                    onClick={() => toggleVatStaggerFilter(opt.value)}
                    isSelected={activeVatStaggerFilters.has(opt.value)}
                    variant="muted"
                  >
                    {opt.label}
                  </ButtonWithText>
                ))}
              </div>
            </div>

            {/* Next Deadline Date Range Filter */}
            <div className="space-y-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Next Deadline Date Range</span>
              <div className="flex flex-wrap gap-4 items-end">
                <div className="flex items-center gap-3">
                  <label className="text-xs text-muted-foreground whitespace-nowrap">From:</label>
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="w-40 hover:border-foreground/20"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <label className="text-xs text-muted-foreground whitespace-nowrap">To:</label>
                  <Input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="w-40 hover:border-foreground/20"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results count */}
      <div className="text-sm font-medium text-foreground/70">
        Showing <span className="font-semibold text-foreground">{table.getRowModel().rows.length}</span> of <span className="font-semibold text-foreground">{data.length}</span> clients
      </div>
      </div>

      {/* Table */}
      <div className="-mx-8 -mb-10 border-y shadow-sm hover:shadow-lg transition-shadow duration-300 bg-white">
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
                    // Don't navigate if in edit mode
                    if (isEditMode) {
                      return;
                    }
                    // Don't navigate if clicking on checkbox/button, input, select, or button elements
                    const target = e.target as HTMLElement;
                    if (
                      target.closest('[role="checkbox"]') ||
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
      <div className="max-w-7xl mx-auto">
      <BulkActionsToolbar
        selectedCount={selectedClients.length}
        onBulkEdit={() => {
          if (viewMode === 'status') {
            setIsBulkStatusModalOpen(true);
          } else {
            setIsBulkModalOpen(true);
          }
        }}
        onSendEmail={() => setIsSendEmailModalOpen(true)}
        onClearSelection={() => setRowSelection({})}
      />
      </div>

      {/* Bulk Edit Modal */}
      <BulkEditModal
        open={isBulkModalOpen}
        onClose={() => setIsBulkModalOpen(false)}
        selectedClients={selectedClients}
        onSave={handleBulkUpdate}
      />

      {/* Bulk Edit Status Modal */}
      <BulkEditStatusModal
        open={isBulkStatusModalOpen}
        onClose={() => setIsBulkStatusModalOpen(false)}
        selectedClients={selectedClients}
        onComplete={() => {
          setRowSelection({});
          router.refresh();
        }}
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

      {/* Create Client Dialog */}
      <CreateClientDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onCreated={handleClientCreated}
      />
    </div>
  );
}
