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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
} from "lucide-react";
import { generateCsvTemplate, CSV_COLUMNS } from "@/lib/utils/csv-template";
import {
  importClientMetadata,
  type CsvImportResult,
} from "@/app/actions/csv";
import { cn } from "@/lib/utils";

interface CsvImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete: () => void;
}

type DialogState = "upload" | "importing" | "results";

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

  // Handle file selection
  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        if (file.name.toLowerCase().endsWith(".csv")) {
          setSelectedFile(file);
          setError(null);
        } else {
          setError("Please select a CSV file");
          setSelectedFile(null);
        }
      }
    },
    []
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

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      if (file.name.toLowerCase().endsWith(".csv")) {
        setSelectedFile(file);
        setError(null);
      } else {
        setError("Please select a CSV file");
        setSelectedFile(null);
      }
    }
  }, []);

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

  // Handle import
  const handleImport = useCallback(async () => {
    if (!selectedFile) return;

    setState("importing");
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const importResult = await importClientMetadata(formData);
      setResult(importResult);
      setState("results");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred"
      );
      setState("upload");
    }
  }, [selectedFile]);

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
      <DialogContent className="max-w-2xl">
        {state === "upload" && (
          <>
            <DialogHeader>
              <DialogTitle>Import Client Metadata from CSV</DialogTitle>
              <DialogDescription>
                Upload a CSV file to set metadata for your clients. Rows are
                matched by company name.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-4">
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
                  accept=".csv"
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
                      CSV files only (max 1MB)
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

              {/* Template download */}
              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div className="flex items-center gap-3">
                  <Download className="size-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Need a template?</p>
                    <p className="text-sm text-muted-foreground">
                      Download a sample CSV file
                    </p>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
                  Download
                </Button>
              </div>

              {/* Help text */}
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
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleImport} disabled={!selectedFile} className="active:scale-[0.97]">
                <Upload className="size-4" />
                Import
              </Button>
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
                      <Badge variant="default" className="bg-status-success">
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
                  <div className="flex items-center gap-2 p-4 bg-status-success/10 rounded-lg">
                    <CheckCircle className="size-5 text-status-success" />
                    <p className="text-sm text-status-success">
                      All rows imported successfully!
                    </p>
                  </div>
                )}
            </div>

            <DialogFooter>
              <Button onClick={handleDone}>Done</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
