'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getRolloverCandidates, type RolloverCandidate } from '@/lib/rollover/detector';
import { bulkRollover } from '@/lib/rollover/executor';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { RefreshCw, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

const FILING_TYPE_LABELS: Record<string, string> = {
  corporation_tax_payment: 'Corporation Tax Payment',
  ct600_filing: 'CT600 Filing',
  companies_house: 'Companies House',
  vat_return: 'VAT Return',
  self_assessment: 'Self Assessment',
};

export default function RolloverPage() {
  const router = useRouter();
  const [candidates, setCandidates] = useState<RolloverCandidate[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [rolling, setRolling] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const supabase = createClient();

  const loadCandidates = async () => {
    setLoading(true);
    try {
      const data = await getRolloverCandidates(supabase);
      setCandidates(data);
      setSelectedIds(new Set());
    } catch (error) {
      console.error('Error loading rollover candidates:', error);
      toast.error('Failed to load rollover candidates');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCandidates();
  }, []);

  const toggleSelection = (clientId: string, filingTypeId: string) => {
    const key = `${clientId}:${filingTypeId}`;
    const newSelected = new Set(selectedIds);
    if (newSelected.has(key)) {
      newSelected.delete(key);
    } else {
      newSelected.add(key);
    }
    setSelectedIds(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === candidates.length) {
      setSelectedIds(new Set());
    } else {
      const allKeys = candidates.map((c) => `${c.client_id}:${c.filing_type_id}`);
      setSelectedIds(new Set(allKeys));
    }
  };

  const handleRollover = async () => {
    setRolling(true);
    try {
      const items = Array.from(selectedIds).map((key) => {
        const [client_id, filing_type_id] = key.split(':');
        return { client_id, filing_type_id };
      });

      const { successCount, errorCount } = await bulkRollover(supabase, items);

      if (errorCount > 0) {
        toast.error(`Rolled over ${successCount} filing(s), ${errorCount} failed`);
      } else {
        toast.success(`Successfully rolled over ${successCount} filing(s)`);
      }

      // Reload candidates
      await loadCandidates();
      setShowConfirmDialog(false);
    } catch (error) {
      console.error('Error during rollover:', error);
      toast.error('Failed to roll over filings');
    } finally {
      setRolling(false);
    }
  };

  const selectedCount = selectedIds.size;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page header */}
      <div className="space-y-1">
        <h1>Roll Over to Next Cycle</h1>
        <p className="text-muted-foreground">
          Advance filing obligations to the next year or quarter after records are received and deadlines have passed
        </p>
      </div>

      {/* Actions bar */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {selectedCount > 0
            ? `${selectedCount} filing${selectedCount === 1 ? '' : 's'} selected`
            : `${candidates.length} filing${candidates.length === 1 ? '' : 's'} ready to roll over`}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadCandidates}
            disabled={loading}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          {selectedCount > 0 && (
            <Button
              size="sm"
              onClick={() => setShowConfirmDialog(true)}
              disabled={rolling}
            >
              {rolling && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Roll Over Selected ({selectedCount})
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
          Loading candidates...
        </div>
      ) : candidates.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          No filing obligations ready to roll over.
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={selectedIds.size === candidates.length}
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Filing Type</TableHead>
                <TableHead>Deadline</TableHead>
                <TableHead className="text-right">Days Overdue</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {candidates.map((candidate) => {
                const key = `${candidate.client_id}:${candidate.filing_type_id}`;
                return (
                  <TableRow key={key}>
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(key)}
                        onCheckedChange={() =>
                          toggleSelection(candidate.client_id, candidate.filing_type_id)
                        }
                      />
                    </TableCell>
                    <TableCell className="font-medium">{candidate.client_name}</TableCell>
                    <TableCell>
                      {FILING_TYPE_LABELS[candidate.filing_type_id] || candidate.filing_type_id}
                    </TableCell>
                    <TableCell>{candidate.deadline_date}</TableCell>
                    <TableCell className="text-right text-red-600 font-medium">
                      {candidate.days_overdue} day{candidate.days_overdue === 1 ? '' : 's'}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Confirmation dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Roll over {selectedCount} filing{selectedCount === 1 ? '' : 's'}?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>This will:</p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>Advance year-end dates for annual filings (Corp Tax, CT600, Companies House)</li>
                <li>Clear "records received" status for selected filings</li>
                <li>Cancel scheduled reminders for the old cycle</li>
                <li>Generate new reminders for the next cycle</li>
              </ul>
              <p className="text-red-600 font-medium mt-3">
                This action cannot be undone.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={rolling}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRollover} disabled={rolling}>
              {rolling && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Roll Over
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
