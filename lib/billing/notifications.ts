/**
 * Billing notification emails.
 *
 * Placeholder -- full implementation in Task 2.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Send a payment-failed email to all admins of the given organisation.
 *
 * Placeholder function -- will be fully implemented in Task 2.
 */
export async function sendPaymentFailedEmail(
  orgId: string,
  supabase: SupabaseClient
): Promise<void> {
  console.log(`sendPaymentFailedEmail placeholder called for org ${orgId}`);
}
