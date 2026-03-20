'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getAuditLog, getQueuedReminders, type AuditEntry, type QueuedReminder } from '@/app/actions/audit-log';
import { format } from 'date-fns';
import {
  CheckCircle,
  Clock,
  XCircle,
  Send,
  Loader2,
  AlertCircle,
  AlertTriangle,
  Calendar,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { QueuedEmailPreviewModal } from '@/app/(dashboard)/email-logs/components/queued-email-preview-modal';
import { SentEmailDetailModal } from '@/app/(dashboard)/email-logs/components/sent-email-detail-modal';

interface FilingEmailTableProps {
  clientId: string;
  filingTypeId: string;
  viewMode: 'queued' | 'sent';
}

const ITEMS_PER_PAGE = 100;

const statusConfig: Record<string, { label: string; bg: string; text: string; icon: React.ReactNode }> = {
  delivered: {
    label: 'Delivered',
    bg: 'bg-green-500/10',
    text: 'text-green-600',
    icon: <CheckCircle className="h-4 w-4" />,
  },
  sent: {
    label: 'Sent',
    bg: 'bg-blue-500/10',
    text: 'text-blue-500',
    icon: <Send className="h-4 w-4" />,
  },
  bounced: {
    label: 'Bounced',
    bg: 'bg-status-warning/10',
    text: 'text-status-warning',
    icon: <AlertTriangle className="h-4 w-4" />,
  },
  failed: {
    label: 'Failed',
    bg: 'bg-status-danger/10',
    text: 'text-status-danger',
    icon: <AlertCircle className="h-4 w-4" />,
  },
  cancelled: {
    label: 'Manually Cancelled',
    bg: 'bg-status-danger/10',
    text: 'text-status-danger',
    icon: <XCircle className="h-4 w-4" />,
  },
  records_received: {
    label: 'Records Received',
    bg: 'bg-violet-500/10',
    text: 'text-violet-600',
    icon: <CheckCircle className="h-4 w-4" />,
  },
  scheduled: {
    label: 'Scheduled',
    bg: 'bg-status-info/10',
    text: 'text-status-info',
    icon: <Clock className="h-4 w-4" />,
  },
  rescheduled: {
    label: 'Rescheduled',
    bg: 'bg-blue-500/10',
    text: 'text-blue-500',
    icon: <Calendar className="h-4 w-4" />,
  },
  pending: {
    label: 'Pending',
    bg: 'bg-amber-500/10',
    text: 'text-amber-600',
    icon: <Loader2 className="h-4 w-4" />,
  },
  paused: {
    label: 'Paused',
    bg: 'bg-status-neutral/10',
    text: 'text-status-neutral',
    icon: <Clock className="h-4 w-4" />,
  },
};

export function FilingEmailTable({ clientId, filingTypeId, viewMode }: FilingEmailTableProps) {
  const [sentData, setSentData] = useState<AuditEntry[]>([]);
  const [queuedData, setQueuedData] = useState<QueuedReminder[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewReminderId, setPreviewReminderId] = useState<string | null>(null);
  const [sentPreviewOpen, setSentPreviewOpen] = useState(false);
  const [sentPreviewEntry, setSentPreviewEntry] = useState<AuditEntry | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const offset = 0;

      if (viewMode === 'sent') {
        const result = await getAuditLog({
          clientId,
          filingTypeId,
          offset,
          limit: ITEMS_PER_PAGE,
        });
        setSentData(result.data);
        setTotalCount(result.totalCount);
      } else {
        const result = await getQueuedReminders({
          clientId,
          filingTypeId,
          offset,
          limit: ITEMS_PER_PAGE,
        });
        setQueuedData(result.data);
        setTotalCount(result.totalCount);
      }
    } catch (error) {
      console.error('Error fetching email data:', error);
    } finally {
      setLoading(false);
    }
  }, [clientId, filingTypeId, viewMode]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const data = viewMode === 'sent' ? sentData : queuedData;

  const handlePreviewNavigate = (direction: 'prev' | 'next') => {
    if (!previewReminderId) return;
    const currentIndex = queuedData.findIndex((r) => r.id === previewReminderId);
    if (direction === 'prev' && currentIndex > 0) {
      setPreviewReminderId(queuedData[currentIndex - 1].id);
    } else if (direction === 'next' && currentIndex < queuedData.length - 1) {
      setPreviewReminderId(queuedData[currentIndex + 1].id);
    }
  };

  const handleSentPreviewNavigate = (direction: 'prev' | 'next') => {
    if (!sentPreviewEntry) return;
    const currentIndex = sentData.findIndex((e) => e.id === sentPreviewEntry.id);
    if (direction === 'prev' && currentIndex > 0) {
      setSentPreviewEntry(sentData[currentIndex - 1]);
    } else if (direction === 'next' && currentIndex < sentData.length - 1) {
      setSentPreviewEntry(sentData[currentIndex + 1]);
    }
  };

  return (
    <div className="space-y-4">
      {/* Table — flush with card edges */}
      <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  {viewMode === 'sent' ? 'Date Sent' : 'Send Date'}
                </span>
              </TableHead>
              <TableHead>
                <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Template
                </span>
              </TableHead>
              <TableHead className="w-[40%]">
                <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Subject
                </span>
              </TableHead>
              <TableHead>
                <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Status
                </span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                  Loading...
                </TableCell>
              </TableRow>
            ) : data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                  No {viewMode === 'sent' ? 'sent emails' : 'queued emails'} found
                </TableCell>
              </TableRow>
            ) : viewMode === 'sent' ? (
              (data as AuditEntry[]).map((entry) => (
                <TableRow
                  key={entry.id}
                  className="group hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => {
                    setSentPreviewEntry(entry);
                    setSentPreviewOpen(true);
                  }}
                >
                  <TableCell className="text-muted-foreground">
                    {format(new Date(entry.sent_at), 'dd MMM yyyy')}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {entry.template_name || '\u2014'}
                  </TableCell>
                  <TableCell className="text-muted-foreground truncate">
                    {entry.subject || '\u2014'}
                  </TableCell>
                  <TableCell>
                    <div className={`px-3 py-2 rounded-md ${statusConfig[entry.delivery_status]?.bg || 'bg-gray-500/10'} inline-flex items-center`}>
                      <span className={`text-sm font-medium ${statusConfig[entry.delivery_status]?.text || 'text-gray-500'}`}>
                        {statusConfig[entry.delivery_status]?.label || entry.delivery_status}
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              (data as QueuedReminder[]).map((reminder) => {
                const isCancelled = reminder.status === 'cancelled' || reminder.status === 'records_received';

                return (
                  <TableRow
                    key={reminder.id}
                    className={cn(
                      'group hover:bg-muted/50 transition-colors cursor-pointer',
                      isCancelled && 'opacity-50'
                    )}
                    onClick={() => {
                      setPreviewReminderId(reminder.id);
                      setPreviewOpen(true);
                    }}
                  >
                    <TableCell className={cn('text-muted-foreground', isCancelled && 'line-through')}>
                      {format(new Date(reminder.send_date), 'dd MMM yyyy')}
                    </TableCell>
                    <TableCell className={cn('text-muted-foreground', isCancelled && 'line-through')}>
                      {reminder.template_name || '\u2014'}
                    </TableCell>
                    <TableCell className={cn('text-muted-foreground truncate', isCancelled && 'line-through')}>
                      {reminder.subject || '\u2014'}
                    </TableCell>
                    <TableCell>
                      <div className={`px-3 py-2 rounded-md ${statusConfig[reminder.status]?.bg || 'bg-gray-500/10'} inline-flex items-center`}>
                        <span className={`text-sm font-medium ${statusConfig[reminder.status]?.text || 'text-gray-500'}`}>
                          {statusConfig[reminder.status]?.label || reminder.status}
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>

      {/* Email Preview Modals */}
      <QueuedEmailPreviewModal
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        reminderId={previewReminderId}
        allReminders={queuedData}
        onNavigate={handlePreviewNavigate}
        onStatusChange={fetchData}
      />
      <SentEmailDetailModal
        open={sentPreviewOpen}
        onOpenChange={setSentPreviewOpen}
        entry={sentPreviewEntry}
        allEntries={sentData}
        onNavigate={handleSentPreviewNavigate}
      />
    </div>
  );
}
