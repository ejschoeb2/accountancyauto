import { getClients } from "@/app/actions/clients";
import { createClient } from "@/lib/supabase/server";
import { getClientStatusList, getClientFilingStatuses } from "@/lib/dashboard/metrics";
import { getOrgId } from "@/lib/auth/org-context";
import { ClientTable } from "./components/client-table";

interface ClientsPageProps {
  searchParams: Promise<{ filter?: string; sort?: string }>;
}

export default async function ClientsPage({ searchParams }: ClientsPageProps) {
  const params = await searchParams;
  const filterParam = params.filter;
  const sortParam = params.sort;

  const [clients, supabase, orgId] = await Promise.all([
    getClients(),
    createClient(),
    getOrgId(),
  ]);
  const [clientStatusList, filingStatusesData, orgData, activeFilingTypesData] = await Promise.all([
    getClientStatusList(supabase),
    getClientFilingStatuses(supabase),
    supabase
      .from("organisations")
      .select("client_count_limit")
      .eq("id", orgId)
      .single(),
    supabase
      .from("org_filing_type_selections")
      .select("filing_type_id")
      .eq("org_id", orgId),
  ]);

  // Build a lookup map: clientId -> { status, next_deadline, next_deadline_type, underlying_status }
  const statusMap: Record<string, { status: string; next_deadline: string | null; next_deadline_type: string | null; underlying_status?: string }> = {};
  for (const row of clientStatusList) {
    statusMap[row.id] = {
      status: row.status,
      next_deadline: row.next_deadline,
      next_deadline_type: row.next_deadline_type,
      underlying_status: row.underlying_status,
    };
  }

  const clientLimit = orgData.data?.client_count_limit ?? null;
  const activeFilingTypeIds = (activeFilingTypesData.data || []).map((r) => r.filing_type_id);

  return (
    <ClientTable
      initialData={clients}
      statusMap={statusMap}
      filingStatusMap={filingStatusesData.filingStatuses}
      activeFilingTypeIds={activeFilingTypeIds}
      initialFilter={filterParam}
      initialSort={sortParam}
      clientLimit={clientLimit}
    />
  );
}
