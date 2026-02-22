"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrgId, getOrgContext } from "@/lib/auth/org-context";
import { requireWriteAccess } from "@/lib/billing/read-only-mode";
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
  vat_scheme: "Standard" | "Flat Rate" | "Cash Accounting" | "Annual Accounting" | null;
  reminders_paused: boolean;
  records_received_for: string[] | null; // Array of filing_type_id strings
  completed_for: string[] | null; // Array of filing_type_id strings for which accountant has completed processing
  synced_at: string | null;
  created_at: string;
  updated_at: string;
}

// Partial type for metadata updates
export type ClientMetadata = Pick<
  Client,
  "primary_email" | "phone" | "client_type" | "year_end_date" | "vat_registered" | "vat_stagger_group" | "vat_scheme" | "reminders_paused" | "records_received_for" | "completed_for"
>;

// Bulk update fields (only fields that can be bulk-edited)
export interface BulkUpdateFields {
  client_type?: "Limited Company" | "Sole Trader" | "Partnership" | "LLP" | null;
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
  // Enforce billing: block mutations when subscription is inactive
  const orgId = await getOrgId();
  await requireWriteAccess(orgId);

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
  client_type: z.enum(["Limited Company", "Sole Trader", "Partnership", "LLP"]).optional().nullable(),
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
  // Enforce billing: block mutations when subscription is inactive
  const orgId = await getOrgId();
  await requireWriteAccess(orgId);

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

/**
 * Reassign all clients from one accountant to another within the same org.
 *
 * Admin-only action. Uses the service-role client to bypass owner-scoped RLS.
 * Validates that both users belong to the caller's org before updating.
 */
export async function reassignClients(
  fromUserId: string,
  toUserId: string
): Promise<{ error?: string; reassigned?: number }> {
  const { orgId, orgRole } = await getOrgContext();

  if (orgRole !== "admin") {
    return { error: "Only admins can reassign clients." };
  }

  // Enforce billing: block mutations when subscription is inactive
  try {
    await requireWriteAccess(orgId);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Subscription inactive" };
  }

  const admin = createAdminClient();

  // Validate both users belong to this org
  const { data: fromMembership } = await admin
    .from("user_organisations")
    .select("user_id")
    .eq("org_id", orgId)
    .eq("user_id", fromUserId)
    .maybeSingle();

  if (!fromMembership) {
    return { error: "Source accountant is not a member of this organisation." };
  }

  const { data: toMembership } = await admin
    .from("user_organisations")
    .select("user_id")
    .eq("org_id", orgId)
    .eq("user_id", toUserId)
    .maybeSingle();

  if (!toMembership) {
    return { error: "Target accountant is not a member of this organisation." };
  }

  // Use admin client to bypass owner-scoped RLS
  const { error, count } = await admin
    .from("clients")
    .update({ owner_id: toUserId, updated_at: new Date().toISOString() })
    .eq("org_id", orgId)
    .eq("owner_id", fromUserId);

  if (error) {
    console.error("reassignClients: failed to update clients:", error);
    return { error: "Failed to reassign clients. Please try again." };
  }

  return { reassigned: count ?? 0 };
}

/**
 * Delete multiple clients
 */
export async function deleteClients(
  clientIds: string[]
): Promise<{ success: boolean; count: number }> {
  // Enforce billing: block mutations when subscription is inactive
  const orgId = await getOrgId();
  await requireWriteAccess(orgId);

  const supabase = await createClient();

  const { error, count } = await supabase
    .from("clients")
    .delete()
    .in("id", clientIds);

  if (error) {
    throw new Error(`Failed to delete clients: ${error.message}`);
  }

  return { success: true, count: count || 0 };
}
