"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
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
  Loader2,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  XCircle,
  ArrowLeft,
  ArrowRight,
  Sparkles,
  Trash2,
  Pencil,
  X,
  Info,
} from "lucide-react";
import { CSV_COLUMNS } from "@/lib/utils/csv-template";
import { importClientMetadata, type CsvImportResult } from "@/app/actions/csv";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { EditableCell } from "@/app/(dashboard)/clients/components/editable-cell";

type StepState = "mapping" | "edit-data" | "importing" | "results";

interface ColumnMapping {
  [systemField: string]: string | null;
}

interface ParsedCsvData {
  headers: string[];
  rows: Record<string, string>[];
  sampleRows: Record<string, string>[];
}

interface EditableRow {
  id: string;
  company_name: string;
  primary_email: string | null;
  client_type: string | null;
  year_end_date: string | null;
  vat_registered: boolean | null;
  vat_stagger_group: number | null;
  vat_scheme: string | null;
}

// Pure helper — no state dependency
function autoSuggestMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};

  CSV_COLUMNS.forEach((col) => {
    const systemField = col.name;

    const exactMatch = headers.find(
      (h) =>
        h.toLowerCase().replace(/[_\s]/g, "") ===
        systemField.toLowerCase().replace(/[_\s]/g, "")
    );

    if (exactMatch) {
      mapping[systemField] = exactMatch;
      return;
    }

    const partialMatch = headers.find((h) => {
      const hNorm = h.toLowerCase().replace(/[_\s]/g, "");
      const sNorm = systemField.toLowerCase().replace(/[_\s]/g, "");
      return hNorm.includes(sNorm) || sNorm.includes(hNorm);
    });

    mapping[systemField] = partialMatch ?? null;
  });

  return mapping;
}

