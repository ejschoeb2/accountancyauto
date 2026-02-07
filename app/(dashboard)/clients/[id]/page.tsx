import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Icon } from '@/components/ui/icon';
import { createClient } from '@/lib/supabase/server';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FilingAssignments } from './components/filing-assignments';
import { TemplateOverrides } from './components/template-overrides';
import { RecordsReceived } from './components/records-received';
import { ClientAuditLog } from './components/client-audit-log';

interface ClientPageProps {
  params: Promise<{ id: string }>;
}

export default async function ClientPage({ params }: ClientPageProps) {
  const { id } = await params;
  const supabase = await createClient();

  // Fetch client data
  const { data: client, error } = await supabase
    .from('clients')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !client) {
    notFound();
  }

  // Fetch active filing assignments for records-received component
  const { data: assignmentsRaw } = await supabase
    .from('client_filing_assignments')
    .select('id, filing_type_id, filing_types!inner(id, name)')
    .eq('client_id', id)
    .eq('is_active', true);

  // Transform to match expected type (Supabase returns filing_types as array, we need object)
  const assignments = assignmentsRaw?.map((a: any) => ({
    id: a.id,
    filing_type_id: a.filing_type_id,
    filing_types: Array.isArray(a.filing_types) ? a.filing_types[0] : a.filing_types,
  })) || [];

  return (
    <div className="space-y-6">
      {/* Back link */}
      <div>
        <Link href="/clients">
          <Button variant="ghost" size="sm">
            <Icon name="arrow_back" size="sm" className="mr-2" />
            Back to clients
          </Button>
        </Link>
      </div>

      {/* Client header */}
      <div className="border-b pb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {client.display_name || client.company_name}
            </h1>
            <div className="mt-2 flex items-center gap-2">
              {client.client_type && (
                <Badge variant="secondary">{client.client_type}</Badge>
              )}
              {client.reminders_paused && (
                <Badge variant="outline" className="border-status-warning text-status-warning">
                  Reminders Paused
                </Badge>
              )}
              {client.has_overrides && (
                <Badge variant="outline" className="border-accent text-accent">
                  Has Overrides
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Contact info */}
        <div className="mt-4 grid gap-2 text-sm text-muted-foreground">
          {client.primary_email && (
            <div>
              <span className="font-medium">Email:</span> {client.primary_email}
            </div>
          )}
          {client.phone && (
            <div>
              <span className="font-medium">Phone:</span> {client.phone}
            </div>
          )}
        </div>
      </div>

      {/* Client metadata */}
      <div className="rounded-lg border py-8 px-8">
        <h2 className="text-lg font-semibold mb-4">Client Details</h2>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm font-medium text-muted-foreground">Year-End Date</dt>
            <dd className="mt-1 text-sm">
              {client.year_end_date || (
                <span className="text-muted-foreground">Not set</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-muted-foreground">VAT Registered</dt>
            <dd className="mt-1 text-sm">
              {client.vat_registered ? 'Yes' : 'No'}
            </dd>
          </div>
          {client.vat_registered && (
            <>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">VAT Quarter</dt>
                <dd className="mt-1 text-sm">
                  {client.vat_quarter || (
                    <span className="text-muted-foreground">Not set</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">VAT Scheme</dt>
                <dd className="mt-1 text-sm">
                  {client.vat_scheme || (
                    <span className="text-muted-foreground">Not set</span>
                  )}
                </dd>
              </div>
            </>
          )}
        </dl>
      </div>

      {/* Filing assignments */}
      <FilingAssignments clientId={id} />

      {/* Records received and reminder pause */}
      <RecordsReceived
        clientId={id}
        assignments={assignments}
        recordsReceivedFor={client.records_received_for || []}
        remindersPaused={client.reminders_paused}
      />

      {/* Template overrides */}
      <TemplateOverrides clientId={id} />

      {/* Reminder history / Audit log */}
      <div className="rounded-lg border py-8 px-8">
        <h2 className="text-lg font-semibold mb-4">Reminder History</h2>
        <ClientAuditLog clientId={id} />
      </div>
    </div>
  );
}
