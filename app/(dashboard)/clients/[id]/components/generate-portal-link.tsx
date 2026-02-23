'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
import { Link, Copy, RotateCcw } from 'lucide-react';

interface FilingType {
  id: string;
  label: string;
}

interface GeneratePortalLinkProps {
  clientId: string;
}

export function GeneratePortalLink({ clientId }: GeneratePortalLinkProps) {
  const [filingTypes, setFilingTypes] = useState<FilingType[]>([]);
  const [filingTypeId, setFilingTypeId] = useState('');
  const [taxYear, setTaxYear] = useState(String(new Date().getFullYear()));
  const [generating, setGenerating] = useState(false);
  const [portalUrl, setPortalUrl] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/filing-types')
      .then(r => r.json())
      .then(data => {
        const types: FilingType[] = (data?.data ?? data ?? []).map((ft: { id: string; label?: string; name?: string }) => ({
          id: ft.id,
          label: ft.label ?? ft.name ?? ft.id,
        }));
        setFilingTypes(types);
        if (types.length > 0) setFilingTypeId(types[0].id);
      })
      .catch(() => {});
  }, []);

  const handleGenerate = async () => {
    if (!filingTypeId || !taxYear) {
      toast.error('Please select a filing type and enter a tax year.');
      return;
    }
    setGenerating(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/portal-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filingTypeId, taxYear }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to generate link' }));
        throw new Error(err.error ?? 'Failed to generate link');
      }
      const data = await res.json();
      setPortalUrl(data.portalUrl);
      setExpiresAt(data.expiresAt);
      toast.success('Portal link generated!');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to generate link');
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = async () => {
    if (!portalUrl) return;
    try {
      await navigator.clipboard.writeText(portalUrl);
      toast.success('Link copied to clipboard');
    } catch {
      toast.error('Failed to copy link');
    }
  };

  const expiryDisplay = expiresAt
    ? new Date(expiresAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  return (
    <Card className="gap-1.5">
      <div className="px-8">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="space-y-1">
            <h2 className="text-2xl font-semibold">Generate Upload Link</h2>
            <p className="text-sm text-muted-foreground">
              Generate a secure, time-limited link for your client to upload documents.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0 pt-1">
            <Link className="h-5 w-5 text-muted-foreground" />
          </div>
        </div>
      </div>
      <CardContent>
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="filing-type">Filing Type</Label>
              <Select value={filingTypeId} onValueChange={setFilingTypeId}>
                <SelectTrigger id="filing-type" className="h-9">
                  <SelectValue placeholder="Select filing type" />
                </SelectTrigger>
                <SelectContent>
                  {filingTypes.map(ft => (
                    <SelectItem key={ft.id} value={ft.id}>{ft.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tax-year">Tax Year</Label>
              <Input
                id="tax-year"
                type="text"
                value={taxYear}
                onChange={e => setTaxYear(e.target.value)}
                placeholder="e.g. 2025"
                className="h-9"
              />
            </div>
          </div>

          <IconButtonWithText
            onClick={handleGenerate}
            disabled={generating || !filingTypeId || !taxYear}
            variant="violet"
          >
            {generating ? (
              <>
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Generating...
              </>
            ) : (
              <>
                <RotateCcw className="h-4 w-4" />
                {portalUrl ? 'Regenerate Link' : 'Generate Link'}
              </>
            )}
          </IconButtonWithText>

          {portalUrl && (
            <div className="space-y-2 pt-2 border-t">
              <Label>Portal URL</Label>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={portalUrl}
                  className="h-9 font-mono text-xs bg-muted"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopy}
                  className="shrink-0"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              {expiryDisplay && (
                <p className="text-xs text-muted-foreground">
                  Link expires on {expiryDisplay}. Regenerating will revoke the previous link.
                </p>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
