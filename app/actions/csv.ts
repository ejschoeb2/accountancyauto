"use server";

import Papa from "papaparse";
import { csvRowSchema, type CsvValidationError } from "@/lib/validations/csv";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

/**
 * Summary of the CSV import operation
 */
export interface CsvImportSummary {
  totalRows: number;
  validRows: number;
  matchedClients: number;
  unmatchedRows: number;
  validationErrors: number;
  updatedClients: number;
}

/**
 * Details of the CSV import operation including unmatched companies and validation errors
 */
export interface CsvImportDetails {
  unmatchedCompanies: string[];
  validationErrors: CsvValidationError[];
}

/**
 * Result of the CSV import operation
 */
export interface CsvImportResult {
  success: boolean;
  summary: CsvImportSummary;
  details: CsvImportDetails;
}

const MAX_FILE_SIZE = 1024 * 1024; // 1MB

/**
 * Import client metadata from a CSV file
 * @param formData - FormData containing the CSV file
 * @returns Result of the import operation
 */
export async function importClientMetadata(
  formData: FormData
): Promise<CsvImportResult> {
  const result: CsvImportResult = {
    success: false,
    summary: {
      totalRows: 0,
      validRows: 0,
      matchedClients: 0,
      unmatchedRows: 0,
      validationErrors: 0,
      updatedClients: 0,
    },
    details: {
      unmatchedCompanies: [],
      validationErrors: [],
    },
  };

  try {
    // 1. Extract and validate file
    const file = formData.get("file") as File | null;

    if (!file) {
      throw new Error("No file provided");
    }

    // Validate file type
    if (!file.name.toLowerCase().endsWith(".csv")) {
      throw new Error("File must be a CSV file");
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      throw new Error("File size exceeds 1MB limit");
    }

    // 2. Read file content
    const csvContent = await file.text();

    // 3. Parse CSV with PapaParse
    const parseResult = Papa.parse<Record<string, string>>(csvContent, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, "_"),
    });

    if (parseResult.errors.length > 0) {
      console.error("CSV parse errors:", parseResult.errors);
    }

    const rows = parseResult.data;
    result.summary.totalRows = rows.length;

    // 4. Validate each row
    const validRows: Array<{
      rowIndex: number;
      data: z.infer<typeof csvRowSchema>;
    }> = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = i + 2; // +2 because header is row 1, and we want 1-based indexing for users

      const parseResult = csvRowSchema.safeParse(row);

      if (parseResult.success) {
        validRows.push({
          rowIndex: i,
          data: parseResult.data,
        });
      } else {
        const errors = parseResult.error.issues.map(
          (err) => `${String(err.path[0])}: ${err.message}`
        );
        result.details.validationErrors.push({
          row: rowNumber,
          errors,
        });
      }
    }

    result.summary.validRows = validRows.length;
    result.summary.validationErrors = result.details.validationErrors.length;

    // If no valid rows, return early
    if (validRows.length === 0) {
      result.success = true; // Still consider it a successful operation, just with no valid data
      return result;
    }

    // 5. Fetch existing clients from Supabase
    const supabase = await createClient();
    const { data: existingClients, error: fetchError } = await supabase
      .from("clients")
      .select("id, company_name");

    if (fetchError) {
      throw new Error(`Failed to fetch clients: ${fetchError.message}`);
    }

    // Create a map of lowercase company names to client IDs for case-insensitive matching
    const companyNameMap = new Map(
      existingClients?.map((client) => [
        client.company_name.toLowerCase().trim(),
        client.id,
      ]) || []
    );

    // 6. Match valid CSV rows to existing clients
    const matchedUpdates: Array<{ id: string; metadata: Record<string, unknown> }> = [];
    const unmatchedCompanies: string[] = [];

    for (const { data: row } of validRows) {
      const companyName = row.company_name.toLowerCase().trim();
      const clientId = companyNameMap.get(companyName);

      if (clientId) {
        // Build update object - only include non-undefined fields
        const metadata: Record<string, unknown> = {};

        if (row.client_type !== undefined) {
          metadata.client_type = row.client_type;
        }

        if (row.year_end_date !== undefined && row.year_end_date !== "") {
          // Convert YYYY-MM-DD to MM/DD format for storage
          const dateParts = row.year_end_date.split("-");
          if (dateParts.length === 3) {
            metadata.year_end_date = `${dateParts[1]}/${dateParts[2]}`;
          }
        }

        if (row.vat_registered !== undefined) {
          metadata.vat_registered = row.vat_registered;
        }

        if (row.vat_quarter !== undefined) {
          metadata.vat_quarter = row.vat_quarter;
        }

        if (row.vat_scheme !== undefined) {
          metadata.vat_scheme = row.vat_scheme;
        }

        // Only add to updates if there's at least one field to update
        if (Object.keys(metadata).length > 0) {
          matchedUpdates.push({
            id: clientId,
            metadata,
          });
        }
      } else {
        unmatchedCompanies.push(row.company_name);
      }
    }

    result.summary.matchedClients = matchedUpdates.length;
    result.summary.unmatchedRows = unmatchedCompanies.length;
    result.details.unmatchedCompanies = unmatchedCompanies;

    // 7. Apply updates using bulk_update_client_metadata RPC
    if (matchedUpdates.length > 0) {
      // Convert vat_quarter to Q1-Q4 format for storage
      const quarterMap: Record<string, string> = {
        "Jan-Mar": "Q1",
        "Apr-Jun": "Q2",
        "Jul-Sep": "Q3",
        "Oct-Dec": "Q4",
      };

      const updatesForRpc = matchedUpdates.map((update) => ({
        id: update.id,
        metadata: {
          ...update.metadata,
          vat_quarter: update.metadata.vat_quarter
            ? quarterMap[update.metadata.vat_quarter as string]
            : undefined,
        },
      }));

      const { error: updateError } = await supabase.rpc(
        "bulk_update_client_metadata",
        {
          updates: updatesForRpc,
        }
      );

      if (updateError) {
        throw new Error(`Failed to update clients: ${updateError.message}`);
      }

      result.summary.updatedClients = matchedUpdates.length;
    }

    result.success = true;
    return result;
  } catch (error) {
    console.error("CSV import error:", error);
    throw error instanceof Error
      ? error
      : new Error("An unexpected error occurred during import");
  }
}
