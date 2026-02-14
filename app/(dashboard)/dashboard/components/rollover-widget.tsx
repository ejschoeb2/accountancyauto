'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getRolloverSummary } from '@/lib/rollover/detector';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowRight, RefreshCw } from 'lucide-react';

const FILING_TYPE_LABELS: Record<string, string> = {
  corporation_tax_payment: 'Corporation Tax',
  ct600_filing: 'CT600 Filing',
  companies_house: 'Companies House',
  vat_return: 'VAT Return',
  self_assessment: 'Self Assessment',
};

export function RolloverWidget() {
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    const supabase = createClient();

    getRolloverSummary(supabase)
      .then((data) => {
        setSummary(data);
        const total = Object.values(data).reduce((sum, count) => sum + count, 0);
        setTotalCount(total);
      })
      .catch((error) => {
        console.error('Error loading rollover summary:', error);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Ready to Roll Over
          </CardTitle>
          <CardDescription>Loading...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RefreshCw className="h-5 w-5" />
          Ready to Roll Over
        </CardTitle>
        <CardDescription>
          {totalCount === 0
            ? 'No obligations ready to advance'
            : `${totalCount} obligation${totalCount === 1 ? '' : 's'} ready to advance`}
        </CardDescription>
      </CardHeader>
      {totalCount > 0 && (
        <>
          <CardContent className="space-y-1.5">
            {Object.entries(summary).map(([filingType, count]) => (
              <div key={filingType} className="text-sm text-muted-foreground">
                • {count} {FILING_TYPE_LABELS[filingType] || filingType} deadline{count === 1 ? '' : 's'}
              </div>
            ))}
          </CardContent>
          <CardFooter>
            <Button asChild className="w-full">
              <Link href="/rollover">
                View & Roll Over
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardFooter>
        </>
      )}
    </Card>
  );
}
