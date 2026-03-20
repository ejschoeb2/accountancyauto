'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { ButtonWithText } from '@/components/ui/button-with-text';
import { IconButtonWithText } from '@/components/ui/icon-button-with-text';
import { CheckButton } from '@/components/ui/check-button';
import { ToggleGroup } from '@/components/ui/toggle-group';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  Pencil,
  X as XIcon,
  CheckCircle,
  Clock,
  XCircle,
  Send,
  Loader2,
  AlertCircle,
  AlertTriangle,
  Calendar,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { QueuedEmailPreviewModal } from '@/app/(dashboard)/email-logs/components/queued-email-preview-modal';
import { SentEmailDetailModal } from '@/app/(dashboard)/email-logs/components/sent-email-detail-modal';

interface FilingEmailTableProps {
  clientId: string;
  filingTypeId: string;
}

type ViewMode = 'queued' | 'sent';

const ITEMS_PER_PAGE = 5;

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
    bg: 'bg-green-500/10',
    text: 'text-green-600',
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

export function FilingEmailTable({ clientId, filingTypeId }: FilingEmailTableProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('queued');
  const [sentData, setSentData] = useState<AuditEntry[]>([]);
  const [queuedData, setQueuedData] = useState<QueuedReminder[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editedStatuses, setEditedStatuses] = useState<Record<string, string>>({});
  const [editedDates, setEditedDates] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [showOnlyScheduled, setShowOnlyScheduled] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewReminderId, setPreviewReminderId] = useState<string | null>(null);
  const [sentPreviewOpen, setSentPreviewOpen] = useState(false);
  const [sentPreviewEntry, setSentPreviewEntry] = useState<AuditEntry | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const offset = (currentPage - 1) * ITEMS_PER_PAGE;

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
  }, [clientId, filingTypeId, viewMode, currentPage]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Reset page and edit mode on view switch
  useEffect(() => {
    setCurrentPage(1);
    setIsEditMode(false);
    setEditedStatuses({});
  }, [viewMode]);

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);
  const hasNextPage = currentPage < totalPages;
  const hasPrevPage = currentPage > 1;

  // Filter data
  const data = useMemo(() => {
    const baseData = viewMode === 'sent' ? sentData : queuedData;
    if (viewMode === 'queued' && showOnlyScheduled) {
      return (baseData as QueuedReminder[]).filter(item => item.status === 'scheduled');
    }
    return baseData;
  }, [sentData, queuedData, viewMode, showOnlyScheduled]);

  const isStatusEditable = (status: string) => {
    return status === 'scheduled' || status === 'cancelled' || status === 'rescheduled';
  };

  const handleEdit = () => {
    const initialStatuses: Record<string, string> = {};
    const initialDates: Record<string, string> = {};
    if (viewMode === 'queued') {
      queuedData.forEach((reminder) => {
        if (isStatusEditable(reminder.status)) {
          initialStatuses[reminder.id] = reminder.status;
          initialDates[reminder.id] = reminder.send_date;
        }
      });
    }
    setEditedStatuses(initialStatuses);
    setEditedDates(initialDates);
    setIsEditMode(true);
  };

  const handleCancel = () => {
    setEditedStatuses({});
    setEditedDates({});
    setIsEditMode(false);
  };

  const handleStatusChange = (id: string, newStatus: string) => {
    setEditedStatuses((prev) => ({ ...prev, [id]: newStatus }));
  };

  const handleDateChange = (id: string, newDate: string) => {
    const reminder = queuedData.find((r) => r.id === id);
    if (!reminder) return;

    const deadlineDate = new Date(reminder.deadline_date);
    const selectedDate = new Date(newDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (selectedDate < today) {
      toast.error('Send date cannot be in the past');
      return;
    }
    if (selectedDate > deadlineDate) {
      toast.error('Send date cannot be after the deadline');
      return;
    }

    setEditedDates((prev) => ({ ...prev, [id]: newDate }));

    if (newDate !== reminder.send_date) {
      setEditedStatuses((prev) => ({ ...prev, [id]: 'rescheduled' }));
    } else {
      setEditedStatuses((prev) => ({ ...prev, [id]: reminder.status }));
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const changes: { id: string; status?: string; send_date?: string }[] = [];
      const allEditedIds = new Set([...Object.keys(editedStatuses), ...Object.keys(editedDates)]);

      allEditedIds.forEach((id) => {
        const original = queuedData.find((r) => r.id === id);
        if (!original) return;

        const change: { id: string; status?: string; send_date?: string } = { id };
        let hasChanges = false;

        const newStatus = editedStatuses[id];
        if (newStatus && newStatus !== original.status) {
          change.status = newStatus;
          hasChanges = true;
        }

        const newDate = editedDates[id];
        if (newDate && newDate !== original.send_date) {
          change.send_date = newDate;
          hasChanges = true;
        }

        if (hasChanges) changes.push(change);
      });

      if (changes.length === 0) {
        toast.info('No changes to save');
        setIsEditMode(false);
        return;
      }

      const response = await fetch('/api/reminder-queue/update-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates: changes }),
      });

      if (!response.ok) throw new Error('Failed to update emails');

      toast.success(`Updated ${changes.length} email(s)`);
      await fetchData();
      setIsEditMode(false);
      setEditedStatuses({});
      setEditedDates({});
    } catch (error) {
      console.error('Error saving changes:', error);
      toast.error('Failed to update emails');
    } finally {
      setSaving(false);
    }
  };

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
    <div className="px-6 py-4 space-y-4">
      {/* Toggle + edit controls */}
      <div className="flex items-center justify-between">
        <ToggleGroup
          options={[
            { value: 'queued' as const, label: 'Queued' },
            { value: 'sent' as const, label: 'Sent' },
          ]}
          value={viewMode}
          onChange={setViewMode}
          disabled={isEditMode}
        />

        {viewMode === 'queued' && (
          <div className="flex items-center gap-2">
            {!isEditMode ? (
              <>
                <IconButtonWithText variant="violet" onClick={handleEdit}>
                  <Pencil className="h-5 w-5" />
                  Edit
                </IconButtonWithText>
                <Separator orientation="vertical" className="h-8" />
                <label className="flex items-center gap-2 cursor-pointer">
                  <CheckButton
                    checked={showOnlyScheduled}
                    onCheckedChange={(checked) => setShowOnlyScheduled(checked as boolean)}
                    variant={showOnlyScheduled ? 'success' : 'default'}
                  />
                  <span className="text-sm font-medium whitespace-nowrap">Show only scheduled</span>
                </label>
              </>
            ) : (
              <>
                <IconButtonWithText variant="amber" onClick={handleCancel} disabled={saving}>
                  <XIcon className="h-5 w-5" />
                  Cancel
                </IconButtonWithText>
                <IconButtonWithText variant="blue" onClick={handleSave} disabled={saving}>
                  <CheckCircle className="h-5 w-5" />
                  {saving ? 'Saving...' : 'Save'}
                </IconButtonWithText>
              </>
            )}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="border rounded-lg bg-white shadow-sm">
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
                  Deadline
                </span>
              </TableHead>
              <TableHead>
                <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Template
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
                    {entry.deadline_date ? format(new Date(entry.deadline_date), 'dd MMM yyyy') : '\u2014'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {entry.template_name || '\u2014'}
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
                const currentStatus = isEditMode ? (editedStatuses[reminder.id] ?? reminder.status) : reminder.status;
                const currentDate = isEditMode ? (editedDates[reminder.id] ?? reminder.send_date) : reminder.send_date;
                const canEdit = isStatusEditable(reminder.status);

                return (
                  <TableRow
                    key={reminder.id}
                    className={cn(
                      'group hover:bg-muted/50 transition-colors',
                      !isEditMode && 'cursor-pointer'
                    )}
                    onClick={() => {
                      if (!isEditMode) {
                        setPreviewReminderId(reminder.id);
                        setPreviewOpen(true);
                      }
                    }}
                  >
                    <TableCell className="text-muted-foreground">
                      {isEditMode && canEdit ? (
                        <Input
                          type="date"
                          value={currentDate}
                          onChange={(e) => handleDateChange(reminder.id, e.target.value)}
                          className="w-[160px] hover:border-foreground/20"
                        />
                      ) : (
                        format(new Date(reminder.send_date), 'dd MMM yyyy')
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(reminder.deadline_date), 'dd MMM yyyy')}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {reminder.template_name || '\u2014'}
                    </TableCell>
                    <TableCell>
                      {isEditMode && canEdit ? (
                        <Select
                          value={currentStatus}
                          onValueChange={(value) => handleStatusChange(reminder.id, value)}
                        >
                          <SelectTrigger className="w-[180px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {reminder.status === 'rescheduled' ? (
                              <>
                                <SelectItem value="rescheduled">Rescheduled</SelectItem>
                                <SelectItem value="cancelled">Manually Cancelled</SelectItem>
                              </>
                            ) : reminder.status === 'scheduled' ? (
                              <>
                                <SelectItem value="scheduled">Scheduled</SelectItem>
                                <SelectItem value="cancelled">Manually Cancelled</SelectItem>
                              </>
                            ) : (
                              <>
                                <SelectItem value="scheduled">Scheduled</SelectItem>
                                <SelectItem value="rescheduled">Rescheduled</SelectItem>
                                <SelectItem value="cancelled">Manually Cancelled</SelectItem>
                              </>
                            )}
                          </SelectContent>
                        </Select>
                      ) : (
                        <div className={`px-3 py-2 rounded-md ${statusConfig[currentStatus]?.bg || 'bg-gray-500/10'} inline-flex items-center`}>
                          <span className={`text-sm font-medium ${statusConfig[currentStatus]?.text || 'text-gray-500'}`}>
                            {statusConfig[currentStatus]?.label || currentStatus}
                          </span>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <div className="text-muted-foreground">
            Page {currentPage} of {totalPages} ({totalCount} total)
          </div>
          <div className="flex gap-2">
            <ButtonWithText
              onClick={() => setCurrentPage((p) => p - 1)}
              disabled={!hasPrevPage || loading}
              variant="muted"
            >
              Previous
            </ButtonWithText>
            <ButtonWithText
              onClick={() => setCurrentPage((p) => p + 1)}
              disabled={!hasNextPage || loading}
              variant="muted"
            >
              Next
            </ButtonWithText>
          </div>
        </div>
      )}

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
