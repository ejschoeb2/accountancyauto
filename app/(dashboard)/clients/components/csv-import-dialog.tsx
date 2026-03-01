"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ButtonBase } from "@/components/ui/button-base";
import { FileText, AlertCircle, Loader2, X, Download } from "lucide-react";
import { generateCsvTemplate, CSV_COLUMNS } from "@/lib/utils/csv-template";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Papa from "papaparse";
import * as XLSX from "xlsx";

interface CsvImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ParsedCsvData {
  headers: string[];
  rows: Record<string, string>[];
  sampleRows: Record<string, string>[];
}

/**
 * Upload-only dialog. Parses the file then hands off to /clients/import page
 * via sessionStorage for the full mapping → edit → import flow.
 */
export function CsvImportDialog({ open, onOpenChange }: CsvImportDialogProps) {
  const router = useRouter();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Client limit (for upfront warning)
  const [clientLimit, setClientLimit] = useState<number | null>(null);
  const [currentClientCount, setCurrentClientCount] = useState(0);
  const [limitLoaded, setLimitLoaded] = useState(false);

  const atLimit = clientLimit !== null && currentClientCount >= clientLimit;

  useEffect(() => {
    if (!open) {
      setSelectedFile(null);
      setError(null);
      setIsDragging(false);
      setIsParsing(false);
      setLimitLoaded(false);
      return;
    }

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

        setClientLimit(org?.client_count_limit ?? null);
        setCurrentClientCount(count ?? 0);
      } catch {
        // Non-blocking
      } finally {
        setLimitLoaded(true);
      }
    }

    fetchLimit();
  }, [open]);

  // Parse the file and navigate to the import page
  const parseAndNavigate = useCallback(
    async (file: File) => {
      setIsParsing(true);
      setError(null);

      try {
        const fileName = file.name.toLowerCase();
        const isExcel = fileName.endsWith(".xlsx") || fileName.endsWith(".xls");
        let parsedData: ParsedCsvData;

        if (isExcel) {
          const arrayBuffer = await file.arrayBuffer();
          const workbook = XLSX.read(arrayBuffer, { type: "array" });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, {
            header: 1,
            defval: "",
          }) as unknown[][];

          if (jsonData.length === 0) {
            setError("Excel file is empty");
            setIsParsing(false);
            return;
          }

          const headers = jsonData[0]
            .map((h) => String(h).trim())
            .filter((h) => h.length > 0);
          const dataRows = jsonData.slice(1);

          const rows = dataRows.map((row) => {
            const obj: Record<string, string> = {};
            headers.forEach((header, idx) => {
              obj[header] = String((row as unknown[])[idx] || "").trim();
            });
            return obj;
          });

          parsedData = { headers, rows, sampleRows: rows.slice(0, 3) };
        } else {
          const csvContent = await file.text();
          parsedData = await new Promise<ParsedCsvData>((resolve, reject) => {
            Papa.parse<Record<string, string>>(csvContent, {
              header: true,
              skipEmptyLines: true,
              complete: (result) => {
                resolve({
                  headers: result.meta.fields || [],
                  rows: result.data,
                  sampleRows: result.data.slice(0, 3),
                });
              },
              error: (err: Error) => reject(err),
            });
          });
        }

        // Store parsed data for the import page
        sessionStorage.setItem(
          "csv-import-data",
          JSON.stringify({
            parsedData,
            clientLimit,
            currentClientCount,
          })
        );

        onOpenChange(false);
        router.push("/clients/import");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to read file");
        setIsParsing(false);
      }
    },
    [router, onOpenChange, clientLimit, currentClientCount]
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        const fileName = file.name.toLowerCase();
        if (
          fileName.endsWith(".csv") ||
          fileName.endsWith(".xlsx") ||
          fileName.endsWith(".xls")
        ) {
          setSelectedFile(file);
          parseAndNavigate(file);
        } else {
          setError("Please select a CSV or Excel file (.csv, .xlsx)");
          setSelectedFile(null);
        }
      }
    },
    [parseAndNavigate]
  );

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
        if (
          fileName.endsWith(".csv") ||
          fileName.endsWith(".xlsx") ||
          fileName.endsWith(".xls")
        ) {
          setSelectedFile(file);
          parseAndNavigate(file);
        } else {
          setError("Please select a CSV or Excel file (.csv, .xlsx)");
        }
      }
    },
    [parseAndNavigate]
  );

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

  const requiredColumns = CSV_COLUMNS.filter((col) => col.required);
  const optionalColumns = CSV_COLUMNS.filter((col) => !col.required);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Import Clients</DialogTitle>
          <DialogDescription>
            Upload a CSV or Excel file to import client data.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Plan limit warning */}
          {limitLoaded && atLimit && (
            <div className="flex items-start gap-2 text-sm p-3 bg-red-500/10 border border-red-200 text-red-800 rounded-lg">
              <AlertCircle className="size-4 mt-0.5 shrink-0" />
              <span>
                You&apos;ve reached your plan limit of{" "}
                <strong>{clientLimit}</strong> clients. Upgrade your plan to
                import more.
              </span>
            </div>
          )}

          {/* Field reference */}
          <div className="text-sm text-muted-foreground space-y-1">
            <p>
              <span className="font-medium text-foreground">Required:</span>{" "}
              {requiredColumns.map((col) => col.name).join(", ")}
            </p>
            <p>
              <span className="font-medium text-foreground">Optional:</span>{" "}
              {optionalColumns.map((col) => col.name).join(", ")}
            </p>
            <div className="pt-1">
              <ButtonBase
                variant="violet"
                buttonType="icon-text"
                onClick={handleDownloadTemplate}
              >
                <Download className="size-4" />
                Download template
              </ButtonBase>
            </div>
          </div>

          {/* Drop zone */}
          <div
            className={cn(
              "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
              isDragging
                ? "border-accent bg-accent/5"
                : "border-muted-foreground/25 hover:border-muted-foreground/50",
              error && "border-destructive bg-destructive/5",
              isParsing && "pointer-events-none opacity-60"
            )}
            onClick={() => !isParsing && fileInputRef.current?.click()}
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
            {isParsing ? (
              <div className="space-y-2">
                <Loader2 className="size-8 mx-auto text-muted-foreground animate-spin" />
                <p className="text-sm text-muted-foreground">Reading file…</p>
              </div>
            ) : (
              <>
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
                      CSV or Excel files (.csv, .xlsx)
                    </p>
                  </div>
                )}
              </>
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
          <ButtonBase
            type="button"
            onClick={() => onOpenChange(false)}
            buttonType="icon-text"
            variant="destructive"
          >
            <X className="size-4" />
            Close
          </ButtonBase>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
