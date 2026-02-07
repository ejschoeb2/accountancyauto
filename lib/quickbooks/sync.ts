import type QuickBooks from "node-quickbooks";
import { createAdminClient } from "@/lib/supabase/admin";
import { getQuickBooksClient } from "./api-client";

export interface SyncResult {
  success: boolean;
  count: number;
  error?: string;
}

interface QuickBooksCustomer {
  Id: string;
  CompanyName?: string;
  DisplayName: string;
  PrimaryEmailAddr?: {
    Address?: string;
  };
  PrimaryPhone?: {
    FreeFormNumber?: string;
  };
  Active: boolean;
}

/**
 * Wrap callback-based findCustomers in a Promise
 */
function findCustomersPromise(
  qbo: QuickBooks,
  options: { fetchAll: boolean }
): Promise<QuickBooksCustomer[]> {
  return new Promise((resolve, reject) => {
    qbo.findCustomers(
      { fetchAll: options.fetchAll },
      (
        err: Error | null,
        response: {
          QueryResponse?: { Customer?: QuickBooksCustomer[] };
          Customer?: QuickBooksCustomer[];
        }
      ) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(
          response.QueryResponse?.Customer || response.Customer || []
        );
      }
    );
  });
}

/**
 * Sync clients from QuickBooks to the local database
 */
export async function syncClients(): Promise<SyncResult> {
  try {
    const qbo = await getQuickBooksClient();
    const supabase = createAdminClient();

    // Query all active customers from QuickBooks
    const customers = await findCustomersPromise(qbo, { fetchAll: true });

    // Filter to only active customers
    const activeCustomers = customers.filter((customer) => customer.Active);

    // Map QuickBooks Customer fields to our schema
    const clientsToUpsert = activeCustomers.map((customer) => ({
      quickbooks_id: customer.Id,
      company_name: customer.CompanyName || customer.DisplayName,
      display_name: customer.DisplayName,
      primary_email: customer.PrimaryEmailAddr?.Address || null,
      phone: customer.PrimaryPhone?.FreeFormNumber || null,
      active: customer.Active,
      synced_at: new Date().toISOString(),
    }));

    if (clientsToUpsert.length === 0) {
      return { success: true, count: 0 };
    }

    // Upsert all clients to Supabase clients table
    const { error } = await supabase
      .from("clients")
      .upsert(clientsToUpsert, { onConflict: "quickbooks_id" });

    if (error) {
      return {
        success: false,
        count: 0,
        error: `Failed to upsert clients: ${error.message}`,
      };
    }

    return { success: true, count: clientsToUpsert.length };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, count: 0, error: errorMessage };
  }
}
