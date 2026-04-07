"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { Upload, Pencil, X as XIcon, Plus, Loader2, AlertTriangle, XCircle, CircleCheck, CircleMinus, ClipboardCheck, Info } from "lucide-react";
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
import { toast } from "sonner";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CheckButton } from "@/components/ui/check-button";
import { IconButtonWithText } from "@/components/ui/icon-button-with-text";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { TrafficLightStatus } from "@/lib/dashboard/traffic-light";
import { calculateFilingTypeStatus } from "@/lib/dashboard/traffic-light";
import { EditableCell } from "./editable-cell";
import { BulkActionsToolbar } from "./bulk-actions-toolbar";
import { ToggleGroup } from "@/components/ui/toggle-group";
import { FilingStatusBadge, DocProgressRing } from "./filing-status-badge";
import type { FilingTypeStatus } from "@/lib/types/database";
import type { Row } from "@tanstack/react-table";
import { type Client } from "@/app/actions/clients";
import { FILING_TYPE_LABELS, FILING_TYPES_BY_CLIENT_TYPE } from "@/lib/constants/filing-types";
import { markProgressReviewed } from "@/app/actions/settings";

// Extracted components and hooks
import { useClientTableFilters, CLIENT_TYPE_OPTIONS, type ViewMode } from "./use-client-table-filters";
import { SearchBar, FilterToggle, FilterPanel } from "./client-table-filters";
import { useClientTableModals, ClientTableModals } from "./client-table-modals";
import { useClientProgressEdit } from "./client-progress-edit";

export interface ClientStatusInfo {
  status: string;
  next_deadline: string | null;
  next_deadline_type: string | null;
  underlying_status?: string;
  total_doc_received: number;
  total_doc_required: number;
}

type DeadlineEditMode = 'status' | 'progress' | null;

interface ClientTableProps {
  initialData: Client[];
  statusMap: Record<string, ClientStatusInfo>;
  filingStatusMap: Record<string, FilingTypeStatus[]>;
  activeFilingTypeIds: string[];
  initialFilter?: string;
  initialSort?: string;
  initialView?: ViewMode;
  initialEditProgress?: boolean;
  clientLimit: number | null;
  progressReviewed: boolean;
}

