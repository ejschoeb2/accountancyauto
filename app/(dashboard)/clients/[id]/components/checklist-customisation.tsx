'use client';

import { useState, useEffect, useTransition } from 'react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { IconButtonWithText } from '@/components/ui/icon-button-with-text';
import { Input } from '@/components/ui/input';
import { Plus, Settings } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';

interface FilingType {
  id: string;
  label: string;
}

interface Requirement {
  id: string;
  document_type_id: string;
  is_mandatory: boolean;
  document_types: {
    id: string;
    code: string;
    label: string;
  };
}

interface Customisation {
  id: string;
  document_type_id: string | null;
  is_enabled: boolean;
  is_ad_hoc: boolean;
  ad_hoc_label: string | null;
  manually_received: boolean;
}

interface ChecklistCustomisationProps {
  clientId: string;
}

export function ChecklistCustomisation({ clientId }: ChecklistCustomisationProps) {
  const [filingTypes, setFilingTypes] = useState<FilingType[]>([]);
  const [selectedFilingTypeId, setSelectedFilingTypeId] = useState('');
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [customisations, setCustomisations] = useState<Customisation[]>([]);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [adHocLabel, setAdHocLabel] = useState('');
  const [showAdHoc, setShowAdHoc] = useState(false);
  const [, startTransition] = useTransition();

  const supabase = createClient();

  // Load org_id from user session
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      const id = user.app_metadata?.org_id;
      if (id) { setOrgId(id); return; }
      supabase.from('user_organisations').select('org_id').eq('user_id', user.id).limit(1).single()
        .then(({ data }) => { if (data?.org_id) setOrgId(data.org_id); });
    });
  }, []);

  // Load filing types
  useEffect(() => {
    fetch('/api/filing-types')
      .then(r => r.json())
      .then(data => {
        const types: FilingType[] = (data?.data ?? data ?? []).map((ft: { id: string; label?: string; name?: string }) => ({
          id: ft.id,
          label: ft.label ?? ft.name ?? ft.id,
        }));
        setFilingTypes(types);
        if (types.length > 0) setSelectedFilingTypeId(types[0].id);
      })
      .catch(() => {});
  }, []);

  // Load requirements + customisations when filing type changes
  useEffect(() => {
    if (!selectedFilingTypeId || !clientId) return;
    setLoading(true);

    Promise.all([
      supabase
        .from('filing_document_requirements')
        .select('id, document_type_id, is_mandatory, document_types(id, code, label)')
        .eq('filing_type_id', selectedFilingTypeId),
      supabase
        .from('client_document_checklist_customisations')
        .select('id, document_type_id, is_enabled, is_ad_hoc, ad_hoc_label, manually_received')
        .eq('client_id', clientId)
        .eq('filing_type_id', selectedFilingTypeId),
    ]).then(([reqResult, custResult]) => {
      setRequirements(((reqResult.data ?? []) as unknown) as Requirement[]);
      setCustomisations((custResult.data ?? []) as Customisation[]);
    }).finally(() => setLoading(false));
  }, [selectedFilingTypeId, clientId]);

  const isEnabled = (documentTypeId: string): boolean => {
    const cust = customisations.find(c => c.document_type_id === documentTypeId);
    // Default: enabled (no customisation row = enabled)
    return cust ? cust.is_enabled : true;
  };

  const handleToggle = (req: Requirement) => {
    if (!orgId) return;
    const currentlyEnabled = isEnabled(req.document_type_id);
    const newEnabled = !currentlyEnabled;

    // Optimistic update
    startTransition(() => {
      const existing = customisations.find(c => c.document_type_id === req.document_type_id);
      if (existing) {
        setCustomisations(prev => prev.map(c =>
          c.document_type_id === req.document_type_id ? { ...c, is_enabled: newEnabled } : c
        ));
      } else {
        setCustomisations(prev => [
          ...prev,
          { id: '', document_type_id: req.document_type_id, is_enabled: newEnabled, is_ad_hoc: false, ad_hoc_label: null, manually_received: false },
        ]);
      }
    });

    // Persist
    const existing = customisations.find(c => c.document_type_id === req.document_type_id);
    supabase.from('client_document_checklist_customisations').upsert({
      org_id: orgId,
      client_id: clientId,
      filing_type_id: selectedFilingTypeId,
      document_type_id: req.document_type_id,
      is_enabled: newEnabled,
      is_ad_hoc: false,
      manually_received: existing?.manually_received ?? false,
    }, { onConflict: 'client_id,filing_type_id,document_type_id' })
    .then(({ error }) => {
      if (error) {
        toast.error('Failed to save change');
        // Revert on error
        startTransition(() => {
          setCustomisations(prev => prev.map(c =>
            c.document_type_id === req.document_type_id ? { ...c, is_enabled: currentlyEnabled } : c
          ));
        });
      } else {
        // Reload to get real IDs
        supabase.from('client_document_checklist_customisations')
          .select('id, document_type_id, is_enabled, is_ad_hoc, ad_hoc_label, manually_received')
          .eq('client_id', clientId)
          .eq('filing_type_id', selectedFilingTypeId)
          .then(({ data }) => {
            if (data) setCustomisations(data as Customisation[]);
          });
      }
    });
  };

  const handleAddAdHoc = async () => {
    if (!adHocLabel.trim() || !orgId) return;

    const { error } = await supabase.from('client_document_checklist_customisations').insert({
      org_id: orgId,
      client_id: clientId,
      filing_type_id: selectedFilingTypeId,
      is_enabled: true,
      is_ad_hoc: true,
      ad_hoc_label: adHocLabel.trim(),
    });

    if (error) {
      toast.error('Failed to add custom item');
      return;
    }

    toast.success('Custom item added');
    setAdHocLabel('');
    setShowAdHoc(false);

    // Reload customisations
    const { data } = await supabase
      .from('client_document_checklist_customisations')
      .select('id, document_type_id, is_enabled, is_ad_hoc, ad_hoc_label, manually_received')
      .eq('client_id', clientId)
      .eq('filing_type_id', selectedFilingTypeId);
    if (data) setCustomisations(data as Customisation[]);
  };

  const adHocItems = customisations.filter(c => c.is_ad_hoc);

  return (
    <Card className="gap-1.5">
      <div className="px-8">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="space-y-1">
            <h2 className="text-2xl font-semibold">Checklist Customisation</h2>
            <p className="text-sm text-muted-foreground">
              Toggle which documents appear on the client portal checklist, or add custom items.
            </p>
          </div>
          <div className="shrink-0 pt-1">
            <Settings className="h-5 w-5 text-muted-foreground" />
          </div>
        </div>
      </div>
      <CardContent>
        <div className="space-y-4">
          {/* Filing type selector */}
          <div className="space-y-2 max-w-xs">
            <Label htmlFor="checklist-filing-type">Filing Type</Label>
            <Select value={selectedFilingTypeId} onValueChange={setSelectedFilingTypeId}>
              <SelectTrigger id="checklist-filing-type" className="h-9">
                <SelectValue placeholder="Select filing type" />
              </SelectTrigger>
              <SelectContent>
                {filingTypes.map(ft => (
                  <SelectItem key={ft.id} value={ft.id}>{ft.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground">Loading checklist...</p>
          ) : (
            <>
              {/* Standard requirements */}
              {requirements.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Standard Documents</p>
                  <div className="space-y-2">
                    {requirements.map(req => {
                      const enabled = isEnabled(req.document_type_id);
                      return (
                        <div
                          key={req.id}
                          className="flex items-center justify-between gap-3 py-2 px-3 rounded-md border border-gray-200 bg-white"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={`text-sm truncate ${enabled ? 'text-gray-900' : 'text-gray-400 line-through'}`}>
                              {req.document_types?.label}
                            </span>
                            {req.is_mandatory && (
                              <span className="text-xs text-muted-foreground shrink-0">(required)</span>
                            )}
                          </div>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={enabled}
                            onClick={() => handleToggle(req)}
                            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                              enabled ? 'bg-violet-600' : 'bg-gray-200'
                            }`}
                          >
                            <span
                              className={`pointer-events-none block h-4 w-4 rounded-full bg-white shadow-lg ring-0 transition-transform ${
                                enabled ? 'translate-x-4' : 'translate-x-0'
                              }`}
                            />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Ad-hoc items */}
              {adHocItems.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Custom Items</p>
                  <div className="space-y-2">
                    {adHocItems.map(item => (
                      <div
                        key={item.id}
                        className="flex items-center gap-2 py-2 px-3 rounded-md border border-violet-200 bg-violet-50"
                      >
                        <span className="text-sm text-violet-900 flex-1">{item.ad_hoc_label}</span>
                        <span className="text-xs px-2 py-0.5 rounded bg-violet-100 text-violet-700">Custom</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Add custom item */}
              {showAdHoc ? (
                <div className="flex items-center gap-2 pt-2">
                  <Input
                    value={adHocLabel}
                    onChange={e => setAdHocLabel(e.target.value)}
                    placeholder="e.g. Rental income spreadsheet"
                    className="h-9"
                    onKeyDown={e => e.key === 'Enter' && handleAddAdHoc()}
                    autoFocus
                  />
                  <IconButtonWithText variant="green" onClick={handleAddAdHoc} disabled={!adHocLabel.trim()}>
                    Add
                  </IconButtonWithText>
                  <Button variant="outline" size="sm" onClick={() => { setShowAdHoc(false); setAdHocLabel(''); }}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAdHoc(true)}
                  className="flex items-center gap-1.5"
                >
                  <Plus className="h-4 w-4" />
                  Add custom item
                </Button>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
