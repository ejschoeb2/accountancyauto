import { getClients } from "@/app/actions/clients";
import { createClient } from "@/lib/supabase/server";
import { getClientStatusList, getClientFilingStatuses } from "@/lib/dashboard/metrics";
import { ClientTable } from "./components/client-table";

interface ClientsPageProps {
  searchParams: Promise<{ filter?: string; sort?: string }>;
}

export default async function ClientsPage({ searchParams }: ClientsPageProps) {
  const params = await searchParams;
  const filterParam = params.filter;
  const sortParam = params.sort;

  const [clients, supabase] = await Promise.all([
    getClients(),
    createClient(),
  ]);
  const [clientStatusList, filingStatusesData] = await Promise.all([
    getClientStatusList(supabase),
    getClientFilingStatuses(supabase),
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

  return (
    <ClientTable
      initialData={clients}
      statusMap={statusMap}
      filingStatusMap={filingStatusesData.filingStatuses}
      initialFilter={filterParam}
      initialSort={sortParam}
    />
  );
}
