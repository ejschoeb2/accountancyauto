"use client";

import { useState, useMemo, useCallback, useTransition } from "react";
import dynamic from "next/dynamic";
import { Upload, Pencil, X as XIcon, Plus, Loader2, Trash2, AlertTriangle, XCircle } from "lucide-react";
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

import type { TrafficLightStatus } from "@/lib/dashboard/traffic-light";
import { EditableCell } from "./editable-cell";
import { BulkActionsToolbar } from "./bulk-actions-toolbar";
import { SendEmailModal } from "./send-email-modal";
import { ToggleGroup } from "@/components/ui/toggle-group";
import { StatusDropdown } from "./status-dropdown";
import { FilingStatusBadge } from "./filing-status-badge";
import type { FilingTypeStatus } from "@/lib/types/database";
import type { Row } from "@tanstack/react-table";

// Lazy load the CSV import dialog to avoid hydration issues
const CsvImportDialog = dynamic(() => import("./csv-import-dialog").then(m => ({ default: m.CsvImportDialog })), { ssr: false });
const CreateClientDialog = dynamic(() => import("./create-client-dialog").then(m => ({ default: m.CreateClientDialog })), { ssr: false });
import {
  type Client,
  updateClientMetadata,
  deleteClients,
} from "@/app/actions/clients";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { UpgradeModal } from "@/components/upgrade-modal";
import type { PlanTier } from "@/lib/stripe/plans";

export interface ClientStatusInfo {
  status: string;
  next_deadline: string | null;
  next_deadline_type: string | null;
  underlying_status?: string;
}

import { FILING_TYPE_LABELS, ALL_FILING_TYPE_IDS, FILING_TYPES_BY_CLIENT_TYPE } from '@/lib/constants/filing-types';

interface ClientTableProps {
  initialData: Client[];
  statusMap: Record<string, ClientStatusInfo>;
  filingStatusMap: Record<string, FilingTypeStatus[]>;
  activeFilingTypeIds: string[];
  initialFilter?: string;
  initialSort?: string;
  clientLimit: number | null;
}

