import { getClients } from "@/app/actions/clients";
import { createClient } from "@/lib/supabase/server";
import { getClientStatusList } from "@/lib/dashboard/metrics";
import { ClientTable } from "./components/client-table";
import { ClientsPageHeader } from "./components/clients-page-header";

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

  // Build a lookup map: clientId -> { status, next_deadline }
  const statusMap: Record<string, { status: string; next_deadline: string | null }> = {};
  for (const row of clientStatusList) {
    statusMap[row.id] = {
      status: row.status,
      next_deadline: row.next_deadline,
    };
  }

  return (
    <div className="space-y-6">
      <ClientsPageHeader />
      <ClientTable initialData={clients} statusMap={statusMap} initialFilter={filterParam} />
    </div>
  );
}
