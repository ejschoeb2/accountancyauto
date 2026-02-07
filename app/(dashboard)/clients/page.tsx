import { getClients } from "@/app/actions/clients";
import { ClientTable } from "./components/client-table";

export default async function ClientsPage() {
  const clients = await getClients();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Clients</h1>
      </div>
      
      <ClientTable initialData={clients} />
    </div>
  );
}
