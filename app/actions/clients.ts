"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrgId, getOrgContext } from "@/lib/auth/org-context";
import { requireWriteAccess } from "@/lib/billing/read-only-mode";
import { updateClientMetadataSchema, clientTypeSchema } from "@/lib/validations/client";
import { calculateFilingTypeStatus, type TrafficLightStatus } from "@/lib/dashboard/traffic-light";
import { logger } from '@/lib/logger';

// Client type matching the database schema
export interface Client {
  id: string;
  company_name: string;
  display_name: string | null;
  primary_email: string | null;
  phone: string | null;
  active: boolean;
  client_type: "Limited Company" | "Partnership" | "LLP" | "Individual" | null;
  year_end_date: string | null; // ISO date string (YYYY-MM-DD)
  vat_registered: boolean;
  vat_stagger_group: 1 | 2 | 3 | null;
  vat_scheme: "Standard" | "Flat Rate" | "Cash Accounting" | "Annual Accounting" | null;
  reminders_paused: boolean;
  records_received_for: string[] | null; // Array of filing_type_id strings
  completed_for: string[] | null; // Array of filing_type_id strings for which accountant has completed processing
  created_at: string;
  updated_at: string;
}

// Partial type for metadata updates
export type ClientMetadata = Pick<
  Client,
  "primary_email" | "phone" | "client_type" | "year_end_date" | "vat_registered" | "vat_stagger_group" | "vat_scheme" | "reminders_paused" | "records_received_for" | "completed_for"
>;


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
    logger.error("reassignClients: failed to update clients:", { error: (error as any)?.message ?? String(error) });
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

/**
 * Fetch a client's filing status for a specific filing type.
 * Returns traffic light status + doc progress counts.
 */
export async function getClientFilingStatusForType(
  clientId: string,
  filingTypeId: string,
  deadlineDate: string | null
): Promise<{
  status: TrafficLightStatus;
  docReceived: number;
  docRequired: number;
}> {
  const supabase = await createClient();

  // Fetch client records_received_for and completed_for
  const { data: client } = await supabase
    .from("clients")
    .select("records_received_for, completed_for")
    .eq("id", clientId)
    .single();

  const recordsReceived: string[] = Array.isArray(client?.records_received_for)
    ? client.records_received_for
    : [];
  const completedFor: string[] = Array.isArray(client?.completed_for)
    ? client.completed_for
    : [];

  // Check for status override
  const { data: override } = await supabase
    .from("client_filing_status_overrides")
    .select("override_status")
    .eq("client_id", clientId)
    .eq("filing_type_id", filingTypeId)
    .maybeSingle();

  const status = calculateFilingTypeStatus({
    filing_type_id: filingTypeId,
    deadline_date: deadlineDate,
    is_records_received: recordsReceived.includes(filingTypeId),
    is_completed: completedFor.includes(filingTypeId),
    override_status: override?.override_status || null,
  });

  // Fetch mandatory doc requirements
  const { data: reqRows } = await supabase
    .from("filing_document_requirements")
    .select("document_type_id")
    .eq("filing_type_id", filingTypeId)
    .eq("is_mandatory", true);

  const mandatoryDocIds = new Set((reqRows ?? []).map((r) => r.document_type_id));
  const docRequired = mandatoryDocIds.size;

  if (docRequired === 0) {
    return { status, docReceived: 0, docRequired: 0 };
  }

  // Fetch uploaded documents
  const { data: docRows } = await supabase
    .from("client_documents")
    .select("document_type_id")
    .eq("client_id", clientId)
    .eq("filing_type_id", filingTypeId);

  const satisfiedIds = new Set<string>();
  for (const row of docRows ?? []) {
    if (row.document_type_id && mandatoryDocIds.has(row.document_type_id)) {
      satisfiedIds.add(row.document_type_id);
    }
  }

  // Fetch manually received checklist customisations
  const { data: manualRows } = await supabase
    .from("client_document_checklist_customisations")
    .select("document_type_id")
    .eq("client_id", clientId)
    .eq("filing_type_id", filingTypeId)
    .eq("manually_received", true);

  for (const row of manualRows ?? []) {
    if (row.document_type_id && mandatoryDocIds.has(row.document_type_id)) {
      satisfiedIds.add(row.document_type_id);
    }
  }

  return { status, docReceived: satisfiedIds.size, docRequired };
}
