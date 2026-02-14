"use client";

import { useState, useCallback, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
  FileText,
  AlertCircle,
  Download,
  Upload,
  Loader2,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  XCircle,
  ArrowLeft,
  ArrowRight,
  X,
  Sparkles,
} from "lucide-react";
import { generateCsvTemplate, CSV_COLUMNS } from "@/lib/utils/csv-template";
import {
  importClientMetadata,
  type CsvImportResult,
} from "@/app/actions/csv";
import { cn } from "@/lib/utils";
import Papa from "papaparse";
import * as XLSX from "xlsx";

interface CsvImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete: () => void;
}

type DialogState = "upload" | "mapping" | "importing" | "results";

interface ColumnMapping {
  [systemField: string]: string | null; // systemField -> CSV column name
}

interface ParsedCsvData {
  headers: string[];
  rows: Record<string, string>[];
  sampleRows: Record<string, string>[]; // First 3 rows for preview
}

/**
 * Dialog for importing client metadata from CSV files.
 * Supports file upload, template download, and results display.
 */
export function CsvImportDialog({
  open,
  onOpenChange,
  onImportComplete,
}: CsvImportDialogProps) {
  const [state, setState] = useState<DialogState>("upload");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedCsvData | null>(null);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({});
  const [result, setResult] = useState<CsvImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showUnmatched, setShowUnmatched] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset state when dialog opens
  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      if (!newOpen) {
        // Reset state when closing
        setTimeout(() => {
          setState("upload");
          setSelectedFile(null);
          setParsedData(null);
          setColumnMapping({});
          setResult(null);
          setError(null);
          setShowUnmatched(false);
          setShowErrors(false);
        }, 200);
      }
      onOpenChange(newOpen);
    },
    [onOpenChange]
  );

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
              obj[header] = String(row[idx] || "").trim();
            });
            return obj;
          });

          const sampleRows = rows.slice(0, 3);

          setParsedData({ headers, rows, sampleRows });

          // Auto-suggest column mapping
          const suggestedMapping = autoSuggestMapping(headers);
          setColumnMapping(suggestedMapping);

          // Advance to mapping step
          setState("mapping");
          setError(null);
        } else {
          // Parse CSV file
          const csvContent = await file.text();

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
              setState("mapping");
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

  // Handle file selection - auto-parse and advance to mapping
  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        const fileName = file.name.toLowerCase();
        if (fileName.endsWith(".csv") || fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
          setSelectedFile(file);
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
          parseFile(file);
        } else {
          setError("Please select a CSV or Excel file (.csv, .xlsx)");
          setSelectedFile(null);
        }
      }
    },
    [parseFile]
  );

  // Download template
  const handleDownloadTemplate = useCallback(() => {
    const csvContent = generateCsvTemplate();
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "client-metadata-template.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
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

  // Apply mapping and proceed to import
  const handleProceedWithMapping = useCallback(async () => {
    if (!parsedData) return;

    // Validate mapping
    const validationError = validateMapping();
    if (validationError) {
      setError(validationError);
      return;
    }

    setState("importing");
    setError(null);

    try {
      // Transform rows based on column mapping
      const transformedRows = parsedData.rows.map((row) => {
        const transformed: Record<string, string> = {};

        Object.entries(columnMapping).forEach(([systemField, csvColumn]) => {
          if (csvColumn) {
            transformed[systemField] = row[csvColumn] || "";
          }
        });

        return transformed;
      });

      // Create a CSV string from transformed data
      const headers = CSV_COLUMNS.map((col) => col.name).join(",");
      const csvRows = transformedRows.map((row) =>
        CSV_COLUMNS.map((col) => {
          const value = row[col.name] || "";
          // Escape quotes and wrap in quotes if contains comma/quote/newline
          if (value.includes(",") || value.includes('"') || value.includes("\n")) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        }).join(",")
      );
      const csvContent = [headers, ...csvRows].join("\n");

      // Create a new File object with transformed CSV
      const transformedFile = new File([csvContent], selectedFile?.name || "import.csv", {
        type: "text/csv",
      });

      const formData = new FormData();
      formData.append("file", transformedFile);

      const importResult = await importClientMetadata(formData);
      setResult(importResult);
      setState("results");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred"
      );
      setState("mapping");
    }
  }, [parsedData, columnMapping, validateMapping, selectedFile]);

  // Handle mapping change
  const handleMappingChange = useCallback((systemField: string, csvColumn: string | null) => {
    setColumnMapping((prev) => ({
      ...prev,
      [systemField]: csvColumn,
    }));
  }, []);

  // Go back to upload
  const handleBackToUpload = useCallback(() => {
    setState("upload");
    setSelectedFile(null);
    setParsedData(null);
    setColumnMapping({});
    setError(null);
  }, []);

  // Handle done
  const handleDone = useCallback(() => {
    handleOpenChange(false);
    if (result?.success && result.summary.updatedClients > 0) {
      onImportComplete();
    }
  }, [handleOpenChange, onImportComplete, result]);

  // Required and optional columns for display
  const requiredColumns = CSV_COLUMNS.filter((col) => col.required);
  const optionalColumns = CSV_COLUMNS.filter((col) => !col.required);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-4xl" showCloseButton={false}>
        {state === "upload" && (
          <>
            <DialogHeader>
              <DialogTitle>Import Client Metadata</DialogTitle>
              <DialogDescription>
                Upload a CSV or Excel file to set metadata for your clients. Rows are
                matched by company name.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-4">
              {/* Help text - moved above */}
              <div className="text-sm text-muted-foreground space-y-2">
                <p>
                  <span className="font-medium text-foreground">Required:</span>{" "}
                  {requiredColumns.map((col) => col.name).join(", ")}
                </p>
                <p>
                  <span className="font-medium text-foreground">Optional:</span>{" "}
                  {optionalColumns.map((col) => col.name).join(", ")}
                </p>
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
                    <p className="text-sm text-muted-foreground">
                      Click to change file
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="font-medium">
                      Click to upload or drag and drop
                    </p>
                    <p className="text-sm text-muted-foreground">
                      CSV or Excel files (.csv, .xlsx) - max 1MB
                    </p>
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

            <DialogFooter>
              <IconButtonWithText variant="destructive" onClick={() => handleOpenChange(false)}>
                <X className="h-5 w-5" />
                Cancel
              </IconButtonWithText>
            </DialogFooter>
          </>
        )}

        {state === "mapping" && parsedData && (
          <>
            <DialogHeader>
              <DialogTitle>Map CSV Columns</DialogTitle>
              <DialogDescription>
                Match your CSV columns to the system fields. Mapping is optional - you can enter values manually later.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4 max-h-[500px] overflow-y-auto">
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
                      className="border rounded-lg p-4 space-y-3 hover:border-foreground/20 transition-colors"
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
                        <div className="bg-muted/50 rounded p-2 text-xs">
                          <p className="text-muted-foreground mb-1">Preview:</p>
                          <div className="space-y-0.5">
                            {sampleValues.map((value, idx) => (
                              <p key={idx} className="font-mono truncate">
                                {value}
                              </p>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <DialogFooter>
              <IconButtonWithText variant="destructive" onClick={handleBackToUpload}>
                <X className="h-5 w-5" />
                Cancel
              </IconButtonWithText>
              <IconButtonWithText variant="green" onClick={handleProceedWithMapping}>
                <Sparkles className="h-5 w-5" />
                Import
              </IconButtonWithText>
            </DialogFooter>
          </>
        )}

        {state === "importing" && (
          <div className="py-12 flex flex-col items-center justify-center space-y-4">
            <Loader2 className="size-8 animate-spin text-primary" />
            <div className="text-center space-y-2">
              <p className="font-medium text-lg">Importing...</p>
              <p className="text-sm text-muted-foreground">
                Processing your CSV file and updating client records
              </p>
            </div>
          </div>
        )}

        {state === "results" && result && (
          <>
            <DialogHeader>
              <DialogTitle>Import Complete</DialogTitle>
              <DialogDescription>
                Your CSV file has been processed. Here&apos;s a summary of the
                results.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-4">
              {/* Summary cards */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    Total rows processed
                  </p>
                  <p className="text-2xl font-semibold">
                    {result.summary.totalRows}
                  </p>
                </div>
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">Clients updated</p>
                  <div className="flex items-center gap-2">
                    <p className="text-2xl font-semibold">
                      {result.summary.updatedClients}
                    </p>
                    {result.summary.updatedClients > 0 && (
                      <Badge variant="default" className="bg-green-500">
                        <CheckCircle className="size-4 mr-1" />
                        Success
                      </Badge>
                    )}
                  </div>
                </div>
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
                    <Badge variant="outline" className="ml-auto text-status-warning">
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

              {/* Success message if no issues */}
              {result.summary.unmatchedRows === 0 &&
                result.summary.validationErrors === 0 && (
                  <div className="flex items-center gap-2 p-4 bg-green-500/10 rounded-lg">
                    <CheckCircle className="size-5 text-green-600" />
                    <p className="text-sm text-green-600">
                      All rows imported successfully!
                    </p>
                  </div>
                )}
            </div>

            <DialogFooter>
              <ButtonBase variant="green" buttonType="text-only" onClick={handleDone}>
                Done
              </ButtonBase>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
