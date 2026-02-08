'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { TrafficLightBadge } from './traffic-light-badge';
import type { ClientStatusRow } from '@/lib/dashboard/metrics';

interface ClientStatusTableProps {
  clients: ClientStatusRow[];
}

export function ClientStatusTable({ clients }: ClientStatusTableProps) {
  const router = useRouter();

  const handleRefresh = () => {
    router.refresh();
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatDaysUntil = (days: number | null) => {
    if (days === null) return '-';
    if (days < 0) return `${Math.abs(days)} days ago`;
    if (days === 0) return 'Today';
    if (days === 1) return 'Tomorrow';
    return `${days} days`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Client Status</h2>
        <Button variant="outline" size="sm" onClick={handleRefresh}>
          Refresh
        </Button>
      </div>

      <div className="border rounded-lg overflow-hidden shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="font-semibold text-foreground">Client Name</TableHead>
              <TableHead className="font-semibold text-foreground">Status</TableHead>
              <TableHead className="font-semibold text-foreground">Next Deadline</TableHead>
              <TableHead className="font-semibold text-foreground text-right">Days Until Deadline</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clients.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  No clients found
                </TableCell>
              </TableRow>
            ) : (
              clients.map((client) => (
                <TableRow key={client.id} className="hover:bg-accent/5">
                  <TableCell>
                    <Link
                      href={`/clients/${client.id}`}
                      className="text-accent hover:underline font-medium"
                    >
                      {client.company_name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <TrafficLightBadge status={client.status} />
                  </TableCell>
                  <TableCell>{formatDate(client.next_deadline)}</TableCell>
                  <TableCell className="text-right">
                    {formatDaysUntil(client.days_until_deadline)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