// Client type options
const CLIENT_TYPE_OPTIONS = [
  { value: "Limited Company", label: "Limited Company" },
  { value: "Partnership", label: "Partnership" },
  { value: "LLP", label: "LLP" },
  { value: "Individual", label: "Individual" },
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
  violet: "Records Received",
  green: "Completed",
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

export function ClientTable({ initialData, statusMap, filingStatusMap, activeFilingTypeIds, initialFilter, initialSort, clientLimit }: ClientTableProps) {
  const router = useRouter();
  const [data, setData] = useState<Client[]>(initialData);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const validSorts = Object.keys(SORT_LABELS);
  const [sortBy, setSortBy] = useState<string>(
    initialSort && validSorts.includes(initialSort) ? initialSort : "most-urgent"
  );
  type ViewMode = 'data' | 'status';
  const [viewMode, setViewMode] = useState<ViewMode>('data');
  const [deadlineClientType, setDeadlineClientType] = useState<string>('Limited Company');

  // Initialize filters based on initialFilter parameter
  const getInitialStatusFilters = () => {
    const validStatuses: TrafficLightStatus[] = ['red', 'orange', 'amber', 'blue', 'violet', 'green', 'grey'];
    if (initialFilter && validStatuses.includes(initialFilter as TrafficLightStatus)) {
      return new Set<TrafficLightStatus>([initialFilter as TrafficLightStatus]);
    }
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
  const [isSendEmailModalOpen, setIsSendEmailModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isCsvDialogOpen, setIsCsvDialogOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isDeleting, setIsDeleting] = useState(false);
  const [filingToggleLoading, setFilingToggleLoading] = useState<Set<string>>(new Set());

  // Upgrade modal state
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [upgradeLimitData, setUpgradeLimitData] = useState<{
    currentCount: number;
    limit: number;
  } | null>(null);

  // Client limit alerts
  const clientCount = data.length;
  const isAtLimit = clientLimit !== null && clientCount >= clientLimit;
  const isNearLimit = clientLimit !== null && !isAtLimit && clientCount >= clientLimit * 0.85;

  const handleClientCreated = (newClient: Client) => {
    setData((prev) => [...prev, newClient]);
    router.refresh();
  };

  const handleLimitReached = (data: { currentCount: number; limit: number }) => {
    setUpgradeLimitData(data);
    setIsUpgradeModalOpen(true);
  };

  function getNextTierInfo(currentLimit: number): {
    tier: PlanTier;
    name: string;
    price: string;
    limitLabel: string;
  } | null {
    if (currentLimit <= 10)
      return { tier: "solo", name: "Solo", price: "£19", limitLabel: "40 clients" };
    if (currentLimit <= 40)
      return { tier: "starter", name: "Starter", price: "£39", limitLabel: "80 clients" };
    if (currentLimit <= 80)
      return { tier: "practice", name: "Practice", price: "£69", limitLabel: "200 clients" };
    if (currentLimit <= 200)
      return { tier: "firm", name: "Firm", price: "£109", limitLabel: "400 clients" };
    return null;
  }

  function getCurrentTierName(currentLimit: number): string {
    if (currentLimit <= 10) return "Free";
    if (currentLimit <= 40) return "Solo";
    if (currentLimit <= 80) return "Starter";
    if (currentLimit <= 200) return "Practice";
    if (currentLimit <= 400) return "Firm";
    return "Enterprise";
  }

  const handleUpgradeClick = async () => {
    if (!upgradeLimitData) return;
    const nextTier = getNextTierInfo(upgradeLimitData.limit);
    if (!nextTier) return;

    const response = await fetch("/api/stripe/create-checkout-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tier: nextTier.tier }),
    });

    if (response.ok) {
      const { url } = await response.json();
      if (url) {
        window.location.href = url;
      }
    }
  };

  const handleDeleteClients = async () => {
    setIsDeleting(true);
    try {
      const selectedClientIds = selectedClients.map((c) => c.id);
      await deleteClients(selectedClientIds);

      // Remove deleted clients from local state
      setData((prev) => prev.filter((c) => !selectedClientIds.includes(c.id)));
      setRowSelection({});
      setIsDeleteDialogOpen(false);

      toast.success(`Successfully deleted ${selectedClientIds.length} client${selectedClientIds.length !== 1 ? 's' : ''}`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete clients");
    } finally {
      setIsDeleting(false);
    }
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
      // In deadline view, filter by the selected client type
      if (viewMode === 'status' && client.client_type !== deadlineClientType) {
        return false;
      }
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
  }, [data, viewMode, deadlineClientType, activeTypeFilters, activeVatFilter, activeVatStaggerFilters, activeStatusFilters, pausedFilter, statusMap, sortBy, filingStatusMap, dateFrom, dateTo]);

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


  // Handle filing assignment toggle (activate/deactivate a filing type for a client)
  const handleFilingAssignmentToggle = useCallback(
    async (clientId: string, filingTypeId: string, isActive: boolean) => {
      const key = `${clientId}-${filingTypeId}`;
      setFilingToggleLoading((prev) => new Set(prev).add(key));

      try {
        const response = await fetch(`/api/clients/${clientId}/filings`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            assignments: [{ filing_type_id: filingTypeId, is_active: isActive }],
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to update filing assignment');
        }

        toast.success(isActive ? 'Filing activated' : 'Filing deactivated');
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to update');
      } finally {
        setFilingToggleLoading((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      }
    },
    [router]
  );

  // Filing types for the selected client type, filtered to only those activated by the org
  // AND that have at least one client assignment among the filtered rows
  const activeDeadlineFilingTypes = useMemo(() => {
    const orgActive = (FILING_TYPES_BY_CLIENT_TYPE[deadlineClientType] || []).filter(
      (ft) => activeFilingTypeIds.includes(ft)
    );
    // In edit mode, show all org-active filing types so users can activate new ones
    if (isEditMode) {
      return orgActive;
    }
    // Only keep columns where at least one filtered client has a status for that filing type
    return orgActive.filter((ft) =>
      filteredData.some((client) =>
        filingStatusMap[client.id]?.some((f) => f.filing_type_id === ft)
      )
    );
  }, [deadlineClientType, activeFilingTypeIds, filteredData, filingStatusMap, isEditMode]);

  // Define status view columns — only filing types applicable to selected client type
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
            <span className="text-muted-foreground transition-colors">
              {client.display_name || client.company_name}
            </span>
          );
        },
      },
      // Filing type status columns — only those applicable to selected client type
      ...activeDeadlineFilingTypes.map((filingTypeId) => ({
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
          const hasActiveAssignment = !!filingStatus;
          const toggleKey = `${client.id}-${filingTypeId}`;
          const isToggleLoading = filingToggleLoading.has(toggleKey);

          // Edit mode: show toggle checkbox
          if (isEditMode) {
            return (
              <div className="flex items-center justify-center">
                {isToggleLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : (
                  <CheckButton
                    checked={hasActiveAssignment}
                    onCheckedChange={(checked) => {
                      handleFilingAssignmentToggle(client.id, filingTypeId, !!checked);
                    }}
                    variant={hasActiveAssignment ? "success" : "default"}
                  />
                )}
              </div>
            );
          }

          // Paused clients show deadline date + "Paused" badge
          if (client.reminders_paused) {
            if (!filingStatus) {
              return <span className="text-muted-foreground">—</span>;
            }

            return (
              <div className="flex items-center gap-2">
                {filingStatus.deadline_date && (
                  <span className="text-sm text-muted-foreground whitespace-nowrap">
                    {format(new Date(filingStatus.deadline_date), "dd MMM yyyy")}
                  </span>
                )}
                <div className="px-3 py-2 rounded-md bg-status-neutral/10 inline-flex items-center">
                  <span className="text-sm font-medium text-status-neutral">Paused</span>
                </div>
              </div>
            );
          }

          if (!filingStatus) {
            return <span className="text-muted-foreground">—</span>;
          }

          return (
            <div className="flex items-center gap-2">
              {filingStatus.deadline_date && (
                <span className="text-sm text-muted-foreground whitespace-nowrap">
                  {format(new Date(filingStatus.deadline_date), "dd MMM yyyy")}
                </span>
              )}
              <FilingStatusBadge
                status={filingStatus.status}
                isRecordsReceived={filingStatus.is_records_received}
                isOverride={filingStatus.is_override}
              />
            </div>
          );
        },
        enableSorting: false,
      })),
    ],
    [activeDeadlineFilingTypes, filingStatusMap, isEditMode, filingToggleLoading, handleFilingAssignmentToggle]
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
            <span
              className="text-muted-foreground transition-colors"
            >
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
            <span className="text-sm text-muted-foreground transition-colors">
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
            <span className="text-sm text-muted-foreground transition-colors">
              {FILING_TYPE_LABELS[typeId] || typeId}
            </span>
          );
        },
        enableSorting: false,
      },
      {
        id: "reminders_paused",
        header: () => (
          <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Reminders
          </span>
        ),
        cell: ({ row }) => {
          const client = row.original;
          const info = statusMap[client.id];

          // View mode
          if (!isEditMode) {
            if (!client.reminders_paused) {
              return (
                <div className="px-3 py-2 rounded-md bg-green-500/10 inline-flex items-center">
                  <span className="text-sm font-medium text-green-600">Active</span>
                </div>
              );
            }
            return (
              <div className="px-3 py-2 rounded-md bg-status-neutral/10 inline-flex items-center">
                <span className="text-sm font-medium text-status-neutral">Paused</span>
              </div>
            );
          }

          // Edit mode: show select for all clients
          return (
            <EditableCell
              value={client.reminders_paused ? "true" : "false"}
              type="select"
              options={[
                { value: "false", label: "Active" },
                { value: "true", label: "Paused" },
              ]}
              isEditMode={isEditMode}
              onSave={async (value) => {
                const newPaused = value === "true";
                const previousData = [...data];
                setData((prev) =>
                  prev.map((c) =>
                    c.id === client.id ? { ...c, reminders_paused: newPaused } : c
                  )
                );
                try {
                  const response = await fetch(`/api/clients/${client.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ reminders_paused: newPaused }),
                  });
                  if (!response.ok) throw new Error('Failed to update reminders status');
                  toast.success(newPaused ? 'Reminders paused' : 'Reminders resumed');
                } catch (error) {
                  setData(previousData);
                  toast.error(error instanceof Error ? error.message : 'Failed to update');
                }
              }}
            />
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
          const client = row.original;
          const info = statusMap[client.id];

          // Paused clients show "Paused" badge
          if (client.reminders_paused) {
            return (
              <div className="px-3 py-2 rounded-md bg-status-neutral/10 inline-flex items-center">
                <span className="text-sm font-medium text-status-neutral">Paused</span>
              </div>
            );
          }

          // No status info or grey (no filings) — show dash
          if (!info || info.status === 'grey') return <span className="text-muted-foreground">—</span>;

          const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
            red: {
              bg: 'bg-status-danger/10',
              text: 'text-status-danger',
              label: 'Overdue',
            },
            orange: {
              bg: 'bg-status-critical/10',
              text: 'text-status-critical',
              label: 'Critical',
            },
            amber: {
              bg: 'bg-status-warning/10',
              text: 'text-status-warning',
              label: 'Approaching',
            },
            blue: {
              bg: 'bg-status-info/10',
              text: 'text-status-info',
              label: 'Scheduled',
            },
            violet: {
              bg: 'bg-violet-500/10',
              text: 'text-violet-600',
              label: 'Records Received',
            },
            green: {
              bg: 'bg-green-500/10',
              text: 'text-green-600',
              label: 'Completed',
            },
          };

          const config = statusConfig[info.status];
          if (!config) return <span className="text-muted-foreground">—</span>;

          return (
            <div className={`px-3 py-2 rounded-md ${config.bg} inline-flex items-center`}>
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
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
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
            placeholder="Search by client name..."
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

        {/* Controls toolbar — swaps between data actions and deadline client type picker */}
        <div className="flex gap-2 sm:ml-auto items-center">
          {viewMode === 'data' ? (
            <>
              <IconButtonWithText
                type="button"
                variant="green"
                onClick={() => setIsCreateDialogOpen(true)}
                title={isAtLimit ? "Client limit reached — upgrade your plan" : "Add a new client"}
                disabled={isAtLimit}
              >
                <Plus className="h-5 w-5" />
                Add Client
              </IconButtonWithText>
              <IconButtonWithText
                type="button"
                variant="sky"
                onClick={() => setIsCsvDialogOpen(true)}
                title={isAtLimit ? "Client limit reached — upgrade your plan" : "Import clients from CSV"}
                disabled={isAtLimit}
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
            </>
          ) : (
            <>
              <IconButtonWithText
                type="button"
                variant={isEditMode ? "amber" : "violet"}
                onClick={() => setIsEditMode(!isEditMode)}
                title={isEditMode ? "Exit edit mode" : "Enter edit mode"}
              >
                {isEditMode ? <XIcon className="h-5 w-5" /> : <Pencil className="h-5 w-5" />}
                {isEditMode ? "Done" : "Edit"}
              </IconButtonWithText>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-muted-foreground">Client type:</span>
                <Select value={deadlineClientType} onValueChange={(v) => { setDeadlineClientType(v); setRowSelection({}); }}>
                  <SelectTrigger className="h-9 min-w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CLIENT_TYPE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
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
                  {(["red", "orange", "amber", "blue", "violet", "green", "grey"] as const).map((status) => {
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

      {/* Client limit alerts */}
      {isAtLimit && (
        <div className="flex items-center gap-3 p-4 bg-red-500/10 rounded-xl">
          <XCircle className="size-5 text-red-500 shrink-0" />
          <p className="text-sm text-red-500">
            You&apos;ve reached your plan limit of {clientLimit} clients. <a href="/settings?tab=billing" className="underline font-medium hover:text-red-600">Upgrade your plan</a> to add more.
          </p>
        </div>
      )}
      {isNearLimit && (
        <div className="flex items-center gap-3 p-4 bg-amber-500/10 rounded-xl">
          <AlertTriangle className="size-5 text-amber-600 shrink-0" />
          <p className="text-sm text-amber-600">
            You&apos;re using {clientCount} of {clientLimit} clients on your plan. <a href="/settings?tab=billing" className="underline font-medium hover:text-amber-700">Upgrade</a> to add more capacity.
          </p>
        </div>
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
                  className="group cursor-pointer hover:bg-muted/50 transition-colors"
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
          onSendEmail={() => setIsSendEmailModalOpen(true)}
          onDeleteClients={() => setIsDeleteDialogOpen(true)}
          onClearSelection={() => setRowSelection({})}
        />
      </div>

      {/* Send Email Modal */}
      <SendEmailModal
        open={isSendEmailModalOpen}
        onClose={() => setIsSendEmailModalOpen(false)}
        selectedClients={selectedClients}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={() => {}}>
        <DialogContent className="[&>button]:hidden">
          <DialogHeader>
            <DialogTitle>Delete Clients</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {selectedClients.length} client{selectedClients.length !== 1 ? 's' : ''}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <IconButtonWithText
              variant="violet"
              onClick={() => setIsDeleteDialogOpen(false)}
              disabled={isDeleting}
            >
              <XIcon className="h-5 w-5" />
              Cancel
            </IconButtonWithText>
            <IconButtonWithText
              variant="destructive"
              onClick={handleDeleteClients}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-5 w-5" />
                  Delete
                </>
              )}
            </IconButtonWithText>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CSV Import Dialog */}
      <CsvImportDialog
        open={isCsvDialogOpen}
        onOpenChange={setIsCsvDialogOpen}
      />

      {/* Create Client Dialog */}
      <CreateClientDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onCreated={handleClientCreated}
        onLimitReached={handleLimitReached}
      />

      {/* Upgrade Modal — shown when client limit is reached */}
      {upgradeLimitData && (() => {
        const nextTier = getNextTierInfo(upgradeLimitData.limit);
        if (!nextTier) return null;
        return (
          <UpgradeModal
            open={isUpgradeModalOpen}
            onOpenChange={setIsUpgradeModalOpen}
            currentCount={upgradeLimitData.currentCount}
            currentLimit={upgradeLimitData.limit}
            currentTierName={getCurrentTierName(upgradeLimitData.limit)}
            nextTierName={nextTier.name}
            nextTierPrice={nextTier.price}
            nextTierLimit={nextTier.limitLabel}
            onUpgrade={handleUpgradeClick}
          />
        );
      })()}
    </div>
  );
}
