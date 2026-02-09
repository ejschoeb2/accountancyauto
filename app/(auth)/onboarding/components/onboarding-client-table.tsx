"use client";

import { useState, useCallback, useTransition } from "react";
import dynamic from "next/dynamic";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { EditableCell } from "@/app/(dashboard)/clients/components/editable-cell";
import {
  type Client,
  updateClientMetadata,
} from "@/app/actions/clients";

const CsvImportDialog = dynamic(
  () =>
    import("@/app/(dashboard)/clients/components/csv-import-dialog").then(
      (m) => ({ default: m.CsvImportDialog })
    ),
  { ssr: false }
);

const CLIENT_TYPE_OPTIONS = [
  { value: "Limited Company", label: "Limited Company" },
  { value: "Sole Trader", label: "Sole Trader" },
  { value: "Partnership", label: "Partnership" },
  { value: "LLP", label: "LLP" },
];

const VAT_STAGGER_GROUP_OPTIONS = [
  { value: "1", label: "Stagger 1 (Mar/Jun/Sep/Dec)" },
  { value: "2", label: "Stagger 2 (Jan/Apr/Jul/Oct)" },
  { value: "3", label: "Stagger 3 (Feb/May/Aug/Nov)" },
];

interface OnboardingClientTableProps {
  initialClients: Client[];
  onClientsChange?: (clients: Client[]) => void;
}

export function OnboardingClientTable({
  initialClients,
  onClientsChange,
}: OnboardingClientTableProps) {
  const [clients, setClients] = useState<Client[]>(initialClients);
  const [isCsvDialogOpen, setIsCsvDialogOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleCellEdit = useCallback(
    async (clientId: string, field: keyof Client, value: unknown) => {
      const previousClients = [...clients];
      const updated = clients.map((c) =>
        c.id === clientId ? { ...c, [field]: value } : c
      );
      setClients(updated);
      onClientsChange?.(updated);

      try {
        await updateClientMetadata(clientId, { [field]: value });
      } catch (error) {
        setClients(previousClients);
        onClientsChange?.(previousClients);
        const message =
          error instanceof Error ? error.message : "Failed to update";
        toast.error(message);
        throw error;
      }
    },
    [clients, onClientsChange]
  );

  const handleImportComplete = useCallback(() => {
    // Reload clients after CSV import
    window.location.reload();
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {clients.length} {clients.length === 1 ? "client" : "clients"} synced
          from QuickBooks
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsCsvDialogOpen(true)}
        >
          <Upload className="size-4 mr-2" />
          Import CSV
        </Button>
      </div>

      <div className="rounded-xl border shadow-sm bg-white max-h-[400px] overflow-y-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Client Name
                </span>
              </TableHead>
              <TableHead>
                <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Client Type
                </span>
              </TableHead>
              <TableHead>
                <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Year End
                </span>
              </TableHead>
              <TableHead>
                <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  VAT Registered
                </span>
              </TableHead>
              <TableHead>
                <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  VAT Stagger
                </span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clients.length > 0 ? (
              clients.map((client) => (
                <TableRow key={client.id}>
                  <TableCell className="font-medium">
                    {client.display_name || client.company_name}
                  </TableCell>
                  <TableCell>
                    <EditableCell
                      value={client.client_type}
                      type="select"
                      options={CLIENT_TYPE_OPTIONS}
                      onSave={async (value) => {
                        startTransition(async () => {
                          await handleCellEdit(
                            client.id,
                            "client_type",
                            value
                          );
                        });
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <EditableCell
                      value={client.year_end_date}
                      type="date"
                      onSave={async (value) => {
                        startTransition(async () => {
                          await handleCellEdit(
                            client.id,
                            "year_end_date",
                            value
                          );
                        });
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <EditableCell
                      value={client.vat_registered}
                      type="boolean"
                      onSave={async (value) => {
                        startTransition(async () => {
                          await handleCellEdit(
                            client.id,
                            "vat_registered",
                            value
                          );
                        });
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    {client.vat_registered ? (
                      <EditableCell
                        value={client.vat_stagger_group?.toString() ?? null}
                        type="select"
                        options={VAT_STAGGER_GROUP_OPTIONS}
                        onSave={async (value) => {
                          startTransition(async () => {
                            await handleCellEdit(
                              client.id,
                              "vat_stagger_group",
                              value ? parseInt(value as string) : null
                            );
                          });
                        }}
                      />
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">
                  No clients found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <CsvImportDialog
        open={isCsvDialogOpen}
        onOpenChange={setIsCsvDialogOpen}
        onImportComplete={handleImportComplete}
      />
    </div>
  );
}
