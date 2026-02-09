"use server";

import { createClient } from "@/lib/supabase/server";
import { updateClientMetadataSchema, clientTypeSchema } from "@/lib/validations/client";
import { z } from "zod";

// Client type matching the database schema
export interface Client {
  id: string;
  quickbooks_id: string;
  company_name: string;
  display_name: string | null;
  primary_email: string | null;
  phone: string | null;
  active: boolean;
  client_type: "Limited Company" | "Sole Trader" | "Partnership" | "LLP" | null;
  year_end_date: string | null; // ISO date string (YYYY-MM-DD)
  vat_registered: boolean;
  vat_stagger_group: 1 | 2 | 3 | null;
  vat_frequency: string | null;
  vat_scheme: "Standard" | "Flat Rate" | "Cash Accounting" | "Annual Accounting" | null;
  has_overrides: boolean;
  reminders_paused: boolean;
  synced_at: string | null;
  created_at: string;
  updated_at: string;
}

// Partial type for metadata updates
export type ClientMetadata = Pick<
  Client,
  "client_type" | "year_end_date" | "vat_registered" | "vat_stagger_group" | "vat_scheme"
>;

// Bulk update fields (only fields that can be bulk-edited)
export interface BulkUpdateFields {
  year_end_date?: string | null;
  vat_registered?: boolean;
  vat_stagger_group?: 1 | 2 | 3 | null;
}

/**
 * Fetch all clients from Supabase, ordered by company_name
 */
export async function getClients(): Promise<Client[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .order("company_name", { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch clients: ${error.message}`);
  }

  return data || [];
}

/**
 * Update a single client's metadata
 */
export async function updateClientMetadata(
  clientId: string,
  data: Partial<ClientMetadata>
): Promise<Client> {
  const supabase = await createClient();

  // Validate input with Zod schema
  const validationResult = updateClientMetadataSchema.safeParse(data);
  
  if (!validationResult.success) {
    throw new Error(
      `Validation failed: ${validationResult.error.issues.map((e: { message: string }) => e.message).join(", ")}`
    );
  }

  // Update the client in Supabase
  const { data: updatedClient, error } = await supabase
    .from("clients")
    .update({
      ...validationResult.data,
      updated_at: new Date().toISOString(),
    })
    .eq("id", clientId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update client: ${error.message}`);
  }

  return updatedClient;
}

// Bulk update validation schema
const bulkUpdateFieldsSchema = z.object({
  year_end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  vat_registered: z.boolean().optional(),
  vat_stagger_group: z.number().int().min(1).max(3).optional().nullable(),
});

/**
 * Bulk update multiple clients
 * Only allows updating: year_end_date, vat_registered, vat_stagger_group
 * Client type must be set individually
 */
export async function bulkUpdateClients(
  clientIds: string[],
  updates: BulkUpdateFields
): Promise<{ success: boolean; count: number }> {
  const supabase = await createClient();

  // Validate that only bulk-editable fields are included
  const validationResult = bulkUpdateFieldsSchema.safeParse(updates);
  
  if (!validationResult.success) {
    throw new Error(
      `Validation failed: ${validationResult.error.issues.map((e: { message: string }) => e.message).join(", ")}`
    );
  }

  // Build updates array for RPC call
  const updatesArray = clientIds.map((id) => ({
    id,
    metadata: validationResult.data,
  }));

  // Call the bulk_update_client_metadata Postgres function
  const { error } = await supabase.rpc("bulk_update_client_metadata", {
    updates: updatesArray,
  });

  if (error) {
    throw new Error(`Failed to bulk update clients: ${error.message}`);
  }

  return { success: true, count: clientIds.length };
}