function parseDate(dateValue: string): string | null {
  if (!dateValue || dateValue.trim() === "") return null;

  const trimmed = dateValue.trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

  const ddmmyyyyMatch = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (ddmmyyyyMatch) {
    const [, day, month, year] = ddmmyyyyMatch;
    return `${year}-${day.padStart(2, "0")}-${month.padStart(2, "0")}`;
  }

  const serialNumber = parseFloat(trimmed);
  if (!isNaN(serialNumber) && serialNumber > 0) {
    const excelEpoch = new Date(1900, 0, 1);
    const daysOffset = serialNumber > 59 ? serialNumber - 2 : serialNumber - 1;
    const date = new Date(
      excelEpoch.getTime() + daysOffset * 24 * 60 * 60 * 1000
    );
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  try {
    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) {
      return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`;
    }
  } catch {
    // fall through
  }

  return null;
}

export default function ClientImportPage() {
  const router = useRouter();

  const [stepState, setStepState] = useState<StepState>("mapping");
  const [parsedData, setParsedData] = useState<ParsedCsvData | null>(null);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({});
  const [editableRows, setEditableRows] = useState<EditableRow[]>([]);
  const [result, setResult] = useState<CsvImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showUnmatched, setShowUnmatched] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  // Selection & bulk edit
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());
  const [isBulkEditOpen, setIsBulkEditOpen] = useState(false);
  const [isSelectionModeActive, setIsSelectionModeActive] = useState(false);
  const [bulkClientType, setBulkClientType] = useState<{
    enabled: boolean;
    value: string | null;
  }>({ enabled: false, value: null });
  const [bulkYearEnd, setBulkYearEnd] = useState<{
    enabled: boolean;
    value: string | null;
  }>({ enabled: false, value: null });
  const [bulkVatRegistered, setBulkVatRegistered] = useState<{
    enabled: boolean;
    value: boolean;
  }>({ enabled: false, value: true });
  const [bulkVatStagger, setBulkVatStagger] = useState<{
    enabled: boolean;
    value: number | null;
  }>({ enabled: false, value: null });
  const [bulkVatScheme, setBulkVatScheme] = useState<{
    enabled: boolean;
    value: string | null;
  }>({ enabled: false, value: null });
  const [bulkConfirmStep, setBulkConfirmStep] = useState(false);

  // Client limit
  const [clientLimit, setClientLimit] = useState<number | null>(null);
  const [currentClientCount, setCurrentClientCount] = useState(0);

  // Cache parsed data across React StrictMode double-invoke (mount→unmount→remount)
  const importDataCacheRef = useRef<ParsedCsvData | null>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  // Read parsed data from sessionStorage on mount
  useEffect(() => {
    // StrictMode remount: ref survived unmount, restore from cache
    if (importDataCacheRef.current) {
      setParsedData(importDataCacheRef.current);
      setColumnMapping(autoSuggestMapping(importDataCacheRef.current.headers));
      return;
    }

    const stored = sessionStorage.getItem("csv-import-data");
    if (!stored) {
      router.replace("/clients");
      return;
    }

    try {
      const parsed = JSON.parse(stored);
      if (!parsed?.parsedData) throw new Error("Invalid data");

      const pd: ParsedCsvData = parsed.parsedData;
      importDataCacheRef.current = pd;
      setParsedData(pd);
      setColumnMapping(autoSuggestMapping(pd.headers));
      sessionStorage.removeItem("csv-import-data");
    } catch {
      router.replace("/clients");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Scroll to top when entering edit-data so the table starts at the first row
  useEffect(() => {
    if (stepState === "edit-data") {
      window.scrollTo({ top: 0, behavior: "instant" });
      if (tableContainerRef.current) tableContainerRef.current.scrollTop = 0;
    }
  }, [stepState]);

  // Fetch client limit when entering edit-data
  useEffect(() => {
    if (stepState !== "edit-data") return;

    async function fetchLimit() {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        const orgId = user?.app_metadata?.org_id;
        if (!orgId) return;

        const { data: org } = await supabase
          .from("organisations")
          .select("client_count_limit")
          .eq("id", orgId)
          .single();

        const { count } = await supabase
          .from("clients")
          .select("id", { count: "exact", head: true })
          .eq("org_id", orgId);

        setClientLimit(org?.client_count_limit ?? null);
        setCurrentClientCount(count ?? 0);
      } catch {
        // Non-blocking
      }
    }

    fetchLimit();
  }, [stepState]);

  // ── Mapping ────────────────────────────────────────────────────────────────

  const validateMapping = useCallback((): string | null => {
    const requiredFields = CSV_COLUMNS.filter((col) => col.required);
    for (const field of requiredFields) {
      if (!columnMapping[field.name]) {
        return `Required field "${field.name}" must be mapped to a column`;
      }
    }
    return null;
  }, [columnMapping]);

  const handleMappingChange = useCallback(
    (systemField: string, csvColumn: string | null) => {
      setColumnMapping((prev) => ({ ...prev, [systemField]: csvColumn }));
    },
    []
  );

  const handleProceedWithMapping = useCallback(() => {
    if (!parsedData) return;

    const validationError = validateMapping();
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);

    const transformed = parsedData.rows
      .map((row) => {
        const mappedData: Record<string, string> = {};
        Object.entries(columnMapping).forEach(([systemField, csvColumn]) => {
          if (csvColumn) mappedData[systemField] = row[csvColumn] || "";
        });

        return {
          id: crypto.randomUUID(),
          company_name: mappedData.company_name || "",
          primary_email: mappedData.primary_email || null,
          client_type: mappedData.client_type || null,
          year_end_date: parseDate(mappedData.year_end_date || ""),
          vat_registered: mappedData.vat_registered
            ? ["yes", "true", "1"].includes(
                mappedData.vat_registered.toLowerCase()
              )
            : true,
          vat_stagger_group: mappedData.vat_stagger_group
            ? parseInt(mappedData.vat_stagger_group, 10)
            : null,
          vat_scheme: mappedData.vat_scheme || null,
        } as EditableRow;
      })
      .filter((row) => row.company_name.trim() !== "");

    setEditableRows(transformed);
    setStepState("edit-data");
  }, [parsedData, columnMapping, validateMapping]);

  // ── Row editing ────────────────────────────────────────────────────────────

  const handleCellEdit = useCallback(
    async (rowId: string, field: string, value: unknown) => {
      setEditableRows((prev) =>
        prev.map((row) => (row.id === rowId ? { ...row, [field]: value } : row))
      );
    },
    []
  );

  const handleDeleteRow = useCallback((rowId: string) => {
    setEditableRows((prev) => prev.filter((row) => row.id !== rowId));
    setSelectedRowIds((prev) => {
      const next = new Set(prev);
      next.delete(rowId);
      return next;
    });
  }, []);

  // ── Selection ─────────────────────────────────────────────────────────────

  const toggleRowSelection = useCallback((rowId: string) => {
    setSelectedRowIds((prev) => {
      const next = new Set(prev);
      if (next.has(rowId)) next.delete(rowId);
      else next.add(rowId);
      return next;
    });
  }, []);

  const toggleAllSelection = useCallback(() => {
    setSelectedRowIds((prev) =>
      prev.size === editableRows.length
        ? new Set()
        : new Set(editableRows.map((r) => r.id))
    );
  }, [editableRows]);

  const clearSelection = useCallback(() => setSelectedRowIds(new Set()), []);

  const handleBulkDelete = useCallback(() => {
    setEditableRows((prev) => prev.filter((row) => !selectedRowIds.has(row.id)));
    setSelectedRowIds(new Set());
  }, [selectedRowIds]);

  // ── Bulk edit ──────────────────────────────────────────────────────────────

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
    if (bulkClientType.enabled && bulkClientType.value)
      changes.push(`Client Type → ${bulkClientType.value}`);
    if (bulkYearEnd.enabled && bulkYearEnd.value) {
      const [y, m, d] = bulkYearEnd.value.split("-");
      changes.push(`Year End Date → ${d}/${m}/${y}`);
    }
    if (bulkVatRegistered.enabled)
      changes.push(`VAT Registered → ${bulkVatRegistered.value ? "Yes" : "No"}`);
    if (bulkVatStagger.enabled && bulkVatStagger.value) {
      const labels: Record<number, string> = {
        1: "Stagger 1 (Mar/Jun/Sep/Dec)",
        2: "Stagger 2 (Jan/Apr/Jul/Oct)",
        3: "Stagger 3 (Feb/May/Aug/Nov)",
      };
      changes.push(`VAT Stagger → ${labels[bulkVatStagger.value]}`);
    }
    if (bulkVatScheme.enabled && bulkVatScheme.value)
      changes.push(`VAT Scheme → ${bulkVatScheme.value}`);
    return changes;
  })();

  const handleApplyBulkEdit = useCallback(() => {
    if (!bulkConfirmStep && bulkHasChanges) {
      setBulkConfirmStep(true);
      return;
    }

    setEditableRows((prev) =>
      prev.map((row) => {
        if (!selectedRowIds.has(row.id)) return row;
        const updated = { ...row };
        if (bulkClientType.enabled && bulkClientType.value)
          updated.client_type = bulkClientType.value;
        if (bulkYearEnd.enabled && bulkYearEnd.value)
          updated.year_end_date = bulkYearEnd.value;
        if (bulkVatRegistered.enabled)
          updated.vat_registered = bulkVatRegistered.value;
        if (bulkVatStagger.enabled)
          updated.vat_stagger_group = bulkVatStagger.value
            ? Number(bulkVatStagger.value)
            : null;
        if (bulkVatScheme.enabled) updated.vat_scheme = bulkVatScheme.value;
        return updated;
      })
    );

    setSelectedRowIds(new Set());
    handleCloseBulkEdit();
  }, [
    selectedRowIds,
    bulkClientType,
    bulkYearEnd,
    bulkVatRegistered,
    bulkVatStagger,
    bulkVatScheme,
    bulkConfirmStep,
    bulkHasChanges,
    handleCloseBulkEdit,
  ]);

  // ── Import ─────────────────────────────────────────────────────────────────

  const handleImportEditedData = useCallback(async () => {
    setStepState("importing");
    setError(null);
    setSelectedRowIds(new Set());

    try {
      const headers = CSV_COLUMNS.map((col) => col.name).join(",");
      const csvRows = editableRows.map((row) =>
        CSV_COLUMNS.map((col) => {
          let value = "";
          if (col.name === "vat_registered") {
            value =
              row.vat_registered === true
                ? "Yes"
                : row.vat_registered === false
                ? "No"
                : "";
          } else if (col.name === "vat_stagger_group") {
            value = row.vat_stagger_group ? String(row.vat_stagger_group) : "";
          } else {
            value = (row[col.name as keyof EditableRow] as string) || "";
          }

          if (
            value.includes(",") ||
            value.includes('"') ||
            value.includes("\n")
          ) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        }).join(",")
      );
      const csvContent = [headers, ...csvRows].join("\n");

      const transformedFile = new File([csvContent], "import.csv", {
        type: "text/csv",
      });
      const formData = new FormData();
      formData.append("file", transformedFile);
      formData.append("createIfMissing", "true");

      const importResult = await importClientMetadata(formData);
      if (!importResult.success && importResult.error) {
        setError(importResult.error);
        setStepState("edit-data");
        return;
      }
      setResult(importResult);
      setStepState("results");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      const isGenericNextError = msg.includes("Server Components") || msg.includes("digest");
      setError(
        isGenericNextError
          ? "Import failed. Please try again or contact support if the problem persists."
          : msg || "An unexpected error occurred"
      );
      setStepState("edit-data");
    }
  }, [editableRows]);

  const handleBackToUpload = useCallback(() => {
    router.push("/clients");
  }, [router]);

  const handleBackToMapping = useCallback(() => {
    setStepState("mapping");
    setError(null);
    setSelectedRowIds(new Set());
  }, []);

  const handleDone = useCallback(() => {
    router.push("/clients");
  }, [router]);

  // ── Render ─────────────────────────────────────────────────────────────────

  if (!parsedData) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Mapping step ───────────────────────────────────────────────────── */}
      {stepState === "mapping" && (
        <div className="max-w-2xl mx-auto space-y-4">
          <div className="rounded-2xl border bg-card shadow-sm p-8 space-y-6">
            <div className="space-y-1">
              <h2 className="text-xl font-semibold">Map CSV Columns</h2>
              <p className="text-sm text-muted-foreground">
                Match your file&apos;s columns to the fields Prompt expects.
              </p>
            </div>

            <div className="space-y-4 max-h-[480px] overflow-y-auto">
              {error && (
                <div className="flex items-center gap-2 text-destructive text-sm p-3 bg-destructive/5 rounded-lg">
                  <AlertCircle className="size-4" />
                  {error}
                </div>
              )}

              <div className="space-y-3">
                {CSV_COLUMNS.map((col) => {
                  const mappedColumn = columnMapping[col.name];
                  const sampleValues =
                    mappedColumn && parsedData.sampleRows
                      ? parsedData.sampleRows
                          .map((row) => row[mappedColumn])
                          .filter(Boolean)
                          .slice(0, 2)
                      : [];

                  return (
                    <div
                      key={col.name}
                      className="border hover:border-primary/20 shadow-sm hover:shadow-lg transition-all duration-300 rounded-xl p-4 space-y-3"
                    >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">
                          {col.name
                            .replace(/_/g, " ")
                            .replace(/\b\w/g, (l) => l.toUpperCase())}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {col.description}
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        {col.required && (
                          <div className="px-3 py-2 rounded-md bg-status-danger/10 inline-flex items-center">
                            <span className="text-sm font-medium text-status-danger">
                              Required
                            </span>
                          </div>
                        )}
                        <Select
                          value={mappedColumn || "__none__"}
                          onValueChange={(value) =>
                            handleMappingChange(
                              col.name,
                              value === "__none__" ? null : value
                            )
                          }
                        >
                          <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Select column…" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">
                              <span className="text-muted-foreground">
                                Don&apos;t map
                              </span>
                            </SelectItem>
                            {parsedData.headers.map((header) => (
                              <SelectItem key={header} value={header}>
                                {header}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {mappedColumn && sampleValues.length > 0 && (
                      <div className="bg-white border hover:border-primary/20 shadow-sm hover:shadow-md transition-all duration-300 rounded-xl p-3">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Preview</p>
                        <div className="space-y-0.5">
                          {sampleValues.map((value, idx) => {
                            let displayValue = value;
                            if (col.name === "year_end_date") {
                              const parsed = parseDate(value);
                              if (parsed) {
                                const [year, month, day] = parsed.split("-");
                                displayValue = `${day}/${month}/${year}`;
                              } else {
                                displayValue = value + " (invalid date)";
                              }
                            } else if (col.name === "vat_registered") {
                              displayValue = ["yes", "true", "1"].includes(
                                value.toLowerCase()
                              )
                                ? "Yes"
                                : "No";
                            }

                            return (
                              <p key={idx} className="text-sm font-medium truncate">
                                {displayValue}
                              </p>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                  );
                })}
              </div>
            </div>

          </div>

          <div className="flex justify-end gap-2">
            <ButtonBase variant="amber" buttonType="icon-text" onClick={handleBackToUpload}>
              <ArrowLeft className="size-4" />
              Back to Clients
            </ButtonBase>
            <ButtonBase variant="blue" buttonType="icon-text" onClick={handleProceedWithMapping}>
              Review Data
              <ArrowRight className="size-4" />
            </ButtonBase>
          </div>
        </div>
      )}

      {/* ── Edit data step ─────────────────────────────────────────────────── */}
      {stepState === "edit-data" && (
        <>
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <h2 className="text-xl font-semibold">Review &amp; Edit Import Data</h2>
              <p className="text-sm text-muted-foreground">
                Review and complete your data before importing. Client names will be matched to existing clients.
              </p>
            </div>
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
          </div>

          {(() => {
            const incompleteRows = editableRows.filter(
              (row) => !row.primary_email || !row.client_type || !row.year_end_date
            );
            const remainingCapacity =
              clientLimit === null ? Infinity : clientLimit - currentClientCount;
            const overLimitCount =
              remainingCapacity === Infinity
                ? 0
                : Math.max(0, editableRows.length - remainingCapacity);
            const importableCount =
              remainingCapacity === Infinity
                ? editableRows.length
                : Math.min(editableRows.length, Math.max(0, remainingCapacity));

            return (
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
                        You&apos;re trying to import {editableRows.length} clients but your current plan only allows {clientLimit} ({currentClientCount} existing).
                        The last {overLimitCount} {overLimitCount === 1 ? "row" : "rows"} highlighted in red will be skipped.
                        Remove rows or <a href="/settings?tab=billing" className="underline font-medium hover:text-amber-700">upgrade your plan</a> to import them all.
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

                {/* Editable table */}
                <div ref={tableContainerRef} className="-mx-8 max-h-[560px] overflow-y-auto border-y shadow-sm hover:shadow-lg transition-shadow duration-300 bg-white">
                  <Table className="min-w-[1520px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[52px]">
                          <div className="flex items-center justify-center">
                            <CheckButton
                              checked={
                                editableRows.length > 0 &&
                                selectedRowIds.size === editableRows.length
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
                            Client Type{" "}
                            <span className="text-destructive">*</span>
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
                        const isOverLimit =
                          overLimitCount > 0 && rowIndex >= importableCount;

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
                            <TableCell>
                              <div className="flex items-center justify-center">
                                <CheckButton
                                  checked={isSelected}
                                  onCheckedChange={() =>
                                    toggleRowSelection(row.id)
                                  }
                                  aria-label="Select row"
                                />
                              </div>
                            </TableCell>

                            <TableCell className="font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                              {row.company_name || "—"}
                            </TableCell>

                            <TableCell className={cn("transition-colors", isMissingEmail && "bg-amber-100/60")}>
                              <EditableCell
                                value={row.primary_email || ""}
                                onSave={(value) =>
                                  handleCellEdit(
                                    row.id,
                                    "primary_email",
                                    value || null
                                  )
                                }
                                type="text"
                                isEditMode
                              />
                            </TableCell>

                            <TableCell
                              className={cn(
                                "transition-colors",
                                isMissingType && "bg-amber-100/60"
                              )}
                            >
                              <EditableCell
                                value={row.client_type || ""}
                                onSave={(value) =>
                                  handleCellEdit(row.id, "client_type", value)
                                }
                                type="select"
                                options={[
                                  {
                                    value: "Limited Company",
                                    label: "Limited Company",
                                  },
                                  {
                                    value: "Partnership",
                                    label: "Partnership",
                                  },
                                  { value: "LLP", label: "LLP" },
                                  { value: "Individual", label: "Individual" },
                                ]}
                                isEditMode
                              />
                            </TableCell>

                            <TableCell
                              className={cn(
                                "transition-colors",
                                isMissingYearEnd && "bg-amber-100/60"
                              )}
                            >
                              <EditableCell
                                value={row.year_end_date || ""}
                                onSave={(value) =>
                                  handleCellEdit(
                                    row.id,
                                    "year_end_date",
                                    value
                                  )
                                }
                                type="date"
                                isEditMode
                              />
                            </TableCell>

                            <TableCell className="text-muted-foreground group-hover:text-foreground transition-colors">
                              <EditableCell
                                value={row.vat_registered ?? ""}
                                onSave={(value) =>
                                  handleCellEdit(
                                    row.id,
                                    "vat_registered",
                                    value
                                  )
                                }
                                type="boolean"
                                isEditMode
                              />
                            </TableCell>

                            <TableCell className="text-muted-foreground group-hover:text-foreground transition-colors">
                              <EditableCell
                                value={
                                  row.vat_stagger_group
                                    ? String(row.vat_stagger_group)
                                    : ""
                                }
                                onSave={(value) =>
                                  handleCellEdit(
                                    row.id,
                                    "vat_stagger_group",
                                    value
                                      ? parseInt(String(value), 10)
                                      : null
                                  )
                                }
                                type="select"
                                options={[
                                  {
                                    value: "1",
                                    label: "1 (Mar/Jun/Sep/Dec)",
                                  },
                                  {
                                    value: "2",
                                    label: "2 (Jan/Apr/Jul/Oct)",
                                  },
                                  {
                                    value: "3",
                                    label: "3 (Feb/May/Aug/Nov)",
                                  },
                                ]}
                                isEditMode
                              />
                            </TableCell>

                            <TableCell className="text-muted-foreground group-hover:text-foreground transition-colors">
                              <EditableCell
                                value={row.vat_scheme || ""}
                                onSave={(value) =>
                                  handleCellEdit(row.id, "vat_scheme", value)
                                }
                                type="select"
                                options={[
                                  { value: "Standard", label: "Standard" },
                                  {
                                    value: "Flat Rate",
                                    label: "Flat Rate",
                                  },
                                  {
                                    value: "Cash Accounting",
                                    label: "Cash Accounting",
                                  },
                                  {
                                    value: "Annual Accounting",
                                    label: "Annual Accounting",
                                  },
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

                {/* Floating selection toolbar */}
                <div
                  className={cn(
                    "fixed bottom-6 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 ease-in-out",
                    isSelectionModeActive || selectedRowIds.size > 0
                      ? "translate-y-0 opacity-100"
                      : "translate-y-20 opacity-0 pointer-events-none"
                  )}
                >
                  <div className="bg-background border shadow-lg rounded-lg px-4 py-3 flex items-center gap-4">
                    <span className="text-sm font-medium whitespace-nowrap">
                      {selectedRowIds.size === 0
                        ? "No rows selected"
                        : `${selectedRowIds.size} row${selectedRowIds.size !== 1 ? "s" : ""} selected`}
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

                        <div className="h-8 w-px bg-border" />

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

                    <div className="h-8 w-px bg-border" />

                    <ButtonBase
                      variant="muted"
                      buttonType="icon-only"
                      onClick={() => {
                        setIsSelectionModeActive(false);
                        setSelectedRowIds(new Set());
                      }}
                      title="Exit selection mode"
                    >
                      <X className="size-4" />
                    </ButtonBase>
                  </div>
                </div>

                {/* Bulk edit modal */}
                <Dialog
                  open={isBulkEditOpen}
                  onOpenChange={(isOpen) => !isOpen && handleCloseBulkEdit()}
                >
                  <DialogContent className="sm:max-w-md" showCloseButton={false}>
                    <DialogHeader>
                      <DialogTitle>
                        Bulk Edit {selectedRowIds.size} Row
                        {selectedRowIds.size !== 1 ? "s" : ""}
                      </DialogTitle>
                      <DialogDescription>
                        Select which fields to update. Only checked fields will
                        be applied to all selected rows.
                      </DialogDescription>
                    </DialogHeader>

                    {!bulkConfirmStep ? (
                      <div className="space-y-4 py-4">
                        {/* Client Type */}
                        <div className="flex items-start gap-4">
                          <CheckButton
                            checked={bulkClientType.enabled}
                            onCheckedChange={(checked) =>
                              setBulkClientType((prev) => ({
                                ...prev,
                                enabled: checked === true,
                              }))
                            }
                            aria-label="Enable Client Type"
                          />
                          <div className="flex-1 space-y-2">
                            <Label>Client Type</Label>
                            <Select
                              disabled={!bulkClientType.enabled}
                              value={bulkClientType.value || ""}
                              onValueChange={(value) =>
                                setBulkClientType((prev) => ({
                                  ...prev,
                                  value: value || null,
                                }))
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select client type" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Limited Company">
                                  Limited Company
                                </SelectItem>
                                <SelectItem value="Partnership">
                                  Partnership
                                </SelectItem>
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
                              setBulkYearEnd((prev) => ({
                                ...prev,
                                enabled: checked === true,
                              }))
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
                                setBulkYearEnd((prev) => ({
                                  ...prev,
                                  value: e.target.value || null,
                                }))
                              }
                            />
                          </div>
                        </div>

                        {/* VAT Registered */}
                        <div className="flex items-start gap-4">
                          <CheckButton
                            checked={bulkVatRegistered.enabled}
                            onCheckedChange={(checked) =>
                              setBulkVatRegistered((prev) => ({
                                ...prev,
                                enabled: checked === true,
                              }))
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
                                  setBulkVatRegistered((prev) => ({
                                    ...prev,
                                    value: checked === true,
                                  }))
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
                              setBulkVatStagger((prev) => ({
                                ...prev,
                                enabled: checked === true,
                              }))
                            }
                            aria-label="Enable VAT Stagger Group"
                          />
                          <div className="flex-1 space-y-2">
                            <Label>VAT Stagger Group</Label>
                            <Select
                              disabled={!bulkVatStagger.enabled}
                              value={bulkVatStagger.value?.toString() || ""}
                              onValueChange={(value) =>
                                setBulkVatStagger((prev) => ({
                                  ...prev,
                                  value: value ? parseInt(value) : null,
                                }))
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select stagger group" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="1">
                                  Stagger 1 (Mar/Jun/Sep/Dec)
                                </SelectItem>
                                <SelectItem value="2">
                                  Stagger 2 (Jan/Apr/Jul/Oct)
                                </SelectItem>
                                <SelectItem value="3">
                                  Stagger 3 (Feb/May/Aug/Nov)
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        {/* VAT Scheme */}
                        <div className="flex items-start gap-4">
                          <CheckButton
                            checked={bulkVatScheme.enabled}
                            onCheckedChange={(checked) =>
                              setBulkVatScheme((prev) => ({
                                ...prev,
                                enabled: checked === true,
                              }))
                            }
                            aria-label="Enable VAT Scheme"
                          />
                          <div className="flex-1 space-y-2">
                            <Label>VAT Scheme</Label>
                            <Select
                              disabled={!bulkVatScheme.enabled}
                              value={bulkVatScheme.value || ""}
                              onValueChange={(value) =>
                                setBulkVatScheme((prev) => ({
                                  ...prev,
                                  value: value || null,
                                }))
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select VAT scheme" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Standard">
                                  Standard
                                </SelectItem>
                                <SelectItem value="Flat Rate">
                                  Flat Rate
                                </SelectItem>
                                <SelectItem value="Cash Accounting">
                                  Cash Accounting
                                </SelectItem>
                                <SelectItem value="Annual Accounting">
                                  Annual Accounting
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="py-4">
                        <div className="bg-muted p-4 rounded-lg">
                          <p className="text-sm font-medium mb-2">
                            Confirm bulk update:
                          </p>
                          <p className="text-sm text-muted-foreground mb-3">
                            This will update{" "}
                            <strong>{selectedRowIds.size}</strong> row
                            {selectedRowIds.size !== 1 ? "s" : ""} with the
                            following changes:
                          </p>
                          <ul className="text-sm space-y-1">
                            {bulkPreviewChanges.map((change, index) => (
                              <li
                                key={index}
                                className="flex items-center gap-2"
                              >
                                <span className="text-primary">•</span>
                                {change}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )}

                    <DialogFooter>
                      {bulkConfirmStep ? (
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
                  <ButtonBase variant="amber" buttonType="icon-text" onClick={handleBackToMapping}>
                    <ArrowLeft className="size-4" />
                    Back
                  </ButtonBase>
                  <ButtonBase
                    variant="green"
                    buttonType="icon-text"
                    onClick={handleImportEditedData}
                    disabled={incompleteRows.length > 0}
                  >
                    <Sparkles className="size-4" />
                    {overLimitCount > 0
                      ? `Import ${importableCount} of ${editableRows.length} Clients`
                      : `Import ${editableRows.length} ${editableRows.length === 1 ? "Client" : "Clients"}`}
                  </ButtonBase>
                </div>
              </div>
            );
          })()}
        </>
      )}

      {/* ── Importing ──────────────────────────────────────────────────────── */}
      {stepState === "importing" && (
        <div className="py-12 flex flex-col items-center justify-center space-y-4">
          <Loader2 className="size-8 animate-spin text-primary" />
          <div className="text-center space-y-2">
            <p className="font-medium text-lg">Importing…</p>
            <p className="text-sm text-muted-foreground">
              Processing your file and updating client records
            </p>
          </div>
        </div>
      )}

      {/* ── Results ────────────────────────────────────────────────────────── */}
      {stepState === "results" && result && (
        <div className="max-w-2xl mx-auto space-y-4">
          <div className="rounded-2xl border bg-card shadow-sm p-8 space-y-6">
            <div className="space-y-1">
              <h2 className="text-xl font-semibold">Import Complete</h2>
              <p className="text-sm text-muted-foreground">
                Your file has been processed. Here&apos;s a summary of the
                results.
              </p>
            </div>

          <div className="space-y-6">
            {/* Success message if no issues */}
            {result.summary.unmatchedRows === 0 &&
              result.summary.validationErrors === 0 &&
              !result.limitInfo &&
              (result.summary.createdClients > 0 ||
                result.summary.updatedClients > 0) && (
                <div className="flex items-center gap-3 p-4 bg-green-500/10 rounded-xl">
                  <CheckCircle className="size-5 text-green-600 shrink-0" />
                  <p className="text-sm text-green-600">
                    All rows imported successfully!
                  </p>
                </div>
              )}

            {/* Summary cards */}
            <div className="grid grid-cols-3 gap-4">
              <Card className="px-4 py-4 gap-1">
                <p className="text-sm text-muted-foreground">
                  Total rows processed
                </p>
                <p className="text-2xl font-semibold">
                  {result.summary.totalRows}
                </p>
              </Card>
              {result.summary.createdClients > 0 && (
                <Card className="px-4 py-4 gap-1">
                  <p className="text-sm text-muted-foreground">Clients created</p>
                  <p className="text-2xl font-semibold">
                    {result.summary.createdClients}
                  </p>
                </Card>
              )}
              {result.summary.updatedClients > 0 && (
                <Card className="px-4 py-4 gap-1">
                  <p className="text-sm text-muted-foreground">Clients updated</p>
                  <p className="text-2xl font-semibold">
                    {result.summary.updatedClients}
                  </p>
                </Card>
              )}
            </div>

            {/* Unmatched rows */}
            {result.summary.unmatchedRows > 0 && (
              <div className="space-y-2">
                <button
                  className="flex items-center gap-2 w-full text-left"
                  onClick={() => setShowUnmatched(!showUnmatched)}
                >
                  {showUnmatched ? (
                    <ChevronDown className="size-4" />
                  ) : (
                    <ChevronRight className="size-4" />
                  )}
                  <span className="text-sm text-muted-foreground">
                    Unmatched rows ({result.summary.unmatchedRows})
                  </span>
                  <Badge
                    variant="outline"
                    className="ml-auto text-status-warning"
                  >
                    <AlertTriangle className="size-4 mr-1" />
                    Skipped
                  </Badge>
                </button>
                {showUnmatched && (
                  <div className="pl-6 space-y-1 max-h-32 overflow-y-auto">
                    {result.details.unmatchedCompanies.map((name, index) => (
                      <p key={index} className="text-sm text-muted-foreground">
                        • {name}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Validation errors */}
            {result.summary.validationErrors > 0 && (
              <div className="space-y-2">
                <button
                  className="flex items-center gap-2 w-full text-left"
                  onClick={() => setShowErrors(!showErrors)}
                >
                  {showErrors ? (
                    <ChevronDown className="size-4" />
                  ) : (
                    <ChevronRight className="size-4" />
                  )}
                  <span className="text-sm text-muted-foreground">
                    Validation errors ({result.summary.validationErrors})
                  </span>
                  <Badge variant="outline" className="ml-auto text-destructive">
                    <XCircle className="size-4 mr-1" />
                    Failed
                  </Badge>
                </button>
                {showErrors && (
                  <div className="pl-6 space-y-2 max-h-40 overflow-y-auto">
                    {result.details.validationErrors.map((err, index) => (
                      <div key={index}>
                        <p className="text-sm font-medium">Row {err.row}:</p>
                        <ul className="text-sm text-muted-foreground">
                          {err.errors.map((e, i) => (
                            <li key={i}>• {e}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Plan limit warning */}
            {result.limitInfo && (
              <div className="rounded-md bg-amber-500/10 px-4 py-3 text-sm space-y-2">
                <p className="font-medium text-amber-700">Plan limit reached</p>
                <p className="text-amber-600">
                  {result.limitInfo.importedClients} of{" "}
                  {result.limitInfo.totalNewClients} new clients were imported.{" "}
                  {result.limitInfo.skippedClients} clients were skipped because
                  your plan allows up to {result.limitInfo.limit} clients.
                </p>
                <p className="text-amber-600">
                  Upgrade your plan to import all clients.
                </p>
              </div>
            )}

          </div>

          </div>

          <div className="flex justify-end">
            <ButtonBase variant="green" buttonType="icon-text" onClick={handleDone}>
              Go to Clients
              <ArrowRight className="size-4" />
            </ButtonBase>
          </div>
        </div>
      )}
    </div>
  );
}
