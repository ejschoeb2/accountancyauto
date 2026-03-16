"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { IconButtonWithText } from "@/components/ui/icon-button-with-text";
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
  FileText,
  AlertCircle,
  CheckCircle,
  AlertTriangle,
  Info,
  ArrowLeft,
  ArrowRight,
  Loader2,
  Sparkles,
  Trash2,
  Pencil,
  X,
  Download,
} from "lucide-react";
import { generateCsvTemplateWithComments, CSV_COLUMNS, rollYearEndToFuture } from "@/lib/utils/csv-template";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { EditableCell } from "@/app/(dashboard)/clients/components/editable-cell";

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
}

type StepState = "upload" | "mapping" | "edit-data";

interface ColumnMapping {
  [systemField: string]: string | null; // systemField -> CSV column name
}

interface ParsedCsvData {
  headers: string[];
  rows: Record<string, string>[];
  sampleRows: Record<string, string>[]; // First 3 rows for preview
}

export interface EditableRow {
  id: string; // UUID for React key
  company_name: string; // Required, readonly
  primary_email: string | null;
  client_type: string | null;
  year_end_date: string | null; // YYYY-MM-DD format
  vat_registered: boolean | null;
  vat_stagger_group: number | null; // 1, 2, or 3
  vat_scheme: string | null;
}

/**
 * Full-page CSV import step for the member setup wizard.
 * Runs the complete import flow (upload → mapping → edit-data → importing → results)
 * using Card-based layout instead of a Dialog wrapper.
 * The existing CsvImportDialog on the /clients page is NOT modified.
 */
