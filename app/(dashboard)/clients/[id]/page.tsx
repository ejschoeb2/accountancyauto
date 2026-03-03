'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Edit2, CheckCircle, X, Mail, Ban, Check, Pencil } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { IconButtonWithText } from '@/components/ui/icon-button-with-text';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { PageLoadingProvider } from '@/components/page-loading';
import { LoadingScreen } from '@/components/loading-screen';
import { FilingManagement } from './components/filing-management';
import { ClientEmailHistoryTable } from './components/client-email-log-table';
import { ClientAuditLog } from './components/client-audit-log';
import { DsarExportButton } from './components/dsar-export-button';
import { SendEmailModal } from '../components/send-email-modal';
import { toast } from 'sonner';
import type { Client } from '@/app/actions/clients';

type ClientType = 'Limited Company' | 'Sole Trader' | 'Partnership' | 'LLP' | 'Individual';
type VATScheme = 'Standard' | 'Flat Rate' | 'Cash Accounting';

export default function ClientPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isSendEmailModalOpen, setIsSendEmailModalOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Form state
  const [formData, setFormData] = useState<Partial<Client>>({});

  // Trigger refresh for email log
  const triggerRefresh = () => setRefreshKey(k => k + 1);

  useEffect(() => {
    const fetchClient = async () => {
      try {
        const response = await fetch(`/api/clients/${id}`);
        if (!response.ok) {
          if (response.status === 404) {
            router.push('/clients');
            return;
          }
          throw new Error('Failed to load client');
        }
        const result = await response.json();
        const clientData = result.data || result;
        setClient(clientData);
        setFormData(clientData);
      } catch (error) {
        toast.error('Failed to load client');
        router.push('/clients');
      } finally {
        setLoading(false);
      }
    };

    fetchClient();
  }, [id, router]);

  const handleEdit = () => {
    setFormData(client!);
    setEditing(true);
  };

  const handleCancel = useCallback(() => {
    setFormData(client!);
    setEditing(false);
  }, [client]);

  // Escape key cancels edit mode
  useEffect(() => {
    if (!editing) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleCancel();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [editing, handleCancel]);

  const handleToggleReminders = async () => {
    try {
      const response = await fetch(`/api/clients/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reminders_paused: !client!.reminders_paused }),
      });
      if (!response.ok) throw new Error('Failed to update reminders status');
      const result = await response.json();
      const updated = result.data || result;
      setClient(updated);
      setFormData(updated);
      toast.success(client!.reminders_paused ? 'Client set to active' : 'Client set to inactive');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update reminders');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch(`/api/clients/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update client');
      }

      const result = await response.json();
      const updated = result.data || result;
      setClient(updated);
      setEditing(false);
      toast.success('Client updated!');
      triggerRefresh(); // Refresh email log when client details change
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update client');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingScreen />;
  }

  if (!client) {
    return null;
  }


  return (
    <PageLoadingProvider>
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">
            {client.display_name || client.company_name}
          </h1>
          <div className="mt-2 flex items-center gap-2">
            {client.client_type && (
              <IconButtonWithText variant="blue">
                {client.client_type}
              </IconButtonWithText>
            )}
            {client.reminders_paused && (
              <Badge variant="outline" className="border-status-warning text-status-warning">
                Inactive
              </Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/clients">
            <IconButtonWithText variant="amber">
              <ArrowLeft className="size-4" />
              Go back
            </IconButtonWithText>
          </Link>
          <Separator orientation="vertical" className="h-8" />
          {!editing ? (
            <>
              {client.reminders_paused ? (
                <IconButtonWithText variant="green" onClick={handleToggleReminders}>
                  <Check className="size-4" />
                  Set Active
                </IconButtonWithText>
              ) : (
                <IconButtonWithText variant="destructive" onClick={handleToggleReminders}>
                  <Ban className="size-4" />
                  Set Inactive
                </IconButtonWithText>
              )}
              <IconButtonWithText variant="violet" onClick={handleEdit}>
                <Edit2 className="size-4" />
                Edit
              </IconButtonWithText>
              <IconButtonWithText variant="green" onClick={() => setIsSendEmailModalOpen(true)}>
                <Mail className="size-4" />
                Send Email
              </IconButtonWithText>
            </>
          ) : (
            <>
              <IconButtonWithText variant="amber" onClick={handleCancel}>
                <X className="size-4" />
                Cancel
              </IconButtonWithText>
              <IconButtonWithText variant="blue" onClick={handleSave} disabled={saving}>
                <CheckCircle className="size-4" />
                {saving ? 'Saving...' : 'Save'}
              </IconButtonWithText>
            </>
          )}
        </div>
      </div>

      {/* Client metadata */}
      <Card className="gap-1.5">
        <div className="px-8">
          <div className="mb-6">
            <div className="space-y-1">
              <h2 className="text-2xl font-semibold">Client Details</h2>
            </div>
          </div>
        </div>
        <CardContent>
        {editing ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="primary_email">Email</Label>
              <Input
                id="primary_email"
                type="email"
                value={formData.primary_email || ''}
                onChange={(e) => setFormData({ ...formData, primary_email: e.target.value })}
                placeholder="email@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone || ''}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+44 20 1234 5678"
              />
            </div>
            {/* Year-End Date and VAT — not applicable for Individual clients */}
            {formData.client_type !== 'Individual' && (
              <div className="space-y-2">
                <Label htmlFor="year_end_date">Year-End Date</Label>
                <Input
                  id="year_end_date"
                  type="date"
                  value={formData.year_end_date || ''}
                  onChange={(e) => setFormData({ ...formData, year_end_date: e.target.value })}
                />
              </div>
            )}
            {formData.client_type !== 'Individual' && (
              <div className="space-y-2">
                <Label htmlFor="vat_registered">VAT Registered</Label>
                <Select
                  value={formData.vat_registered ? 'true' : 'false'}
                  onValueChange={(value) => setFormData({ ...formData, vat_registered: value === 'true' })}
                >
                  <SelectTrigger id="vat_registered">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Yes</SelectItem>
                    <SelectItem value="false">No</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            {formData.client_type !== 'Individual' && formData.vat_registered && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="vat_stagger_group">VAT Stagger Group</Label>
                  <Select
                    value={formData.vat_stagger_group ? String(formData.vat_stagger_group) : ''}
                    onValueChange={(value) => setFormData({ ...formData, vat_stagger_group: value ? parseInt(value) as 1 | 2 | 3 : null })}
                  >
                    <SelectTrigger id="vat_stagger_group">
                      <SelectValue placeholder="Select stagger" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Stagger 1 (Mar/Jun/Sep/Dec)</SelectItem>
                      <SelectItem value="2">Stagger 2 (Jan/Apr/Jul/Oct)</SelectItem>
                      <SelectItem value="3">Stagger 3 (Feb/May/Aug/Nov)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vat_scheme">VAT Scheme</Label>
                  <Select
                    value={formData.vat_scheme || ''}
                    onValueChange={(value) => setFormData({ ...formData, vat_scheme: value as VATScheme })}
                  >
                    <SelectTrigger id="vat_scheme">
                      <SelectValue placeholder="Select scheme" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Standard">Standard</SelectItem>
                      <SelectItem value="Flat Rate">Flat Rate</SelectItem>
                      <SelectItem value="Cash Accounting">Cash Accounting</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
          </div>
        ) : (
          <dl className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div className="group rounded-lg px-3 py-2 -mx-3 -my-2 hover:bg-muted/50 transition-colors cursor-default">
              <dt className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Email</dt>
              <dd className="text-sm font-medium flex items-center gap-2">
                {client.primary_email || (
                  <span className="text-muted-foreground">Not set</span>
                )}
                <Pencil className="size-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </dd>
            </div>
            <div className="group rounded-lg px-3 py-2 -mx-3 -my-2 hover:bg-muted/50 transition-colors cursor-default">
              <dt className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Phone</dt>
              <dd className="text-sm font-medium flex items-center gap-2">
                {client.phone || (
                  <span className="text-muted-foreground">Not set</span>
                )}
                <Pencil className="size-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </dd>
            </div>
            {client.client_type !== 'Individual' && (
              <div className="group rounded-lg px-3 py-2 -mx-3 -my-2 hover:bg-muted/50 transition-colors cursor-default">
                <dt className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Year-End Date</dt>
                <dd className="text-sm font-medium flex items-center gap-2">
                  {client.year_end_date || (
                    <span className="text-muted-foreground">Not set</span>
                  )}
                  <Pencil className="size-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </dd>
              </div>
            )}
            {client.client_type !== 'Individual' && (
              <div className="group rounded-lg px-3 py-2 -mx-3 -my-2 hover:bg-muted/50 transition-colors cursor-default">
                <dt className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">VAT Registered</dt>
                <dd className="text-sm font-medium flex items-center gap-2">
                  {client.vat_registered ? 'Yes' : 'No'}
                  <Pencil className="size-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </dd>
              </div>
            )}
            {client.client_type !== 'Individual' && client.vat_registered && (
              <>
                <div className="group rounded-lg px-3 py-2 -mx-3 -my-2 hover:bg-muted/50 transition-colors cursor-default">
                  <dt className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">VAT Stagger Group</dt>
                  <dd className="text-sm font-medium flex items-center gap-2">
                    {client.vat_stagger_group
                      ? `Stagger ${client.vat_stagger_group} (${
                          ({ 1: 'Mar/Jun/Sep/Dec', 2: 'Jan/Apr/Jul/Oct', 3: 'Feb/May/Aug/Nov' } as Record<number, string>)[client.vat_stagger_group]
                        })`
                      : (
                      <span className="text-muted-foreground">Not set</span>
                    )}
                    <Pencil className="size-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </dd>
                </div>
                <div className="group rounded-lg px-3 py-2 -mx-3 -my-2 hover:bg-muted/50 transition-colors cursor-default">
                  <dt className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">VAT Scheme</dt>
                  <dd className="text-sm font-medium flex items-center gap-2">
                    {client.vat_scheme || (
                      <span className="text-muted-foreground">Not set</span>
                    )}
                    <Pencil className="size-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </dd>
                </div>
              </>
            )}
          </dl>
        )}
        </CardContent>
      </Card>

      {/* Filing Management */}
      <FilingManagement clientId={id} onUpdate={triggerRefresh} />

      {/* Email Log */}
      <Card className="gap-1.5">
        <div className="px-8">
          <div className="mb-6">
            <div className="space-y-1">
              <h2 className="text-2xl font-semibold">Email Log</h2>
              <p className="text-sm text-muted-foreground">
                View all sent and queued reminder emails for this client. You can reschedule or cancel upcoming emails.
              </p>
            </div>
          </div>
        </div>
        <CardContent>
          <ClientEmailHistoryTable key={refreshKey} clientId={id} />
        </CardContent>
      </Card>

      {/* Audit Log */}
      <Card className="gap-1.5">
        <div className="px-8">
          <div className="mb-6">
            <div className="space-y-1">
              <h2 className="text-2xl font-semibold">Audit Log</h2>
              <p className="text-sm text-muted-foreground">
                View all reminder emails sent to this client with delivery status tracking.
              </p>
            </div>
          </div>
        </div>
        <CardContent>
          <ClientAuditLog clientId={id} />
        </CardContent>
      </Card>

      {/* Compliance */}
      <Card className="gap-1.5 pb-2">
        <div className="px-8">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="space-y-1">
              <h2 className="text-2xl font-semibold">Compliance</h2>
              <p className="text-sm text-muted-foreground">
                Export all documents for this client in response to a Data Subject Access Request (UK GDPR Art. 15).
              </p>
            </div>
            <DsarExportButton
              clientId={id}
              clientName={client.display_name || client.company_name || ''}
            />
          </div>
        </div>
      </Card>

      {/* Send Email Modal */}
      <SendEmailModal
        open={isSendEmailModalOpen}
        onClose={() => setIsSendEmailModalOpen(false)}
        selectedClients={client ? [client] : []}
      />
    </div>
    </PageLoadingProvider>
  );
}
