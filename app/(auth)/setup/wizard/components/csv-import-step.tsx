"use client";

import { useState, useCallback, useEffect, useRef } from "react";
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
  FileText,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Loader2,
  Download,
} from "lucide-react";
import { generateCsvTemplateWithComments, CSV_COLUMNS } from "@/lib/utils/csv-template";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import {
  autoSuggestMapping,
  validateMapping,
  parseExcelFile,
  decodeFileBytes,
  parseCsvString,
  isExcelFile,
  isSupportedFile,
} from "@/lib/csv/parser";
import type { ParsedCsvData, ColumnMapping } from "@/lib/csv/parser";
import {
  transformToEditableRows,
  formatDatePreview,
  formatVatRegisteredPreview,
} from "@/lib/csv/validate";
import type { EditableRow } from "@/lib/csv/validate";
import { CsvImportTable } from "./csv-import-table";

// Re-export EditableRow so existing consumers don't break
export type { EditableRow } from "@/lib/csv/validate";

interface CsvImportStepProps {
  onComplete: () => void;
  onBack?: () => void; // Optional: return to previous wizard step
  /** Pre-populate the edit table (restores a previous import when navigating back) */
  initialRows?: EditableRow[];
  /** Called whenever the edit table rows change, so parent can persist them */
  onRowsChange?: (rows: EditableRow[]) => void;
  /** Called when user clicks "Start Over" to clear parent state */
  onStartOver?: () => void;
  /** Plan client limit passed from parent (avoids unreliable DB fetch) */
  planClientLimit?: number | null;
  /** Client types selected in the deadline-selection step (for mismatch detection) */
  selectedClientTypes?: string[];
}

type StepState = "upload" | "mapping" | "edit-data";

/**
 * Full-page CSV import step for the member setup wizard.
 * Runs the complete import flow (upload -> mapping -> edit-data -> importing -> results)
 * using Card-based layout instead of a Dialog wrapper.
 * The existing CsvImportDialog on the /clients page is NOT modified.
 */