export function CsvImportStep({ onComplete, onBack, initialRows, onRowsChange, onStartOver, planClientLimit }: CsvImportStepProps) {
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

  // ── Client limit state (for pre-import warning) ────────────────────────
  const [clientLimit, setClientLimit] = useState<number | null>(planClientLimit ?? null);
  const [currentClientCount, setCurrentClientCount] = useState(0);

  // ── Rollover tracking ─────────────────────────────────────────────────
  const [rolledOverCount, setRolledOverCount] = useState(0);

  // ── Notify parent whenever rows change so it can persist them ───────────
  useEffect(() => {
    onRowsChange?.(editableRows);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editableRows]);

  // ── Scroll to top when entering edit-data (prevents viewport starting at bottom) ──
  const reviewTopRef = useRef<HTMLDivElement>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (stepState === "edit-data") {
      // Scroll the page to the very top first, then ensure the table container
      // also starts at the top row (not scrolled to the bottom).
      window.scrollTo({ top: 0, behavior: "instant" });
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          window.scrollTo({ top: 0, behavior: "instant" });
          if (tableContainerRef.current) {
            tableContainerRef.current.scrollTop = 0;
          }
        });
      });
    }
  }, [stepState]);

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

  // Auto-suggest column mapping based on header names
  const autoSuggestMapping = useCallback((headers: string[]): ColumnMapping => {
    const mapping: ColumnMapping = {};

    CSV_COLUMNS.forEach((col) => {
      const systemField = col.name;

      // Try exact match first (case-insensitive)
      const exactMatch = headers.find(
        (h) => h.toLowerCase().replace(/[_\s]/g, "") === systemField.toLowerCase().replace(/[_\s]/g, "")
      );

      if (exactMatch) {
        mapping[systemField] = exactMatch;
        return;
      }

      // Try partial match
      const partialMatch = headers.find((h) => {
        const hNorm = h.toLowerCase().replace(/[_\s]/g, "");
        const sNorm = systemField.toLowerCase().replace(/[_\s]/g, "");
        return hNorm.includes(sNorm) || sNorm.includes(hNorm);
      });

      if (partialMatch) {
        mapping[systemField] = partialMatch;
      } else {
        mapping[systemField] = null;
      }
    });

    return mapping;
  }, []);

  // Parse CSV or XLSX file and advance to mapping
  const parseFile = useCallback(
    async (file: File) => {
      try {
        const fileName = file.name.toLowerCase();
        const isExcel = fileName.endsWith(".xlsx") || fileName.endsWith(".xls");

        if (isExcel) {
          // Parse Excel file
          const arrayBuffer = await file.arrayBuffer();
          const workbook = XLSX.read(arrayBuffer, { type: "array" });

          // Get first sheet
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];

          // Convert to JSON (array of arrays when header: 1)
          const jsonData = XLSX.utils.sheet_to_json(worksheet, {
            header: 1,
            defval: "",
          }) as unknown[][];

          if (jsonData.length === 0) {
            setError("Excel file is empty");
            return;
          }

          // First row is headers (filter out empty headers)
          const headers = jsonData[0]
            .map((h) => String(h).trim())
            .filter((h) => h.length > 0);
          const dataRows = jsonData.slice(1);

          // Convert to objects
          const rows = dataRows.map((row) => {
            const obj: Record<string, string> = {};
            headers.forEach((header, idx) => {
              obj[header] = String((row as unknown[])[idx] || "").trim();
            });
            return obj;
          });

          const sampleRows = rows.slice(0, 3);

          setParsedData({ headers, rows, sampleRows });

          // Auto-suggest column mapping
          const suggestedMapping = autoSuggestMapping(headers);
          setColumnMapping(suggestedMapping);

          // Advance to mapping step
          setStepState("mapping");
          setError(null);
        } else {
          // Parse CSV file — handle encoding properly.
          // file.text() always decodes as UTF-8. Excel-exported CSVs can be
          // UTF-8+BOM (adds \ufeff to the first field) or Windows-1252 (ANSI),
          // where bytes > 0x7F are misread, producing garbled characters like
          // â€™ instead of ' or â€" instead of –.
          const rawBytes = new Uint8Array(await file.arrayBuffer());
          let csvContent: string;
          if (rawBytes[0] === 0xEF && rawBytes[1] === 0xBB && rawBytes[2] === 0xBF) {
            // UTF-8 with BOM — strip the BOM before decoding
            csvContent = new TextDecoder("utf-8").decode(rawBytes.slice(3));
          } else if (rawBytes[0] === 0xFF && rawBytes[1] === 0xFE) {
            // UTF-16 LE BOM
            csvContent = new TextDecoder("utf-16le").decode(rawBytes.slice(2));
          } else {
            // No BOM — try UTF-8; if the decoded text contains replacement
            // characters (U+FFFD), fall back to Windows-1252 which is the
            // default encoding for older Excel / UK accounting software.
            csvContent = new TextDecoder("utf-8").decode(rawBytes);
            if (csvContent.includes("\uFFFD")) {
              csvContent = new TextDecoder("windows-1252").decode(rawBytes);
            }
          }

          Papa.parse<Record<string, string>>(csvContent, {
            header: true,
            skipEmptyLines: true,
            complete: (result) => {
              if (result.errors.length > 0) {
                console.warn("CSV parse warnings:", result.errors);
              }

              const headers = result.meta.fields || [];
              const rows = result.data;
              const sampleRows = rows.slice(0, 3);

              setParsedData({ headers, rows, sampleRows });

              // Auto-suggest column mapping
              const suggestedMapping = autoSuggestMapping(headers);
              setColumnMapping(suggestedMapping);

              // Advance to mapping step
              setStepState("mapping");
              setError(null);
            },
            error: (error: Error) => {
              setError(`Failed to parse CSV: ${error.message}`);
            },
          });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to read file");
      }
    },
    [autoSuggestMapping]
  );

  // Handle file selection — parse immediately and advance to mapping
  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        const fileName = file.name.toLowerCase();
        if (fileName.endsWith(".csv") || fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
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

  // Handle drag and drop
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
        const fileName = file.name.toLowerCase();
        if (fileName.endsWith(".csv") || fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
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

  // Continue from upload — parse the selected file
  const handleContinueUpload = useCallback(() => {
    if (selectedFile) parseFile(selectedFile);
  }, [selectedFile, parseFile]);

  // Download template
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

  // Parse date from various formats to YYYY-MM-DD
  const parseDate = useCallback((dateValue: string): string | null => {
    if (!dateValue || dateValue.trim() === "") return null;

    const trimmed = dateValue.trim();

    const MONTH_MAP: Record<string, string> = {
      jan: "01", january: "01", feb: "02", february: "02",
      mar: "03", march: "03", apr: "04", april: "04",
      may: "05", jun: "06", june: "06", jul: "07", july: "07",
      aug: "08", august: "08", sep: "09", september: "09",
      oct: "10", october: "10", nov: "11", november: "11",
      dec: "12", december: "12",
    };

    const expandYear = (yy: string) => {
      const n = parseInt(yy, 10);
      return n < 50 ? `20${yy.padStart(2, "0")}` : `19${yy.padStart(2, "0")}`;
    };

    // Already in YYYY-MM-DD format
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

    // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY (4-digit year, UK-first)
    const ddmmyyyy = trimmed.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
    if (ddmmyyyy) {
      const [, d, m, y] = ddmmyyyy;
      return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    }

    // YYYY/MM/DD or YYYY.MM.DD
    const yyyymmdd = trimmed.match(/^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})$/);
    if (yyyymmdd) {
      const [, y, m, d] = yyyymmdd;
      return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    }

    // DD/MM/YY or DD-MM-YY (2-digit year, UK-first)
    const ddmmyy = trimmed.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2})$/);
    if (ddmmyy) {
      const [, d, m, yy] = ddmmyy;
      return `${expandYear(yy)}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    }

    // "31 March 2026", "31 Mar 2026", "31-Mar-2026", "31/Mar/2026"
    const dayMonthYear = trimmed.match(/^(\d{1,2})[\s\-/]([A-Za-z]+)[\s\-/](\d{2,4})$/);
    if (dayMonthYear) {
      const [, d, monthStr, yearStr] = dayMonthYear;
      const m = MONTH_MAP[monthStr.toLowerCase()];
      if (m) {
        const y = yearStr.length === 2 ? expandYear(yearStr) : yearStr;
        return `${y}-${m}-${d.padStart(2, "0")}`;
      }
    }

    // "March 31, 2026", "March 31 2026", "Mar 31 2026"
    const monthDayYear = trimmed.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{2,4})$/);
    if (monthDayYear) {
      const [, monthStr, d, yearStr] = monthDayYear;
      const m = MONTH_MAP[monthStr.toLowerCase()];
      if (m) {
        const y = yearStr.length === 2 ? expandYear(yearStr) : yearStr;
        return `${y}-${m}-${d.padStart(2, "0")}`;
      }
    }

    // Excel date serial number (days since 1900-01-01)
    const serialNumber = parseFloat(trimmed);
    if (!isNaN(serialNumber) && serialNumber > 1000 && /^\d+(\.\d+)?$/.test(trimmed)) {
      const excelEpoch = new Date(1900, 0, 1);
      const daysOffset = serialNumber > 59 ? serialNumber - 2 : serialNumber - 1;
      const date = new Date(excelEpoch.getTime() + daysOffset * 24 * 60 * 60 * 1000);
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    }

    return null;
  }, []);

  // Validate that required fields are mapped
  const validateMapping = useCallback((): string | null => {
    const requiredFields = CSV_COLUMNS.filter((col) => col.required);

    for (const field of requiredFields) {
      if (!columnMapping[field.name]) {
        return `Required field "${field.name}" must be mapped to a column`;
      }
    }

    return null;
  }, [columnMapping]);

  // Apply mapping and proceed to edit-data step
  const handleProceedWithMapping = useCallback(() => {
    if (!parsedData) return;

    // Validate mapping
    const validationError = validateMapping();
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);

    // Transform rows based on column mapping into editable format
    let rolloverCount = 0;
    const transformed = parsedData.rows
      .map((row) => {
        const mappedData: Record<string, string> = {};

        Object.entries(columnMapping).forEach(([systemField, csvColumn]) => {
          if (csvColumn) {
            mappedData[systemField] = row[csvColumn] || "";
          }
        });

        // Detect if year end was rolled forward
        const parsedDate = parseDate(mappedData.year_end_date || "");
        const rolledDate = rollYearEndToFuture(parsedDate);
        if (parsedDate && rolledDate && parsedDate !== rolledDate) {
          rolloverCount++;
        }

        // Convert to EditableRow format
        const editableRow: EditableRow = {
          id: crypto.randomUUID(),
          company_name: mappedData.company_name || "",
          primary_email: mappedData.primary_email || null,
          client_type: mappedData.client_type || null,
          year_end_date: rolledDate,
          vat_registered: mappedData.vat_registered
            ? ["yes", "true", "1"].includes(mappedData.vat_registered.toLowerCase())
            : true, // Default to true if not specified
          vat_stagger_group: mappedData.vat_stagger_group
            ? parseInt(mappedData.vat_stagger_group, 10)
            : null,
          vat_scheme: mappedData.vat_scheme || null,
        };

        return editableRow;
      })
      // Filter out rows with empty company names (data cleansing)
      .filter((row) => row.company_name.trim() !== "");

    setRolledOverCount(rolloverCount);
    setEditableRows(transformed);
    setStepState("edit-data");
  }, [parsedData, columnMapping, validateMapping, parseDate]);

  // Handle mapping change
  const handleMappingChange = useCallback((systemField: string, csvColumn: string | null) => {
    setColumnMapping((prev) => ({
      ...prev,
      [systemField]: csvColumn,
    }));
  }, []);

  // Handle cell edit in edit-data step
  const handleCellEdit = useCallback(async (rowId: string, field: string, value: unknown) => {
    setEditableRows((prev) =>
      prev.map((row) => (row.id === rowId ? { ...row, [field]: value } : row))
    );
  }, []);

  // Handle row deletion in edit-data step
  const handleDeleteRow = useCallback((rowId: string) => {
    setEditableRows((prev) => prev.filter((row) => row.id !== rowId));
    setSelectedRowIds((prev) => {
      const next = new Set(prev);
      next.delete(rowId);
      return next;
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
    setEditableRows((prev) => prev.filter((row) => !selectedRowIds.has(row.id)));
    setSelectedRowIds(new Set());
  }, [selectedRowIds]);

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
      changes.push(`Client Type → ${bulkClientType.value}`);
    }
    if (bulkYearEnd.enabled && bulkYearEnd.value) {
      const [y, m, d] = bulkYearEnd.value.split("-");
      changes.push(`Year End Date → ${d}/${m}/${y}`);
    }
    if (bulkVatRegistered.enabled) {
      changes.push(`VAT Registered → ${bulkVatRegistered.value ? "Yes" : "No"}`);
    }
    if (bulkVatStagger.enabled && bulkVatStagger.value) {
      const labels: Record<number, string> = {
        1: "Stagger 1 (Mar/Jun/Sep/Dec)",
        2: "Stagger 2 (Jan/Apr/Jul/Oct)",
        3: "Stagger 3 (Feb/May/Aug/Nov)",
      };
      changes.push(`VAT Stagger → ${labels[bulkVatStagger.value]}`);
    }
    if (bulkVatScheme.enabled && bulkVatScheme.value) {
      changes.push(`VAT Scheme → ${bulkVatScheme.value}`);
    }
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
        if (bulkClientType.enabled && bulkClientType.value) {
          updated.client_type = bulkClientType.value;
        }
        if (bulkYearEnd.enabled && bulkYearEnd.value) {
          updated.year_end_date = bulkYearEnd.value;
        }
        if (bulkVatRegistered.enabled) {
          updated.vat_registered = bulkVatRegistered.value;
        }
        if (bulkVatStagger.enabled) {
          updated.vat_stagger_group = bulkVatStagger.value ? Number(bulkVatStagger.value) : null;
        }
        if (bulkVatScheme.enabled) {
          updated.vat_scheme = bulkVatScheme.value;
        }
        return updated;
      })
    );

    setSelectedRowIds(new Set());
    handleCloseBulkEdit();
  }, [selectedRowIds, bulkClientType, bulkYearEnd, bulkVatRegistered, bulkVatStagger, bulkVatScheme, bulkConfirmStep, bulkHasChanges, handleCloseBulkEdit]);

  // Import with edited data
  // Go back to upload
  const handleBackToUpload = useCallback(() => {
    setStepState("upload");
    setSelectedFile(null);
    setParsedData(null);
    setColumnMapping({});
    setEditableRows([]);
    setError(null);
  }, []);

  // Go back to mapping from edit-data
  const handleBackToMapping = useCallback(() => {
    setStepState("mapping");
    setError(null);
    setSelectedRowIds(new Set());
  }, []);

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
                            // Format preview value based on field type
                            let displayValue = value;
                            if (col.name === "year_end_date") {
                              const parsedDateVal = parseDate(value);
                              if (parsedDateVal) {
                                // Format as DD/MM/YYYY for preview
                                const [year, month, day] = parsedDateVal.split("-");
                                displayValue = `${day}/${month}/${year}`;
                              } else {
                                displayValue = value + " (invalid date)";
                              }
                            } else if (col.name === "vat_registered") {
                              const isYes = ["yes", "true", "1"].includes(value.toLowerCase());
                              displayValue = isYes ? "Yes" : "No";
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
                onClick={() => {
                  onStartOver?.();
                  setStepState("upload");
                  setSelectedFile(null);
                  setParsedData(null);
                  setColumnMapping({});
                  setEditableRows([]);
                  setError(null);
                }}
              >
                <Trash2 className="size-4" />
                Start Over
              </ButtonBase>
            </div>
          </div>

          {(() => {
            const incompleteRows = editableRows.filter(
              (row) => !row.primary_email || !row.client_type || !row.year_end_date
            );

            // Calculate how many rows can be imported within the plan limit
            const remainingCapacity = clientLimit === null ? Infinity : clientLimit - currentClientCount;
            const overLimitCount = remainingCapacity === Infinity ? 0 : Math.max(0, editableRows.length - remainingCapacity);
            const importableCount = remainingCapacity === Infinity ? editableRows.length : Math.min(editableRows.length, Math.max(0, remainingCapacity));

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

                {rolledOverCount > 0 && (
                  <div className="flex items-start gap-3 p-4 bg-blue-500/10 rounded-xl">
                    <Info className="size-5 text-blue-600 shrink-0 mt-0.5" />
                    <p className="text-sm text-blue-600">
                      <strong>{rolledOverCount} {rolledOverCount === 1 ? "client has" : "clients have"}</strong>{" "}
                      a year end date that has already passed, so {rolledOverCount === 1 ? "it has" : "they have"} been
                      rolled forward to the next tax year. You can adjust individual dates in the table below.
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
                              {row.company_name || "—"}
                            </TableCell>

                            {/* Email (required) */}
                            <TableCell className={cn(
                              "transition-colors",
                              isMissingEmail && "bg-amber-100/60"
                            )}>
                              <EditableCell
                                value={row.primary_email || ""}
                                onSave={(value) => handleCellEdit(row.id, "primary_email", value || null)}
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
                                onSave={(value) => handleCellEdit(row.id, "client_type", value)}
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
                                onSave={(value) => handleCellEdit(row.id, "year_end_date", value)}
                                type="date"
                                isEditMode
                              />
                            </TableCell>

                            {/* VAT Registered - boolean */}
                            <TableCell className="text-muted-foreground group-hover:text-foreground transition-colors">
                              <EditableCell
                                value={row.vat_registered ?? ""}
                                onSave={(value) => handleCellEdit(row.id, "vat_registered", value)}
                                type="boolean"
                                isEditMode
                              />
                            </TableCell>

                            {/* VAT Stagger Group - select */}
                            <TableCell className="text-muted-foreground group-hover:text-foreground transition-colors">
                              <EditableCell
                                value={row.vat_stagger_group ? String(row.vat_stagger_group) : ""}
                                onSave={(value) =>
                                  handleCellEdit(row.id, "vat_stagger_group", value ? parseInt(String(value), 10) : null)
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
                                onSave={(value) => handleCellEdit(row.id, "vat_scheme", value)}
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
                                <span className="text-primary">•</span>
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
            );
          })()}
        </>
      )}

    </div>
  );
}