export function ClientTable({ initialData, statusMap, filingStatusMap, activeFilingTypeIds, initialFilter, initialSort, initialView, initialEditProgress, clientLimit, progressReviewed }: ClientTableProps) {
  const router = useRouter();
  const [data, setData] = useState<Client[]>(initialData);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [sorting, setSorting] = useState<SortingState>([]);
  const [viewMode, setViewMode] = useState<ViewMode>(initialView ?? 'status');
  const [isProgressReviewed, setIsProgressReviewed] = useState(progressReviewed);
  const [deadlineClientType, setDeadlineClientType] = useState<string>('Limited Company');
  const [deadlineEditMode, setDeadlineEditMode] = useState<DeadlineEditMode>(initialEditProgress ? 'progress' : null);
  const [filingToggleLoading, setFilingToggleLoading] = useState<Set<string>>(new Set());

  // Local filing status overrides -- tracks changes made via edit progress mode
  const [localFilingStatusMap, setLocalFilingStatusMap] = useState<Record<string, FilingTypeStatus[]>>(filingStatusMap);

  // Sync local state when props change (e.g. after router.refresh())
  useEffect(() => {
    setLocalFilingStatusMap(prev => prev === filingStatusMap ? prev : filingStatusMap);
  }, [filingStatusMap]);
  useEffect(() => {
    setData(prev => prev === initialData ? prev : initialData);
  }, [initialData]);

  // Derive overall client status from localFilingStatusMap so data view stays in sync
  const localStatusMap = useMemo<Record<string, ClientStatusInfo>>(() => {
    const result: Record<string, ClientStatusInfo> = {};
    for (const client of data) {
      const filings = localFilingStatusMap[client.id] ?? [];

      if (client.reminders_paused || filings.length === 0) {
        const docReceived = filings.reduce((sum, f) => sum + (f.doc_received_count || 0), 0);
        const docRequired = filings.reduce((sum, f) => sum + (f.doc_required_count || 0), 0);
        result[client.id] = {
          status: client.reminders_paused ? 'grey' : (statusMap[client.id]?.status ?? 'grey'),
          next_deadline: statusMap[client.id]?.next_deadline ?? null,
          next_deadline_type: statusMap[client.id]?.next_deadline_type ?? null,
          underlying_status: statusMap[client.id]?.underlying_status,
          total_doc_received: docReceived,
          total_doc_required: docRequired,
        };
        continue;
      }

      const filingsWithDeadlines = filings.filter(f => f.deadline_date);
      const earliest = filingsWithDeadlines.length > 0
        ? filingsWithDeadlines.reduce((e, f) => f.deadline_date! < e.deadline_date! ? f : e, filingsWithDeadlines[0])
        : null;

      const urgencyOrder = ['red', 'orange', 'amber'] as const;
      let urgentStatus: string | null = null;
      for (const level of urgencyOrder) {
        if (filings.some(f => f.status === level)) {
          urgentStatus = level;
          break;
        }
      }

      let status: string;
      if (urgentStatus) {
        status = urgentStatus;
      } else if (filings.every(f => f.status === 'green')) {
        status = 'green';
      } else if (filings.every(f => f.is_records_received)) {
        status = 'violet';
      } else if (earliest && filings.find(f => f.filing_type_id === earliest.filing_type_id)?.is_records_received) {
        status = 'violet';
      } else {
        status = 'blue';
      }

      const docReceived = filings.reduce((sum, f) => sum + (f.doc_received_count || 0), 0);
      const docRequired = filings.reduce((sum, f) => sum + (f.doc_required_count || 0), 0);

      result[client.id] = {
        status,
        next_deadline: earliest?.deadline_date ?? statusMap[client.id]?.next_deadline ?? null,
        next_deadline_type: earliest?.filing_type_id ?? statusMap[client.id]?.next_deadline_type ?? null,
        underlying_status: statusMap[client.id]?.underlying_status,
        total_doc_received: docReceived,
        total_doc_required: docRequired,
      };
    }
    return result;
  }, [data, localFilingStatusMap, statusMap]);

  // --- Filters hook ---
  const filters = useClientTableFilters({
    data,
    localStatusMap,
    initialFilter,
    initialSort,
    viewMode,
    deadlineClientType,
    setDeadlineClientType,
  });

  // --- Progress edit hook ---
  const { docRequirements, manuallyReceivedMap, handleDocumentToggle } = useClientProgressEdit({
    deadlineEditMode,
  });

  // --- Client limit alerts ---
  const clientCount = data.length;
  const isAtLimit = clientLimit !== null && clientCount >= clientLimit;
  const isNearLimit = clientLimit !== null && !isAtLimit && clientCount >= Math.floor(clientLimit * 0.95);

  // Detect client types with no applicable active filing types
  const clientTypesWithNoFilings = useMemo(() => {
    const typesInData = new Set(data.map(c => c.client_type).filter(Boolean) as string[]);
    const activeSet = new Set(activeFilingTypeIds);
    return [...typesInData].filter(type => {
      const applicable = FILING_TYPES_BY_CLIENT_TYPE[type] ?? [];
      return !applicable.some(id => activeSet.has(id));
    });
  }, [data, activeFilingTypeIds]);

  // --- Selected clients ---
  const selectedClients = useMemo(() => {
    return Object.keys(rowSelection)
      .map((idx) => filters.filteredData[parseInt(idx)])
      .filter(Boolean);
  }, [rowSelection, filters.filteredData]);

  // --- Modals hook ---
  const modals = useClientTableModals(setData, setRowSelection, selectedClients);

  // --- Status update handler ---
  const handleStatusUpdate = useCallback(
    async (clientId: string, filingTypeId: string, newStatus: TrafficLightStatus | null) => {
      try {
        if (newStatus === null) {
          await fetch(`/api/clients/${clientId}/filing-status?filing_type_id=${filingTypeId}`, { method: 'DELETE' });
        } else {
          await fetch(`/api/clients/${clientId}/filing-status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filing_type_id: filingTypeId, override_status: newStatus }),
          });
        }
        toast.success('Status updated');
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to update status');
      }
    },
    [router]
  );

  // --- Filing assignment toggle handler ---
  const handleFilingAssignmentToggle = useCallback(
    async (clientId: string, filingTypeId: string, isActive: boolean) => {
      const key = `${clientId}-${filingTypeId}`;
      setFilingToggleLoading((prev) => new Set(prev).add(key));

      let removedEntry: FilingTypeStatus | null = null;
      setLocalFilingStatusMap(prev => {
        const next = { ...prev };
        const clientStatuses = [...(next[clientId] ?? [])];
        if (isActive) {
          if (!clientStatuses.some(f => f.filing_type_id === filingTypeId)) {
            clientStatuses.push({
              filing_type_id: filingTypeId as FilingTypeStatus['filing_type_id'],
              status: 'blue',
              is_override: false,
              is_records_received: false,
              deadline_date: null,
              doc_received_count: 0,
              doc_required_count: 0,
              next_email_date: null,
            });
          }
        } else {
          const idx = clientStatuses.findIndex(f => f.filing_type_id === filingTypeId);
          if (idx >= 0) {
            removedEntry = clientStatuses[idx];
            clientStatuses.splice(idx, 1);
          }
        }
        next[clientId] = clientStatuses;
        return next;
      });

      try {
        const response = await fetch(`/api/clients/${clientId}/filings`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ assignments: [{ filing_type_id: filingTypeId, is_active: isActive }] }),
        });
        if (!response.ok) throw new Error('Failed to update filing assignment');
        toast.success(isActive ? 'Filing activated' : 'Filing deactivated');
        router.refresh();
      } catch (error) {
        setLocalFilingStatusMap(prev => {
          const next = { ...prev };
          const clientStatuses = [...(next[clientId] ?? [])];
          if (isActive) {
            const idx = clientStatuses.findIndex(f => f.filing_type_id === filingTypeId);
            if (idx >= 0) clientStatuses.splice(idx, 1);
          } else if (removedEntry) {
            clientStatuses.push(removedEntry);
          }
          next[clientId] = clientStatuses;
          return next;
        });
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
  const activeDeadlineFilingTypes = useMemo(() => {
    const orgActive = (FILING_TYPES_BY_CLIENT_TYPE[deadlineClientType] || []).filter(
      (ft) => activeFilingTypeIds.includes(ft)
    );
    if (deadlineEditMode !== null) return orgActive;
    return orgActive.filter((ft) =>
      filters.filteredData.some((client) =>
        localFilingStatusMap[client.id]?.some((f) => f.filing_type_id === ft)
      )
    );
  }, [deadlineClientType, activeFilingTypeIds, filters.filteredData, localFilingStatusMap, deadlineEditMode]);

  // --- Column definitions ---
  const statusColumns = useMemo<ColumnDef<Client>[]>(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <div className="flex items-center justify-center">
            <CheckButton
              checked={table.getIsAllPageRowsSelected() ? true : table.getIsSomePageRowsSelected() ? "indeterminate" : false}
              onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
              aria-label="Select all"
            />
          </div>
        ),
        cell: ({ row }) => (
          <div className="flex items-center justify-center cursor-pointer" onClick={(e) => { e.stopPropagation(); row.toggleSelected(!row.getIsSelected()); }}>
            <CheckButton checked={row.getIsSelected()} onCheckedChange={(value) => row.toggleSelected(!!value)} aria-label="Select row" />
          </div>
        ),
        enableSorting: false,
        enableHiding: false,
      },
      {
        accessorKey: "display_name",
        header: () => <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Client Name</span>,
        cell: ({ row }) => <span className="text-muted-foreground transition-colors">{row.original.display_name || row.original.company_name}</span>,
      },
      {
        id: "reminders_paused_status",
        header: () => <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Reminders</span>,
        cell: ({ row }: { row: Row<Client> }) => {
          const client = row.original;
          if (deadlineEditMode === 'status') {
            return (
              <EditableCell
                value={client.reminders_paused ? "true" : "false"}
                type="select"
                options={[{ value: "false", label: "Active" }, { value: "true", label: "Paused" }]}
                isEditMode={true}
                onSave={async (value) => {
                  const newPaused = value === "true";
                  const previousData = [...data];
                  setData((prev) => prev.map((c) => c.id === client.id ? { ...c, reminders_paused: newPaused } : c));
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
          }
          if (!client.reminders_paused) {
            return (<div className="px-3 py-2 rounded-md bg-green-500/10 inline-flex items-center"><span className="text-sm font-medium text-green-600">Active</span></div>);
          }
          return (<div className="px-3 py-2 rounded-md bg-status-neutral/10 inline-flex items-center"><span className="text-sm font-medium text-status-neutral">Paused</span></div>);
        },
        enableSorting: false,
      },
      ...activeDeadlineFilingTypes.map((filingTypeId) => ({
        id: filingTypeId,
        header: () => <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{FILING_TYPE_LABELS[filingTypeId]}</span>,
        cell: ({ row }: { row: Row<Client> }) => {
          const client = row.original;
          const filingStatus = localFilingStatusMap[client.id]?.find((f) => f.filing_type_id === filingTypeId);
          const hasActiveAssignment = !!filingStatus;
          const toggleKey = `${client.id}-${filingTypeId}`;
          const isToggleLoading = filingToggleLoading.has(toggleKey);

          if (deadlineEditMode === 'status') {
            return (
              <div className="flex items-center">
                {isToggleLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : (
                  <Select
                    value={hasActiveAssignment ? "active" : "inactive"}
                    onValueChange={(value) => {
                      const newActive = value === "active";
                      if (newActive === hasActiveAssignment) return;
                      if (!newActive) {
                        const skipConfirm = localStorage.getItem('skip-deactivate-filing-confirm') === 'true';
                        if (skipConfirm) {
                          handleFilingAssignmentToggle(client.id, filingTypeId, false);
                        } else {
                          modals.setDeactivateConfirm({ clientId: client.id, filingTypeId });
                        }
                      } else {
                        handleFilingAssignmentToggle(client.id, filingTypeId, true);
                      }
                    }}
                  >
                    <SelectTrigger className="h-9 min-w-[160px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active"><span className="flex items-center gap-1.5"><CircleCheck className="h-4 w-4 text-green-600" />Deadline Active</span></SelectItem>
                      <SelectItem value="inactive"><span className="flex items-center gap-1.5"><CircleMinus className="h-4 w-4 text-muted-foreground" />Deadline Inactive</span></SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
            );
          }

          if (deadlineEditMode === 'progress') {
            if (!hasActiveAssignment) return <span className="text-muted-foreground">—</span>;
            const requirements = docRequirements[filingTypeId] ?? [];
            if (requirements.length === 0) return <span className="text-muted-foreground text-xs">No docs required</span>;
            const key = `${client.id}-${filingTypeId}`;
            const receivedSet = manuallyReceivedMap[key] ?? new Set();
            return (
              <div className="flex flex-col gap-1">
                {requirements.map((req) => {
                  const isReceived = receivedSet.has(req.document_type_id);
                  return (
                    <label key={req.document_type_id} className="flex items-center gap-2 cursor-pointer group">
                      <CheckButton checked={isReceived} onCheckedChange={() => handleDocumentToggle(client.id, filingTypeId, req.document_type_id, isReceived, setLocalFilingStatusMap)} />
                      <span className={`text-xs ${isReceived ? 'text-muted-foreground line-through' : 'text-foreground'}`}>{req.label}</span>
                    </label>
                  );
                })}
              </div>
            );
          }

          if (client.reminders_paused) {
            if (!filingStatus) return <span className="text-muted-foreground">—</span>;
            return (
              <div className="flex flex-col gap-1.5" data-filing-type={filingTypeId}>
                {filingStatus.deadline_date && (<div className="text-sm whitespace-nowrap"><span className="text-muted-foreground">Deadline: </span><span className="text-foreground/70">{format(new Date(filingStatus.deadline_date), "dd/MM/yyyy")}</span></div>)}
                {!filingStatus.is_records_received && (<div className="text-sm whitespace-nowrap"><span className="text-muted-foreground">Next Email: </span><span className="text-foreground/70">Paused</span></div>)}
                <div className="px-3 py-2 rounded-md bg-status-neutral/10 text-status-neutral inline-flex items-center gap-2 w-fit">
                  <span className="text-sm font-medium">Paused</span>
                  {filingStatus.doc_required_count > 0 && (<DocProgressRing received={filingStatus.doc_received_count} required={filingStatus.doc_required_count} colorClass="text-status-neutral" />)}
                </div>
              </div>
            );
          }

          if (!filingStatus) return <span className="text-muted-foreground">—</span>;
          return (
            <div className="flex flex-col gap-1.5" data-filing-type={filingTypeId}>
              {filingStatus.deadline_date && (<div className="text-sm whitespace-nowrap"><span className="text-muted-foreground">Deadline: </span><span className="text-foreground/70">{format(new Date(filingStatus.deadline_date), "dd/MM/yyyy")}</span></div>)}
              {!filingStatus.is_records_received && (<div className="text-sm whitespace-nowrap"><span className="text-muted-foreground">Next Email: </span><span className="text-foreground/70">{filingStatus.next_email_date ? format(new Date(filingStatus.next_email_date), "dd/MM/yyyy") : "None scheduled"}</span></div>)}
              <div><FilingStatusBadge status={filingStatus.status} isRecordsReceived={filingStatus.is_records_received} isOverride={filingStatus.is_override} docReceived={filingStatus.doc_received_count} docRequired={filingStatus.doc_required_count} /></div>
            </div>
          );
        },
        enableSorting: false,
      })),
    ],
    [activeDeadlineFilingTypes, localFilingStatusMap, deadlineEditMode, filingToggleLoading, handleFilingAssignmentToggle, docRequirements, manuallyReceivedMap, handleDocumentToggle, data, modals]
  );

  const columns = useMemo<ColumnDef<Client>[]>(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <div className="flex items-center justify-center">
            <CheckButton checked={table.getIsAllPageRowsSelected() ? true : table.getIsSomePageRowsSelected() ? "indeterminate" : false} onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)} aria-label="Select all" />
          </div>
        ),
        cell: ({ row }) => (
          <div className="flex items-center justify-center cursor-pointer" onClick={(e) => { e.stopPropagation(); row.toggleSelected(!row.getIsSelected()); }}>
            <CheckButton checked={row.getIsSelected()} onCheckedChange={(value) => row.toggleSelected(!!value)} aria-label="Select row" />
          </div>
        ),
        enableSorting: false,
        enableHiding: false,
      },
      {
        accessorKey: "display_name",
        header: () => <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Client Name</span>,
        cell: ({ row }) => <span className="text-muted-foreground transition-colors">{row.original.display_name || row.original.company_name}</span>,
      },
      {
        accessorKey: "client_type",
        header: () => <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Client Type</span>,
        cell: ({ row }) => {
          const option = CLIENT_TYPE_OPTIONS.find((opt) => opt.value === row.original.client_type);
          return <span className="text-muted-foreground">{option?.label || row.original.client_type || "\u2014"}</span>;
        },
      },
      {
        accessorKey: "vat_registered",
        header: () => <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">VAT Registered</span>,
        cell: ({ row }) => row.original.vat_registered
          ? (<div className="px-3 py-2 rounded-md bg-green-500/10 inline-flex items-center"><span className="text-sm font-medium text-green-600">Yes</span></div>)
          : (<div className="px-3 py-2 rounded-md bg-status-danger/10 inline-flex items-center"><span className="text-sm font-medium text-status-danger">No</span></div>),
      },
      {
        accessorKey: "vat_stagger_group",
        header: () => <span className="text-sm font-semibold text-foreground/70 uppercase tracking-wide">VAT Stagger</span>,
        cell: ({ row }) => {
          const client = row.original;
          if (!client.vat_registered) return <span className="text-muted-foreground">{"\u2014"}</span>;
          const VAT_STAGGER_GROUP_OPTIONS = [
            { value: "1", label: "Stagger 1 (Mar/Jun/Sep/Dec)" },
            { value: "2", label: "Stagger 2 (Jan/Apr/Jul/Oct)" },
            { value: "3", label: "Stagger 3 (Feb/May/Aug/Nov)" },
          ];
          const option = VAT_STAGGER_GROUP_OPTIONS.find((opt) => opt.value === client.vat_stagger_group?.toString());
          return <span className="text-muted-foreground">{option?.label || "\u2014"}</span>;
        },
      },
      {
        accessorKey: "year_end_date",
        header: () => <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Year End</span>,
        cell: ({ row }) => {
          const client = row.original;
          if (!client.year_end_date) return <span className="text-muted-foreground">{"\u2014"}</span>;
          try { return <span className="text-muted-foreground">{format(new Date(client.year_end_date), "d MMM yyyy")}</span>; }
          catch { return <span className="text-muted-foreground">{client.year_end_date}</span>; }
        },
      },
      {
        id: "next_deadline",
        header: () => <span className="text-sm font-semibold text-foreground/70 uppercase tracking-wide">Next Deadline</span>,
        cell: ({ row }) => {
          const info = localStatusMap[row.original.id];
          if (!info?.next_deadline) return <span className="text-muted-foreground">{"\u2014"}</span>;
          return <span className="text-sm text-muted-foreground transition-colors">{format(new Date(info.next_deadline), "dd MMM yyyy")}</span>;
        },
        sortingFn: (rowA, rowB) => {
          const a = localStatusMap[rowA.original.id]?.next_deadline;
          const b = localStatusMap[rowB.original.id]?.next_deadline;
          if (!a && !b) return 0;
          if (!a) return 1;
          if (!b) return -1;
          return a.localeCompare(b);
        },
      },
      {
        id: "deadline_type",
        header: () => <span className="text-sm font-semibold text-foreground/70 uppercase tracking-wide">Deadline Type</span>,
        cell: ({ row }) => {
          const info = localStatusMap[row.original.id];
          const typeId = info?.next_deadline_type;
          if (!typeId) return <span className="text-muted-foreground">{"\u2014"}</span>;
          return <span className="text-sm text-muted-foreground transition-colors">{FILING_TYPE_LABELS[typeId] || typeId}</span>;
        },
        enableSorting: false,
      },
      {
        id: "reminders_paused",
        header: () => <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Reminders</span>,
        cell: ({ row }) => {
          if (!row.original.reminders_paused) {
            return (<div className="px-3 py-2 rounded-md bg-green-500/10 inline-flex items-center"><span className="text-sm font-medium text-green-600">Active</span></div>);
          }
          return (<div className="px-3 py-2 rounded-md bg-status-neutral/10 inline-flex items-center"><span className="text-sm font-medium text-status-neutral">Paused</span></div>);
        },
        enableSorting: false,
      },
      {
        id: "status",
        header: () => <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Status</span>,
        cell: ({ row }) => {
          const client = row.original;
          const info = localStatusMap[client.id];
          if (client.reminders_paused) {
            return (<div className="px-3 py-2 rounded-md bg-status-neutral/10 inline-flex items-center"><span className="text-sm font-medium text-status-neutral">Paused</span></div>);
          }
          if (!info || info.status === 'grey') return <span className="text-muted-foreground">{"\u2014"}</span>;
          return (
            <FilingStatusBadge
              status={info.status as import("@/lib/dashboard/traffic-light").TrafficLightStatus}
              isRecordsReceived={false}
              isOverride={false}
              docReceived={info.total_doc_received}
              docRequired={info.total_doc_required}
            />
          );
        },
        enableSorting: false,
      },
    ],
    [localStatusMap]
  );

  const table = useReactTable({
    data: filters.filteredData,
    columns: viewMode === 'status' ? statusColumns : columns,
    state: { rowSelection, sorting, globalFilter: filters.globalFilter },
    globalFilterFn: (row, _columnId, filterValue) => {
      const search = (filterValue as string).toLowerCase();
      const name = (row.original.display_name || row.original.company_name || "").toLowerCase();
      const company = (row.original.company_name || "").toLowerCase();
      return name.includes(search) || company.includes(search);
    },
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onGlobalFilterChange: filters.setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="space-y-6 pb-0">
      {/* Page Header with Add Client / Import CSV */}
      <div className="max-w-7xl mx-auto space-y-4">
        {/* Page Header */}
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <h1>Clients</h1>
            <p className="text-muted-foreground">Manage your client records and reminder settings</p>
          </div>
          <div className="flex flex-col items-end gap-4">
            <ToggleGroup
              options={[{ value: 'data', label: 'Client Data' }, { value: 'status', label: 'Client Deadlines' }]}
              value={viewMode}
              onChange={setViewMode}
              variant="muted"
            />
            {viewMode === 'status' && (
              <ToggleGroup
                options={CLIENT_TYPE_OPTIONS.map(opt => ({ value: opt.value, label: opt.label }))}
                value={deadlineClientType}
                onChange={(v) => { setDeadlineClientType(v); setRowSelection({}); }}
                variant="muted"
              />
            )}
          </div>
        </div>

        {/* Progress review alert */}
        {viewMode === 'status' && !isProgressReviewed && (
          <div className="flex items-center gap-3 p-4 bg-amber-500/10 rounded-xl">
            <AlertTriangle className="size-5 text-amber-600 shrink-0" />
            <p className="text-sm text-amber-600">Review client progress before sending reminders to avoid incorrect notifications</p>
          </div>
        )}

        {/* Client limit alerts */}
        {isAtLimit && (
          <div className="flex items-center gap-3 p-4 bg-red-500/10 rounded-xl">
            <XCircle className="size-5 text-red-500 shrink-0" />
            <p className="text-sm text-red-500">You&apos;ve reached your plan limit of {clientLimit} clients. <a href="/settings?tab=billing" className="underline font-medium hover:text-red-600">Upgrade your plan</a> to add more.</p>
          </div>
        )}
        {isNearLimit && (
          <div className="flex items-center gap-3 p-4 bg-amber-500/10 rounded-xl">
            <AlertTriangle className="size-5 text-amber-600 shrink-0" />
            <p className="text-sm text-amber-600">You&apos;re using {clientCount} of {clientLimit} clients on your plan. <a href="/settings?tab=billing" className="underline font-medium hover:text-amber-700">Upgrade</a> to add more capacity.</p>
          </div>
        )}
        {clientTypesWithNoFilings.length > 0 && (
          <div className="flex items-center gap-3 p-4 bg-status-info/10 rounded-xl">
            <Info className="size-5 text-status-info shrink-0" />
            <p className="text-sm text-status-info">You have {clientTypesWithNoFilings.join(', ')} clients but no deadlines are enabled for {clientTypesWithNoFilings.length === 1 ? 'this type' : 'these types'}. <a href="/settings?tab=deadlines" className="underline font-medium hover:text-blue-700">Enable deadlines</a> to track their filings.</p>
          </div>
        )}

        {/* Search Input and Controls */}
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
          {/* Search Input */}
          <SearchBar
            globalFilter={filters.globalFilter}
            setGlobalFilter={filters.setGlobalFilter}
          />

          {/* Controls toolbar */}
          <div className="flex gap-2 sm:ml-auto items-start">
            {viewMode === 'data' ? (
              <>
                <IconButtonWithText type="button" variant="green" onClick={() => modals.setIsCreateDialogOpen(true)} title={isAtLimit ? "Client limit reached \u2014 upgrade your plan" : "Add a new client"} disabled={isAtLimit}>
                  <Plus className="h-5 w-5" />Add Client
                </IconButtonWithText>
                <IconButtonWithText type="button" variant="sky" onClick={() => modals.setIsCsvDialogOpen(true)} title={isAtLimit ? "Client limit reached \u2014 upgrade your plan" : "Import clients from CSV"} disabled={isAtLimit}>
                  <Upload className="h-5 w-5" />Import CSV
                </IconButtonWithText>
                <FilterToggle showFilters={filters.showFilters} setShowFilters={filters.setShowFilters} />
                <div className="w-px h-6 bg-border mx-1" />
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-muted-foreground">Sort by:</span>
                  <Select value={filters.sortBy} onValueChange={filters.setSortBy}>
                    <SelectTrigger className="h-9 min-w-[180px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
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
                <IconButtonWithText type="button" variant={deadlineEditMode === 'status' ? "amber" : "violet"} onClick={() => setDeadlineEditMode(deadlineEditMode === 'status' ? null : 'status')} title={deadlineEditMode === 'status' ? "Exit edit status mode" : "Edit deadline status"}>
                  {deadlineEditMode === 'status' ? <XIcon className="h-5 w-5" /> : <Pencil className="h-5 w-5" />}
                  {deadlineEditMode === 'status' ? "Done" : "Edit Status"}
                </IconButtonWithText>
                <IconButtonWithText
                  type="button"
                  variant={deadlineEditMode === 'progress' ? "amber" : "violet"}
                  onClick={async () => {
                    if (deadlineEditMode === 'progress') {
                      setDeadlineEditMode(null);
                      if (!isProgressReviewed) {
                        await markProgressReviewed();
                        setIsProgressReviewed(true);
                      }
                    } else {
                      setDeadlineEditMode('progress');
                    }
                  }}
                  title={deadlineEditMode === 'progress' ? "Exit edit progress mode" : "Edit document progress"}
                >
                  {deadlineEditMode === 'progress' ? <XIcon className="h-5 w-5" /> : <ClipboardCheck className="h-5 w-5" />}
                  {deadlineEditMode === 'progress' ? "Done" : "Edit Progress"}
                </IconButtonWithText>
                <div className="w-px h-6 bg-border mx-1" />
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-muted-foreground">Sort by:</span>
                  <Select value={filters.sortBy} onValueChange={filters.setSortBy}>
                    <SelectTrigger className="h-9 min-w-[180px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
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
        {filters.showFilters && (
          <FilterPanel
            activeStatusFilters={filters.activeStatusFilters}
            toggleStatusFilter={filters.toggleStatusFilter}
            activeTypeFilters={filters.activeTypeFilters}
            toggleTypeFilter={filters.toggleTypeFilter}
            activeVatFilter={filters.activeVatFilter}
            toggleVatFilter={filters.toggleVatFilter}
            activeVatStaggerFilters={filters.activeVatStaggerFilters}
            toggleVatStaggerFilter={filters.toggleVatStaggerFilter}
            dateFrom={filters.dateFrom}
            setDateFrom={filters.setDateFrom}
            dateTo={filters.dateTo}
            setDateTo={filters.setDateTo}
            clearAllFilters={filters.clearAllFilters}
          />
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
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
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
                  className={`group ${deadlineEditMode !== null ? 'cursor-default' : 'cursor-pointer'} ${viewMode === 'status' ? '[&>td]:hover:bg-muted/50' : 'hover:bg-muted/50'} transition-colors`}
                  onClick={(e) => {
                    if (deadlineEditMode !== null) return;
                    const target = e.target as HTMLElement;
                    if (target.closest('[role="checkbox"]') || target.closest('input') || target.closest('select') || target.closest('button') || target.closest('[role="button"]')) return;
                    const filingCell = target.closest('[data-filing-type]');
                    const filingParam = filingCell ? `?filing=${filingCell.getAttribute('data-filing-type')}` : '';
                    router.push(`/clients/${row.original.id}${filingParam}`);
                  }}
                >
                  {row.getVisibleCells().map((cell) => {
                    const isEarliestDeadline = viewMode === 'status'
                      && deadlineEditMode !== 'status'
                      && localStatusMap[row.original.id]?.next_deadline_type === cell.column.id
                      && !!localStatusMap[row.original.id]?.next_deadline;
                    return (
                      <TableCell key={cell.id} className={isEarliestDeadline ? "bg-primary/[0.03] dark:bg-primary/[0.08]" : undefined}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">No clients found.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Bulk Actions Toolbar */}
      <div className="max-w-7xl mx-auto">
        <BulkActionsToolbar
          selectedCount={selectedClients.length}
          onSendEmail={() => modals.setIsSendEmailModalOpen(true)}
          onDeleteClients={() => modals.setIsDeleteDialogOpen(true)}
          onClearSelection={() => setRowSelection({})}
        />
      </div>

      {/* All modals */}
      <ClientTableModals
        isSendEmailModalOpen={modals.isSendEmailModalOpen}
        setIsSendEmailModalOpen={modals.setIsSendEmailModalOpen}
        selectedClients={selectedClients}
        isDeleteDialogOpen={modals.isDeleteDialogOpen}
        setIsDeleteDialogOpen={modals.setIsDeleteDialogOpen}
        isDeleting={modals.isDeleting}
        handleDeleteClients={modals.handleDeleteClients}
        deactivateConfirm={modals.deactivateConfirm}
        setDeactivateConfirm={modals.setDeactivateConfirm}
        deactivateDontShowAgain={modals.deactivateDontShowAgain}
        setDeactivateDontShowAgain={modals.setDeactivateDontShowAgain}
        handleFilingAssignmentToggle={handleFilingAssignmentToggle}
        isCsvDialogOpen={modals.isCsvDialogOpen}
        setIsCsvDialogOpen={modals.setIsCsvDialogOpen}
        isCreateDialogOpen={modals.isCreateDialogOpen}
        setIsCreateDialogOpen={modals.setIsCreateDialogOpen}
        handleClientCreated={modals.handleClientCreated}
        handleLimitReached={modals.handleLimitReached}
        isUpgradeModalOpen={modals.isUpgradeModalOpen}
        setIsUpgradeModalOpen={modals.setIsUpgradeModalOpen}
        upgradeLimitData={modals.upgradeLimitData}
        handleUpgradeClick={modals.handleUpgradeClick}
      />
    </div>
  );
}
