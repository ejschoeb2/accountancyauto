import { getClients } from "@/app/actions/clients";
import { createClient } from "@/lib/supabase/server";
import { getClientStatusList } from "@/lib/dashboard/metrics";
import { ClientTable } from "./components/client-table";

interface ClientsPageProps {
  searchParams: Promise<{ filter?: string }>;
}

export default async function ClientsPage({ searchParams }: ClientsPageProps) {
  const params = await searchParams;
  const filterParam = params.filter;

  const [clients, supabase] = await Promise.all([
    getClients(),
    createClient(),
  ]);
  const clientStatusList = await getClientStatusList(supabase);

  // Build a lookup map: clientId -> { status, next_deadline, next_deadline_type }
  const statusMap: Record<string, { status: string; next_deadline: string | null; next_deadline_type: string | null }> = {};
  for (const row of clientStatusList) {
    statusMap[row.id] = {
      status: row.status,
      next_deadline: row.next_deadline,
      next_deadline_type: row.next_deadline_type,
    };
  }

  return (
    <ClientTable initialData={clients} statusMap={statusMap} initialFilter={filterParam} />
  );
}
