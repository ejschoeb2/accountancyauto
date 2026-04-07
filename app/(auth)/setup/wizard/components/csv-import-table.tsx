"use client";

import { useState, useCallback, useRef, useEffect } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { CheckButton } from "@/components/ui/check-button";
import {
  AlertCircle,
  CheckCircle,
  AlertTriangle,
  Info,
  ArrowLeft,
  ArrowRight,
  Sparkles,
  Trash2,
  Pencil,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { EditableCell } from "@/app/(dashboard)/clients/components/editable-cell";
import type { EditableRow } from "@/lib/csv/validate";

// ── Props ────────────────────────────────────────────────────────────────────

interface CsvImportTableProps {
  editableRows: EditableRow[];
  onRowsChange: (rows: EditableRow[]) => void;
  onCellEdit: (rowId: string, field: string, value: unknown) => Promise<void>;
  onDeleteRow: (rowId: string) => void;
  onComplete: () => void;
  onBack?: () => void;
  onStartOver: () => void;
  clientLimit: number | null;
  currentClientCount: number;
  selectedClientTypes?: string[];
  error: string | null;
}

// ── Component ────────────────────────────────────────────────────────────────

export function CsvImportTable({
  editableRows,
  onRowsChange,
  onCellEdit,
  onDeleteRow,
  onComplete,
  onBack,
  onStartOver,
  clientLimit,
  currentClientCount,
  selectedClientTypes,
  error,
}: CsvImportTableProps) {
  // ── Selection & bulk edit state ──────────────────────────────────────────
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());
  const [isBulkEditOpen, setIsBulkEditOpen] = useState(false);
  const [isSelectionModeActive, setIsSelectionModeActive] = useState(false);
  const [bulkClientType, setBulkClientType] = useState<{ enabled: boolean; value: string | null }>({ enabled: false, value: null });
  const [bulkYearEnd, setBulkYearEnd] = useState<{ enabled: boolean; value: string | null }>({ enabled: false, value: null });
  const [bulkVatRegistered, setBulkVatRegistered] = useState<{ enabled: boolean; value: boolean }>({ enabled: false, value: true });
  const [bulkVatStagger, setBulkVatStagger] = useState<{ enabled: boolean; value: number | null }>({ enabled: false, value: null });
  const [bulkVatScheme, setBulkVatScheme] = useState<{ enabled: boolean; value: string | null }>({ enabled: false, value: null });
  const [bulkConfirmStep, setBulkConfirmStep] = useState(false);

  const reviewTopRef = useRef<HTMLDivElement>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  // ── Scroll to top on mount ──────────────────────────────────────────────
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.scrollTo({ top: 0, behavior: "instant" });
        if (tableContainerRef.current) {
          tableContainerRef.current.scrollTop = 0;
        }
      });
    });
  }, []);

  // ── Selection handlers ───────────────────────────────────────────────────
  const toggleRowSelection = useCallback((rowId: string) => {
    setSelectedRowIds((prev) => {
      const next = new Set(prev);
      if (next.has(rowId)) {
        next.delete(rowId);
      } else {
        next.add(rowId);
      }
      return next;
    });
  }, []);

  const toggleAllSelection = useCallback(() => {
    setSelectedRowIds((prev) => {
      if (prev.size === editableRows.length) {
        return new Set();
      }
      return new Set(editableRows.map((r) => r.id));
    });
  }, [editableRows]);

  const clearSelection = useCallback(() => {
    setSelectedRowIds(new Set());
  }, []);

  const handleBulkDelete = useCallback(() => {
    const filtered = editableRows.filter((row) => !selectedRowIds.has(row.id));
    onRowsChange(filtered);
    setSelectedRowIds(new Set());
  }, [editableRows, selectedRowIds, onRowsChange]);

  // ── Bulk edit handlers ───────────────────────────────────────────────────
  const resetBulkEditFields = useCallback(() => {
    setBulkClientType({ enabled: false, value: null });
    setBulkYearEnd({ enabled: false, value: null });
    setBulkVatRegistered({ enabled: false, value: true });
    setBulkVatStagger({ enabled: false, value: null });
    setBulkVatScheme({ enabled: false, value: null });
    setBulkConfirmStep(false);
  }, []);

  const handleOpenBulkEdit = useCallback(() => {
    resetBulkEditFields();
    setIsBulkEditOpen(true);
  }, [resetBulkEditFields]);

  const handleCloseBulkEdit = useCallback(() => {
    setIsBulkEditOpen(false);
    resetBulkEditFields();
  }, [resetBulkEditFields]);

  const bulkHasChanges =
    (bulkClientType.enabled && bulkClientType.value) ||
    (bulkYearEnd.enabled && bulkYearEnd.value) ||
    bulkVatRegistered.enabled ||
    (bulkVatStagger.enabled && bulkVatStagger.value) ||
    (bulkVatScheme.enabled && bulkVatScheme.value);

  const bulkPreviewChanges = (() => {
    const changes: string[] = [];
    if (bulkClientType.enabled && bulkClientType.value) {
      changes.push(`Client Type \u2192 ${bulkClientType.value}`);
    }
    if (bulkYearEnd.enabled && bulkYearEnd.value) {
      const [y, m, d] = bulkYearEnd.value.split("-");
      changes.push(`Year End Date \u2192 ${d}/${m}/${y}`);
    }
    if (bulkVatRegistered.enabled) {
      changes.push(`VAT Registered \u2192 ${bulkVatRegistered.value ? "Yes" : "No"}`);
    }
    if (bulkVatStagger.enabled && bulkVatStagger.value) {
      const labels: Record<number, string> = {
        1: "Stagger 1 (Mar/Jun/Sep/Dec)",
        2: "Stagger 2 (Jan/Apr/Jul/Oct)",
        3: "Stagger 3 (Feb/May/Aug/Nov)",
      };
      changes.push(`VAT Stagger \u2192 ${labels[bulkVatStagger.value]}`);
    }
    if (bulkVatScheme.enabled && bulkVatScheme.value) {
      changes.push(`VAT Scheme \u2192 ${bulkVatScheme.value}`);
    }
    return changes;
  })();

  const handleApplyBulkEdit = useCallback(() => {
    if (!bulkConfirmStep && bulkHasChanges) {
      setBulkConfirmStep(true);
      return;
    }

    const updated = editableRows.map((row) => {
      if (!selectedRowIds.has(row.id)) return row;
      const u = { ...row };
      if (bulkClientType.enabled && bulkClientType.value) {
        u.client_type = bulkClientType.value;
      }
      if (bulkYearEnd.enabled && bulkYearEnd.value) {
        u.year_end_date = bulkYearEnd.value;
      }
      if (bulkVatRegistered.enabled) {
        u.vat_registered = bulkVatRegistered.value;
      }
      if (bulkVatStagger.enabled) {
        u.vat_stagger_group = bulkVatStagger.value ? Number(bulkVatStagger.value) : null;
      }
      if (bulkVatScheme.enabled) {
        u.vat_scheme = bulkVatScheme.value;
      }
      return u;
    });

    onRowsChange(updated);
    setSelectedRowIds(new Set());
    handleCloseBulkEdit();
  }, [editableRows, selectedRowIds, bulkClientType, bulkYearEnd, bulkVatRegistered, bulkVatStagger, bulkVatScheme, bulkConfirmStep, bulkHasChanges, handleCloseBulkEdit, onRowsChange]);

  // ── Derived values ──────────────────────────────────────────────────────
  const incompleteRows = editableRows.filter(
    (row) => !row.primary_email || !row.client_type || !row.year_end_date
  );

  const remainingCapacity = clientLimit === null ? Infinity : clientLimit - currentClientCount;
  const overLimitCount = remainingCapacity === Infinity ? 0 : Math.max(0, editableRows.length - remainingCapacity);
  const importableCount = remainingCapacity === Infinity ? editableRows.length : Math.min(editableRows.length, Math.max(0, remainingCapacity));

  // Client type mismatch detection
  const mismatchedTypes = (() => {
    if (!selectedClientTypes || selectedClientTypes.length === 0) return [];
    const selectedSet = new Set(selectedClientTypes);
    return [...new Set(
      editableRows
        .map((r) => r.client_type)
        .filter((t): t is string => !!t && !selectedSet.has(t))
    )];
  })();

  return (
    <>
      <div ref={reviewTopRef} className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold tracking-tight">Review &amp; Edit Import Data</h2>
          <p className="text-sm text-muted-foreground">
            Review and complete your data before importing. Use the select rows to edit feature to make bulk changes, or start over to re-upload your file.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ButtonBase
            variant="violet"
            buttonType="icon-text"
            isSelected={isSelectionModeActive}
            onClick={() => {
              if (isSelectionModeActive) {
                setIsSelectionModeActive(false);
                setSelectedRowIds(new Set());
              } else {
                setIsSelectionModeActive(true);
              }
            }}
          >
            <Pencil className="size-4" />
            Select rows to edit
          </ButtonBase>
          <ButtonBase
            variant="destructive"
            buttonType="icon-text"
            onClick={onStartOver}
          >
            <Trash2 className="size-4" />
            Start Over
          </ButtonBase>
        </div>
      </div>

      <div className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 text-destructive text-sm p-3 bg-destructive/5 rounded-lg">
            <AlertCircle className="size-4" />
            {error}
          </div>
        )}

        {overLimitCount > 0 && (
          <div className="flex items-start gap-3 p-4 bg-amber-500/10 rounded-xl">
            <AlertTriangle className="size-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-amber-600">
                {overLimitCount} {overLimitCount === 1 ? "row" : "rows"} over your plan limit
              </p>
              <p className="text-sm text-amber-600/80">
                You&apos;re trying to import {editableRows.length} clients but your current plan only allows {clientLimit}.
                The last {overLimitCount} {overLimitCount === 1 ? "row" : "rows"} highlighted in red will be skipped.
                Remove rows or upgrade your plan to import them all.
              </p>
            </div>
          </div>
        )}

        {incompleteRows.length > 0 && (
          <div className="flex items-start gap-3 p-4 bg-amber-500/10 rounded-xl">
            <AlertTriangle className="size-5 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-600">
              <strong>{incompleteRows.length} {incompleteRows.length === 1 ? "row is" : "rows are"}</strong>{" "}
              missing required fields. Fill in <strong>Email</strong>, <strong>Client Type</strong> and{" "}
              <strong>Year End Date</strong> for every row before importing.
            </p>
          </div>
        )}

        {mismatchedTypes.length > 0 && (
          <div className="flex items-start gap-3 p-4 bg-blue-500/10 rounded-xl">
            <Info className="size-5 text-blue-500 shrink-0 mt-0.5" />
            <p className="text-sm text-blue-500">
              Some clients are listed as <strong>{mismatchedTypes.join(", ")}</strong> — a type you didn&apos;t select in the previous step.
              They&apos;ll still be imported and you can update their type or your deadline settings later.
            </p>
          </div>
        )}

        {/* Editable data table — bleeds to layout edges like client table */}
        <div ref={tableContainerRef} className="-mx-8 max-h-[min(420px,50vh)] overflow-y-auto border-y shadow-sm hover:shadow-lg transition-shadow duration-300 bg-white">
          <Table className="min-w-[1520px]">
            <TableHeader className="sticky top-0 z-10 bg-white [&_th]:bg-white shadow-[0_1px_0_0_hsl(var(--border))]">
              <TableRow>
                <TableHead className="w-[52px]">
                  <div className="flex items-center justify-center">
                    <CheckButton
                      checked={
                        editableRows.length > 0 && selectedRowIds.size === editableRows.length
                          ? true
                          : selectedRowIds.size > 0
                          ? "indeterminate"
                          : false
                      }
                      onCheckedChange={() => toggleAllSelection()}
                      aria-label="Select all"
                    />
                  </div>
                </TableHead>
                <TableHead className="min-w-[220px]">
                  <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    Client Name
                  </span>
                </TableHead>
                <TableHead className="min-w-[220px]">
                  <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    Email <span className="text-destructive">*</span>
                  </span>
                </TableHead>
                <TableHead className="min-w-[200px]">
                  <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    Client Type <span className="text-destructive">*</span>
                  </span>
                </TableHead>
                <TableHead className="min-w-[180px]">
                  <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    Year End <span className="text-destructive">*</span>
                  </span>
                </TableHead>
                <TableHead className="min-w-[150px]">
                  <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    VAT Registered
                  </span>
                </TableHead>
                <TableHead className="min-w-[200px]">
                  <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    VAT Stagger
                  </span>
                </TableHead>
                <TableHead className="min-w-[210px]">
                  <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    VAT Scheme
                  </span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {editableRows.map((row, rowIndex) => {
                const isMissingEmail = !row.primary_email;
                const isMissingType = !row.client_type;
                const isMissingYearEnd = !row.year_end_date;
                const rowIncomplete = isMissingEmail || isMissingType || isMissingYearEnd;
                const isSelected = selectedRowIds.has(row.id);
                const isOverLimit = overLimitCount > 0 && rowIndex >= importableCount;

                return (
                  <TableRow
                    key={row.id}
                    className={cn(
                      "group cursor-pointer transition-colors",
                      isOverLimit && "bg-red-50/80 opacity-60",
                      !isOverLimit && rowIncomplete && "bg-amber-50/50",
                      !isOverLimit && isSelected && "bg-blue-50/60",
                      !isOverLimit && !rowIncomplete && !isSelected && "hover:bg-muted/50"
                    )}
                  >
                    {/* Checkbox */}
                    <TableCell>
                      <div className="flex items-center justify-center">
                        <CheckButton
                          checked={isSelected}
                          onCheckedChange={() => toggleRowSelection(row.id)}
                          aria-label="Select row"
                        />
                      </div>
                    </TableCell>

                    {/* Client Name - readonly */}
                    <TableCell className="font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                      {row.company_name || "\u2014"}
                    </TableCell>

                    {/* Email (required) */}
                    <TableCell className={cn(
                      "transition-colors",
                      isMissingEmail && "bg-amber-100/60"
                    )}>
                      <EditableCell
                        value={row.primary_email || ""}
                        onSave={(value) => onCellEdit(row.id, "primary_email", value || null)}
                        type="text"
                        isEditMode
                      />
                    </TableCell>

                    {/* Client Type - select (required) */}
                    <TableCell className={cn(
                      "transition-colors",
                      isMissingType && "bg-amber-100/60"
                    )}>
                      <EditableCell
                        value={row.client_type || ""}
                        onSave={(value) => onCellEdit(row.id, "client_type", value)}
                        type="select"
                        options={[
                          { value: "Limited Company", label: "Limited Company" },
                          { value: "Partnership", label: "Partnership" },
                          { value: "LLP", label: "LLP" },
                          { value: "Individual", label: "Individual" },
                        ]}
                        isEditMode
                      />
                    </TableCell>

                    {/* Year End Date - date (required) */}
                    <TableCell className={cn(
                      "transition-colors",
                      isMissingYearEnd && "bg-amber-100/60"
                    )}>
                      <EditableCell
                        value={row.year_end_date || ""}
                        onSave={(value) => onCellEdit(row.id, "year_end_date", value)}
                        type="date"
                        isEditMode
                      />
                    </TableCell>

                    {/* VAT Registered - boolean */}
                    <TableCell className="text-muted-foreground group-hover:text-foreground transition-colors">
                      <EditableCell
                        value={row.vat_registered ?? ""}
                        onSave={(value) => onCellEdit(row.id, "vat_registered", value)}
                        type="boolean"
                        isEditMode
                      />
                    </TableCell>

                    {/* VAT Stagger Group - select */}
                    <TableCell className="text-muted-foreground group-hover:text-foreground transition-colors">
                      <EditableCell
                        value={row.vat_stagger_group ? String(row.vat_stagger_group) : ""}
                        onSave={(value) =>
                          onCellEdit(row.id, "vat_stagger_group", value ? parseInt(String(value), 10) : null)
                        }
                        type="select"
                        options={[
                          { value: "1", label: "1 (Mar/Jun/Sep/Dec)" },
                          { value: "2", label: "2 (Jan/Apr/Jul/Oct)" },
                          { value: "3", label: "3 (Feb/May/Aug/Nov)" },
                        ]}
                        isEditMode
                      />
                    </TableCell>

                    {/* VAT Scheme - select */}
                    <TableCell className="text-muted-foreground group-hover:text-foreground transition-colors">
                      <EditableCell
                        value={row.vat_scheme || ""}
                        onSave={(value) => onCellEdit(row.id, "vat_scheme", value)}
                        type="select"
                        options={[
                          { value: "Standard", label: "Standard" },
                          { value: "Flat Rate", label: "Flat Rate" },
                          { value: "Cash Accounting", label: "Cash Accounting" },
                          { value: "Annual Accounting", label: "Annual Accounting" },
                        ]}
                        isEditMode
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {/* ── Bottom selection toolbar ── */}
        <div
          className={cn(
            "fixed bottom-6 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 ease-in-out",
            (isSelectionModeActive || selectedRowIds.size > 0)
              ? "translate-y-0 opacity-100"
              : "translate-y-20 opacity-0 pointer-events-none"
          )}
        >
          <div className="bg-background border shadow-lg rounded-lg px-4 py-3 flex items-center gap-4">
            <span className="text-sm font-medium whitespace-nowrap">
              {selectedRowIds.size === 0 ? "No rows selected" : `${selectedRowIds.size} row${selectedRowIds.size !== 1 ? "s" : ""} selected`}
            </span>

            {selectedRowIds.size > 0 && (
              <div className="flex items-center gap-2">
                <ButtonBase
                  variant="violet"
                  buttonType="icon-text"
                  onClick={handleOpenBulkEdit}
                >
                  <Pencil className="size-4" />
                  Bulk Edit
                </ButtonBase>

                <ButtonBase
                  variant="destructive"
                  buttonType="icon-text"
                  onClick={handleBulkDelete}
                >
                  <Trash2 className="size-4" />
                  Delete
                </ButtonBase>

                <ButtonBase
                  variant="amber"
                  buttonType="icon-text"
                  onClick={clearSelection}
                >
                  <X className="size-4" />
                  Clear
                </ButtonBase>
              </div>
            )}
          </div>
        </div>

        {/* ── Bulk edit modal ── */}
        <Dialog open={isBulkEditOpen} onOpenChange={(isOpen) => !isOpen && handleCloseBulkEdit()}>
          <DialogContent className="sm:max-w-md" showCloseButton={false}>
            <DialogHeader>
              <DialogTitle>
                {selectedRowIds.size === 0 ? "Bulk Edit" : `Bulk Edit ${selectedRowIds.size} Row${selectedRowIds.size !== 1 ? "s" : ""}`}
              </DialogTitle>
              <DialogDescription>
                {selectedRowIds.size === 0
                  ? "Select rows in the table to edit them in bulk."
                  : "Select which fields to update. Only checked fields will be applied to all selected rows."}
              </DialogDescription>
            </DialogHeader>

            {selectedRowIds.size === 0 ? (
              <div className="py-8 flex flex-col items-center justify-center gap-3 text-center">
                <p className="text-sm text-muted-foreground">Select rows to edit</p>
              </div>
            ) : !bulkConfirmStep ? (
              <div className="space-y-4 py-4">
                {/* Client Type */}
                <div className="flex items-start gap-4">
                  <CheckButton
                    checked={bulkClientType.enabled}
                    onCheckedChange={(checked) =>
                      setBulkClientType((prev) => ({ ...prev, enabled: checked === true }))
                    }
                    aria-label="Enable Client Type"
                  />
                  <div className="flex-1 space-y-2">
                    <Label>Client Type</Label>
                    <Select
                      disabled={!bulkClientType.enabled}
                      value={bulkClientType.value || ""}
                      onValueChange={(value) =>
                        setBulkClientType((prev) => ({ ...prev, value: value || null }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select client type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Limited Company">Limited Company</SelectItem>
                        <SelectItem value="Partnership">Partnership</SelectItem>
                        <SelectItem value="LLP">LLP</SelectItem>
                        <SelectItem value="Individual">Individual</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Year End Date */}
                <div className="flex items-start gap-4">
                  <CheckButton
                    checked={bulkYearEnd.enabled}
                    onCheckedChange={(checked) =>
                      setBulkYearEnd((prev) => ({ ...prev, enabled: checked === true }))
                    }
                    aria-label="Enable Year End Date"
                  />
                  <div className="flex-1 space-y-2">
                    <Label>Year End Date</Label>
                    <Input
                      type="date"
                      disabled={!bulkYearEnd.enabled}
                      value={bulkYearEnd.value || ""}
                      onChange={(e) =>
                        setBulkYearEnd((prev) => ({ ...prev, value: e.target.value || null }))
                      }
                    />
                  </div>
                </div>

                {/* VAT Registered */}
                <div className="flex items-start gap-4">
                  <CheckButton
                    checked={bulkVatRegistered.enabled}
                    onCheckedChange={(checked) =>
                      setBulkVatRegistered((prev) => ({ ...prev, enabled: checked === true }))
                    }
                    aria-label="Enable VAT Registered"
                  />
                  <div className="flex-1 space-y-2">
                    <Label>VAT Registered</Label>
                    <div className="flex items-center gap-2">
                      <CheckButton
                        disabled={!bulkVatRegistered.enabled}
                        checked={bulkVatRegistered.value}
                        onCheckedChange={(checked) =>
                          setBulkVatRegistered((prev) => ({ ...prev, value: checked === true }))
                        }
                        aria-label="VAT Registered value"
                      />
                      <span className="text-sm text-muted-foreground">
                        {bulkVatRegistered.value ? "Yes" : "No"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* VAT Stagger Group */}
                <div className="flex items-start gap-4">
                  <CheckButton
                    checked={bulkVatStagger.enabled}
                    onCheckedChange={(checked) =>
                      setBulkVatStagger((prev) => ({ ...prev, enabled: checked === true }))
                    }
                    aria-label="Enable VAT Stagger Group"
                  />
                  <div className="flex-1 space-y-2">
                    <Label>VAT Stagger Group</Label>
                    <Select
                      disabled={!bulkVatStagger.enabled}
                      value={bulkVatStagger.value?.toString() || ""}
                      onValueChange={(value) =>
                        setBulkVatStagger((prev) => ({ ...prev, value: value ? parseInt(value) : null }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select stagger group" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">Stagger 1 (Mar/Jun/Sep/Dec)</SelectItem>
                        <SelectItem value="2">Stagger 2 (Jan/Apr/Jul/Oct)</SelectItem>
                        <SelectItem value="3">Stagger 3 (Feb/May/Aug/Nov)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* VAT Scheme */}
                <div className="flex items-start gap-4">
                  <CheckButton
                    checked={bulkVatScheme.enabled}
                    onCheckedChange={(checked) =>
                      setBulkVatScheme((prev) => ({ ...prev, enabled: checked === true }))
                    }
                    aria-label="Enable VAT Scheme"
                  />
                  <div className="flex-1 space-y-2">
                    <Label>VAT Scheme</Label>
                    <Select
                      disabled={!bulkVatScheme.enabled}
                      value={bulkVatScheme.value || ""}
                      onValueChange={(value) =>
                        setBulkVatScheme((prev) => ({ ...prev, value: value || null }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select VAT scheme" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Standard">Standard</SelectItem>
                        <SelectItem value="Flat Rate">Flat Rate</SelectItem>
                        <SelectItem value="Cash Accounting">Cash Accounting</SelectItem>
                        <SelectItem value="Annual Accounting">Annual Accounting</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-4">
                <div className="bg-muted p-4 rounded-lg">
                  <p className="text-sm font-medium mb-2">Confirm bulk update:</p>
                  <p className="text-sm text-muted-foreground mb-3">
                    This will update <strong>{selectedRowIds.size}</strong> row{selectedRowIds.size !== 1 ? "s" : ""} with the following changes:
                  </p>
                  <ul className="text-sm space-y-1">
                    {bulkPreviewChanges.map((change, index) => (
                      <li key={index} className="flex items-center gap-2">
                        <span className="text-primary">&bull;</span>
                        {change}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            <DialogFooter>
              {selectedRowIds.size === 0 ? (
                <ButtonBase
                  variant="amber"
                  buttonType="icon-text"
                  onClick={handleCloseBulkEdit}
                >
                  <X className="size-4" />
                  Close
                </ButtonBase>
              ) : bulkConfirmStep ? (
                <>
                  <ButtonBase
                    variant="amber"
                    buttonType="icon-text"
                    onClick={() => setBulkConfirmStep(false)}
                  >
                    <ArrowLeft className="size-4" />
                    Back
                  </ButtonBase>
                  <ButtonBase
                    variant="green"
                    buttonType="icon-text"
                    onClick={handleApplyBulkEdit}
                  >
                    <CheckCircle className="size-4" />
                    Apply Changes
                  </ButtonBase>
                </>
              ) : (
                <>
                  <ButtonBase
                    variant="amber"
                    buttonType="icon-text"
                    onClick={handleCloseBulkEdit}
                  >
                    <X className="size-4" />
                    Close
                  </ButtonBase>
                  <ButtonBase
                    variant="green"
                    buttonType="icon-text"
                    onClick={handleApplyBulkEdit}
                    disabled={!bulkHasChanges}
                  >
                    <ArrowRight className="size-4" />
                    Continue
                  </ButtonBase>
                </>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <div className="flex justify-end gap-2">
          {onBack && (
            <ButtonBase variant="amber" buttonType="icon-text" onClick={onBack}>
              <ArrowLeft className="size-4" />
              Back
            </ButtonBase>
          )}
          <ButtonBase
            variant="green"
            buttonType="icon-text"
            onClick={onComplete}
            disabled={incompleteRows.length > 0}
          >
            <Sparkles className="size-4" />
            {overLimitCount > 0
              ? `Confirm ${importableCount} of ${editableRows.length} Clients`
              : `Confirm ${editableRows.length} ${editableRows.length === 1 ? "Client" : "Clients"}`}
          </ButtonBase>
        </div>
      </div>
    </>
  );
}