export function CsvImportStep({ onComplete, onBack, initialRows, onRowsChange, onStartOver, planClientLimit, selectedClientTypes }: CsvImportStepProps) {
  const [stepState, setStepState] = useState<StepState>(
    initialRows && initialRows.length > 0 ? "edit-data" : "upload"
  );
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedCsvData | null>(null);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({});
  const [editableRows, setEditableRows] = useState<EditableRow[]>(initialRows ?? []);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isMappingRows, setIsMappingRows] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Client limit state (for pre-import warning) ────────────────────────
  const [clientLimit, setClientLimit] = useState<number | null>(planClientLimit ?? null);
  const [currentClientCount, setCurrentClientCount] = useState(0);

  // ── Notify parent whenever rows change so it can persist them ───────────
  useEffect(() => {
    onRowsChange?.(editableRows);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editableRows]);

  // ── Fetch client limit when entering edit-data step ──────────────────
  useEffect(() => {
    if (stepState !== "edit-data") return;

    async function fetchLimit() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
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

        setClientLimit(org?.client_count_limit ?? planClientLimit ?? null);
        setCurrentClientCount(count ?? 0);
      } catch {
        // Non-blocking — if we can't fetch, just don't show limit warning
      }
    }

    fetchLimit();
  }, [stepState]);

  // ── Parse file and advance to mapping ──────────────────────────────────
  const parseFile = useCallback(
    async (file: File) => {
      try {
        const fileName = file.name.toLowerCase();

        if (isExcelFile(fileName)) {
          const arrayBuffer = await file.arrayBuffer();
          const parsed = parseExcelFile(arrayBuffer);
          setParsedData(parsed);
          setColumnMapping(autoSuggestMapping(parsed.headers));
          setStepState("mapping");
          setError(null);
        } else {
          const rawBytes = new Uint8Array(await file.arrayBuffer());
          const csvContent = decodeFileBytes(rawBytes);
          const parsed = await parseCsvString(csvContent);
          setParsedData(parsed);
          setColumnMapping(autoSuggestMapping(parsed.headers));
          setStepState("mapping");
          setError(null);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to read file");
      }
    },
    []
  );

  // ── Handle file selection ──────────────────────────────────────────────
  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        if (isSupportedFile(file.name)) {
          setSelectedFile(file);
          setError(null);
          parseFile(file);
        } else {
          setError("Please select a CSV or Excel file (.csv, .xlsx)");
          setSelectedFile(null);
        }
      }
    },
    [parseFile]
  );

  // ── Handle drag and drop ───────────────────────────────────────────────
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const file = e.dataTransfer.files?.[0];
      if (file) {
        if (isSupportedFile(file.name)) {
          setSelectedFile(file);
          setError(null);
          parseFile(file);
        } else {
          setError("Please select a CSV or Excel file (.csv, .xlsx)");
          setSelectedFile(null);
        }
      }
    },
    [parseFile]
  );

  // ── Download template ──────────────────────────────────────────────────
  const handleDownloadTemplate = useCallback(() => {
    const csvContent = generateCsvTemplateWithComments();
    // Prepend UTF-8 BOM so Excel opens the file with correct encoding
    const blob = new Blob(["\ufeff", csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "client-metadata-template.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, []);

  // ── Apply mapping and proceed to edit-data step ────────────────────────
  const handleProceedWithMapping = useCallback(() => {
    if (!parsedData) return;

    const validationError = validateMapping(columnMapping);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    const transformed = transformToEditableRows(parsedData.rows, columnMapping);
    setEditableRows(transformed);
    setStepState("edit-data");
  }, [parsedData, columnMapping]);

  // ── Handle mapping change ──────────────────────────────────────────────
  const handleMappingChange = useCallback((systemField: string, csvColumn: string | null) => {
    setColumnMapping((prev) => ({
      ...prev,
      [systemField]: csvColumn,
    }));
  }, []);

  // ── Handle cell edit in edit-data step ─────────────────────────────────
  const handleCellEdit = useCallback(async (rowId: string, field: string, value: unknown) => {
    setEditableRows((prev) =>
      prev.map((row) => (row.id === rowId ? { ...row, [field]: value } : row))
    );
  }, []);

  // ── Handle row deletion in edit-data step ──────────────────────────────
  const handleDeleteRow = useCallback((rowId: string) => {
    setEditableRows((prev) => prev.filter((row) => row.id !== rowId));
  }, []);

  // ── Navigation handlers ────────────────────────────────────────────────
  const handleBackToUpload = useCallback(() => {
    setStepState("upload");
    setSelectedFile(null);
    setParsedData(null);
    setColumnMapping({});
    setEditableRows([]);
    setError(null);
  }, []);

  const handleStartOver = useCallback(() => {
    onStartOver?.();
    setStepState("upload");
    setSelectedFile(null);
    setParsedData(null);
    setColumnMapping({});
    setEditableRows([]);
    setError(null);
  }, [onStartOver]);

  // Required and optional columns for display
  const requiredColumns = CSV_COLUMNS.filter((col) => col.required);
  const optionalColumns = CSV_COLUMNS.filter((col) => !col.required);

  return (
    <div className="space-y-4">
      {stepState === "upload" && (
        <div className="max-w-3xl mx-auto space-y-4">
          <div className="rounded-2xl border bg-card shadow-sm p-8 space-y-6">
            {/* Header */}
            <div className="space-y-1">
              <h2 className="text-2xl font-bold tracking-tight">Import Client Metadata</h2>
              <p className="text-sm text-muted-foreground">
                Upload a CSV or Excel file to set metadata for your clients. Rows are matched by company name.
                You can also skip this step and import clients later from the Clients page.
              </p>
            </div>

            {/* Column info + Download Template */}
            <div className="text-sm text-muted-foreground space-y-1.5">
              <p>
                <span className="font-medium text-foreground">Required:</span>{" "}
                {requiredColumns.map((col) => col.name).join(", ")}
              </p>
              <p>
                <span className="font-medium text-foreground">Optional:</span>{" "}
                {optionalColumns.map((col) => col.name).join(", ")}
              </p>
              <div className="pt-1">
                <ButtonBase variant="violet" buttonType="icon-text" onClick={handleDownloadTemplate}>
                  <Download className="size-4" />
                  Download Template Table
                </ButtonBase>
              </div>
            </div>

            {/* File upload area */}
            <div
              className={cn(
                "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
                isDragging
                  ? "border-accent bg-accent/5"
                  : "border-muted-foreground/25 hover:border-muted-foreground/50",
                error && "border-destructive bg-destructive/5"
              )}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <Input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={handleFileChange}
              />
              <FileText className="size-8 mx-auto text-muted-foreground mb-4" />
              {selectedFile ? (
                <div className="space-y-2">
                  <p className="font-medium">{selectedFile.name}</p>
                  <p className="text-sm text-muted-foreground">Click to change file</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="font-medium">Click to upload or drag and drop</p>
                  <p className="text-sm text-muted-foreground">CSV or Excel files (.csv, .xlsx) — max 1MB</p>
                </div>
              )}
            </div>

            {error && (
              <div className="flex items-center gap-2 text-destructive text-sm">
                <AlertCircle className="size-4" />
                {error}
              </div>
            )}
          </div>

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
            >
              Skip Import
              <ArrowRight className="size-4" />
            </ButtonBase>
          </div>
        </div>
      )}

      {stepState === "mapping" && parsedData && (
        <div className="max-w-2xl mx-auto space-y-4">
          <div className="rounded-2xl border bg-card shadow-sm p-8 space-y-6">
            <div className="space-y-1">
              <h2 className="text-2xl font-bold tracking-tight">Map CSV Columns</h2>
              <p className="text-sm text-muted-foreground">
                Match your CSV columns to the system fields. Mapping is optional — you can enter values manually later.
              </p>
            </div>

          <div className="space-y-4 max-h-[420px] overflow-y-auto">
            {error && (
              <div className="flex items-center gap-2 text-destructive text-sm p-3 bg-destructive/5 rounded-lg">
                <AlertCircle className="size-4" />
                {error}
              </div>
            )}

            {/* Column mapping table */}
            <div className="space-y-3">
              {CSV_COLUMNS.map((col) => {
                const mappedColumn = columnMapping[col.name];
                const sampleValues = mappedColumn && parsedData.sampleRows
                  .map((row) => row[mappedColumn])
                  .filter(Boolean)
                  .slice(0, 2);

                return (
                  <div
                    key={col.name}
                    className="border hover:border-primary/20 shadow-sm hover:shadow-lg transition-all duration-300 rounded-xl p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">
                          {col.name.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {col.description}
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        {col.required && (
                          <div className="px-3 py-2 rounded-md bg-status-danger/10 inline-flex items-center gap-1.5">
                            <span className="text-sm font-medium text-status-danger">
                              Required
                            </span>
                          </div>
                        )}
                        <Select
                          value={mappedColumn || "__none__"}
                          onValueChange={(value) =>
                            handleMappingChange(col.name, value === "__none__" ? null : value)
                          }
                        >
                          <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Select column..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">
                              <span className="text-muted-foreground">Don&apos;t map</span>
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

                    {/* Preview values */}
                    {mappedColumn && sampleValues && sampleValues.length > 0 && (
                      <div className="bg-blue-500/10 rounded-xl p-3">
                        <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-1.5">Preview</p>
                        <div className="space-y-0.5">
                          {sampleValues.map((value, idx) => {
                            let displayValue = value;
                            if (col.name === "year_end_date") {
                              displayValue = formatDatePreview(value);
                            } else if (col.name === "vat_registered") {
                              displayValue = formatVatRegisteredPreview(value);
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
              Back
            </ButtonBase>
            <ButtonBase variant="blue" buttonType="icon-text" onClick={() => {
              setIsMappingRows(true);
              // Defer to next frame so the spinner renders before the sync transform blocks
              requestAnimationFrame(() => {
                handleProceedWithMapping();
                setIsMappingRows(false);
              });
            }} disabled={isMappingRows}>
              {isMappingRows ? (
                <><Loader2 className="size-4 animate-spin" /> Processing...</>
              ) : (
                <>Review Data <ArrowRight className="size-4" /></>
              )}
            </ButtonBase>
          </div>
        </div>
      )}

      {stepState === "edit-data" && (
        <CsvImportTable
          editableRows={editableRows}
          onRowsChange={setEditableRows}
          onCellEdit={handleCellEdit}
          onDeleteRow={handleDeleteRow}
          onComplete={onComplete}
          onBack={onBack}
          onStartOver={handleStartOver}
          clientLimit={clientLimit}
          currentClientCount={currentClientCount}
          selectedClientTypes={selectedClientTypes}
          error={error}
        />
      )}

    </div>
  );
}
