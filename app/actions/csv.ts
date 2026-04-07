"use server";

import Papa from "papaparse";
import { csvRowSchema, type CsvValidationError } from "@/lib/validations/csv";
import { createClient } from "@/lib/supabase/server";
import { checkClientLimit } from "@/lib/billing/usage-limits";
import { z } from "zod";
import { logger } from '@/lib/logger';

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
  createdClients: number;
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
  /** Present for user-facing errors that should be displayed instead of thrown */
  error?: string;
  /** Present when import was limited by plan capacity */
  limitInfo?: {
    totalNewClients: number;
    importedClients: number;
    skippedClients: number;
    currentCount: number;
    limit: number;
  };
}

const MAX_FILE_SIZE = 1024 * 1024; // 1MB

/**
 * Import client metadata from a CSV file.
 * When createIfMissing is set in FormData, new clients are created for
 * company names that don't match existing records (used by the setup wizard).
 */
export async function importClientMetadata(
  formData: FormData
): Promise<CsvImportResult> {
  const createIfMissing = formData.get("createIfMissing") === "true";

  const result: CsvImportResult = {
    success: false,
    summary: {
      totalRows: 0,
      validRows: 0,
      matchedClients: 0,
      unmatchedRows: 0,
      validationErrors: 0,
      updatedClients: 0,
      createdClients: 0,
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
      logger.error("CSV parse errors:", { error: parseResult.errors instanceof Error ? parseResult.errors.message : String(parseResult.errors) });
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
    const unmatchedRows: Array<z.infer<typeof csvRowSchema>> = [];
    const unmatchedCompanies: string[] = [];

    for (const { data: row } of validRows) {
      const companyName = row.company_name.toLowerCase().trim();
      const clientId = companyNameMap.get(companyName);

      if (clientId) {
        // Build update object - only include non-undefined fields
        const metadata: Record<string, unknown> = {};

        if (row.primary_email !== undefined) {
          metadata.primary_email = row.primary_email;
        }

        if (row.client_type !== undefined) {
          metadata.client_type = row.client_type;
        }

        if (row.year_end_date !== undefined && row.year_end_date !== "") {
          metadata.year_end_date = row.year_end_date;
        }

        if (row.vat_registered !== undefined) {
          metadata.vat_registered = row.vat_registered;
        }

        if (row.vat_stagger_group !== undefined) {
          metadata.vat_stagger_group = row.vat_stagger_group;
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
        unmatchedRows.push(row);
        if (!createIfMissing) {
          unmatchedCompanies.push(row.company_name);
        }
      }
    }

    result.summary.matchedClients = matchedUpdates.length;

    // 7. Apply updates using bulk_update_client_metadata RPC
    if (matchedUpdates.length > 0) {
      const { error: updateError } = await supabase.rpc(
        "bulk_update_client_metadata",
        {
          updates: matchedUpdates,
        }
      );

      if (updateError) {
        throw new Error(`Failed to update clients: ${updateError.message}`);
      }

      result.summary.updatedClients = matchedUpdates.length;
    }

    // 8. Create new clients for unmatched rows (wizard mode)
    if (createIfMissing && unmatchedRows.length > 0) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { ...result, success: false, error: "Your session has expired. Please sign in again." };
      }

      // Get org_id from user_organisations
      const { data: membership } = await supabase
        .from("user_organisations")
        .select("org_id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();

      if (!membership?.org_id) {
        return {
          ...result,
          success: false,
          error: "Organisation not found. Please complete the firm setup steps before importing clients.",
        };
      }

      // Check client limit before creating new clients
      const limitResult = await checkClientLimit(membership.org_id);
      const totalNewClients = unmatchedRows.length;

      if (limitResult.limit !== null) {
        const remainingCapacity = limitResult.limit - limitResult.currentCount;

        if (remainingCapacity <= 0) {
          // At limit — skip all new clients
          result.limitInfo = {
            totalNewClients,
            importedClients: 0,
            skippedClients: totalNewClients,
            currentCount: limitResult.currentCount,
            limit: limitResult.limit,
          };
          result.success = true;
          return result;
        }

        if (unmatchedRows.length > remainingCapacity) {
          // Partial import — only create up to remaining capacity
          const skipped = unmatchedRows.length - remainingCapacity;
          unmatchedRows.splice(remainingCapacity); // Truncate to remaining capacity
          result.limitInfo = {
            totalNewClients,
            importedClients: remainingCapacity,
            skippedClients: skipped,
            currentCount: limitResult.currentCount,
            limit: limitResult.limit,
          };
        }
      }

      const newClients = unmatchedRows.map((row) => ({
        company_name: row.company_name,
        org_id: membership.org_id,
        owner_id: user.id,
        active: true,
        reminders_paused: false,
        primary_email: row.primary_email || null,
        client_type: row.client_type || null,
        year_end_date: row.year_end_date && row.year_end_date !== "" ? row.year_end_date : null,
        vat_registered: row.vat_registered ?? false,
        vat_stagger_group: row.vat_stagger_group ?? null,
        vat_scheme: row.vat_scheme || null,
      }));

      const { data: createdClients, error: insertError } = await supabase
        .from("clients")
        .insert(newClients)
        .select("id, client_type, vat_registered");

      if (insertError) {
        throw new Error(`Failed to create clients: ${insertError.message}`);
      }

      result.summary.createdClients = createdClients?.length ?? 0;

      // Auto-create filing assignments for new clients based on client_type
      if (createdClients && createdClients.length > 0) {
        const { data: filingTypes } = await supabase
          .from("filing_types")
          .select("id, applicable_client_types");

        if (filingTypes && filingTypes.length > 0) {
          const assignmentsToInsert: Array<{
            org_id: string;
            client_id: string;
            filing_type_id: string;
            is_active: boolean;
          }> = [];

          for (const client of createdClients) {
            if (!client.client_type) continue;

            const applicable = filingTypes.filter((ft) => {
              if (!ft.applicable_client_types.includes(client.client_type)) return false;
              if (ft.id === "vat_return") return client.vat_registered === true;
              return true;
            });

            for (const ft of applicable) {
              assignmentsToInsert.push({
                org_id: membership.org_id,
                client_id: client.id,
                filing_type_id: ft.id,
                is_active: true,
              });
            }
          }

          if (assignmentsToInsert.length > 0) {
            const { error: assignError } = await supabase
              .from("client_filing_assignments")
              .insert(assignmentsToInsert);

            if (assignError) {
              logger.error("Failed to auto-assign filing types:", { error: assignError.message });
              // Non-fatal: clients were created, assignments can be created later
            }
          }
        }
      }
    } else {
      result.summary.unmatchedRows = unmatchedCompanies.length;
      result.details.unmatchedCompanies = unmatchedCompanies;
    }

    result.success = true;
    return result;
  } catch (error) {
    logger.error("CSV import error:", { error: (error as any)?.message ?? String(error) });
    throw error instanceof Error
      ? error
      : new Error("An unexpected error occurred during import");
  }
}
