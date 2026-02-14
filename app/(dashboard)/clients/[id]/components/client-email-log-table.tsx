'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { usePageLoading } from '@/components/page-loading';
import { ButtonWithText } from '@/components/ui/button-with-text';
import { IconButtonWithText } from '@/components/ui/icon-button-with-text';
import { CheckButton } from '@/components/ui/check-button';
import { ToggleGroup } from '@/components/ui/toggle-group';
import { Input } from '@/components/ui/input';
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
import { Separator } from '@/components/ui/separator';
import { getAuditLog, getQueuedReminders, type AuditEntry, type QueuedReminder } from '@/app/actions/audit-log';
import { format } from 'date-fns';
import {
  Pencil,
  X as XIcon,
  CheckCircle,
  Clock,
  XCircle,
  Archive,
  Send,
  Loader2,
  AlertCircle,
  AlertTriangle,
  Calendar
} from 'lucide-react';
import { toast } from 'sonner';

interface ClientEmailLogTableProps {
  clientId: string;
}

type ViewMode = 'sent' | 'queued';

const ITEMS_PER_PAGE = 10;

const FILING_TYPE_LABELS: Record<string, string> = {
  corporation_tax_payment: "Corp Tax",
  ct600_filing: "CT600",
  companies_house: "Companies House",
  vat_return: "VAT Return",
  self_assessment: "Self Assessment",
};

export function ClientEmailHistoryTable({ clientId }: ClientEmailLogTableProps) {
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

  usePageLoading('client-email-log', loading);

  // Fetch data when view mode or page changes
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const offset = (currentPage - 1) * ITEMS_PER_PAGE;

      if (viewMode === 'sent') {
        const result = await getAuditLog({
          clientId,
          offset,
          limit: ITEMS_PER_PAGE,
        });
        setSentData(result.data);
        setTotalCount(result.totalCount);
      } else {
        const result = await getQueuedReminders({
          clientId,
          offset,
          limit: ITEMS_PER_PAGE,
        });
        setQueuedData(result.data);
        setTotalCount(result.totalCount);
      }
    } catch (error) {
      console.error('Error fetching email log:', error);
    } finally {
      setLoading(false);
    }
  }, [clientId, viewMode, currentPage]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Reset to page 1 and exit edit mode when switching views
  useEffect(() => {
    setCurrentPage(1);
    setIsEditMode(false);
    setEditedStatuses({});
  }, [viewMode]);

  // Calculate pagination
  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);
  const hasNextPage = currentPage < totalPages;
  const hasPrevPage = currentPage > 1;

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
      bg: 'bg-sky-500/10',
      text: 'text-sky-500',
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
  };

  // Filter data based on "show only scheduled" checkbox
  const data = useMemo(() => {
    const baseData = viewMode === 'sent' ? sentData : queuedData;

    // Apply "show only scheduled" filter for queued view
    if (viewMode === 'queued' && showOnlyScheduled) {
      return (baseData as QueuedReminder[]).filter(item => item.status === 'scheduled');
    }

    return baseData;
  }, [sentData, queuedData, viewMode, showOnlyScheduled]);

  // Helper to check if a status is editable
  const isStatusEditable = (status: string) => {
    return status === 'scheduled' || status === 'cancelled' || status === 'rescheduled';
  };

  // Handle entering edit mode
  const handleEdit = () => {
    // Initialize editedStatuses and editedDates with current values (only for editable ones)
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

  // Handle canceling edit mode
  const handleCancel = () => {
    setEditedStatuses({});
    setEditedDates({});
    setIsEditMode(false);
  };

  // Handle status change
  const handleStatusChange = (id: string, newStatus: string) => {
    setEditedStatuses((prev) => ({
      ...prev,
      [id]: newStatus,
    }));
  };

  // Handle date change
  const handleDateChange = (id: string, newDate: string) => {
    const reminder = queuedData.find((r) => r.id === id);
    if (!reminder) return;

    // Validate new date is before deadline
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

    // Update the date
    setEditedDates((prev) => ({
      ...prev,
      [id]: newDate,
    }));

    // If date changed from original, set status to rescheduled
    if (newDate !== reminder.send_date) {
      setEditedStatuses((prev) => ({
        ...prev,
        [id]: 'rescheduled',
      }));
    } else {
      // If date reverted to original, revert status too
      setEditedStatuses((prev) => ({
        ...prev,
        [id]: reminder.status,
      }));
    }
  };

  // Handle saving changes
  const handleSave = async () => {
    setSaving(true);
    try {
      // Find items that were changed (status or date)
      const changes: { id: string; status?: string; send_date?: string }[] = [];

      // Collect all edited reminder IDs
      const allEditedIds = new Set([...Object.keys(editedStatuses), ...Object.keys(editedDates)]);

      allEditedIds.forEach((id) => {
        const original = queuedData.find((r) => r.id === id);
        if (!original) return;

        const change: { id: string; status?: string; send_date?: string } = { id };
        let hasChanges = false;

        // Check if status changed
        const newStatus = editedStatuses[id];
        if (newStatus && newStatus !== original.status) {
          change.status = newStatus;
          hasChanges = true;
        }

        // Check if date changed
        const newDate = editedDates[id];
        if (newDate && newDate !== original.send_date) {
          change.send_date = newDate;
          hasChanges = true;
        }

        if (hasChanges) {
          changes.push(change);
        }
      });

      if (changes.length === 0) {
        toast.info('No changes to save');
        setIsEditMode(false);
        return;
      }

      // Call API to update statuses and/or dates
      const response = await fetch('/api/reminder-queue/update-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates: changes }),
      });

      if (!response.ok) {
        throw new Error('Failed to update emails');
      }

      toast.success(`Updated ${changes.length} email(s)`);

      // Refresh data
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

  return (
    <div className="space-y-4">
      {/* Toggle between Sent and Queued + Edit buttons */}
      <div className="flex items-center justify-between">
        <ToggleGroup
          options={[
            { value: 'queued', label: 'Queued Emails' },
            { value: 'sent', label: 'Sent Emails' },
          ]}
          value={viewMode}
          onChange={setViewMode}
          variant="muted"
          disabled={isEditMode}
        />

        {/* Edit mode buttons - only show for queued emails */}
        {viewMode === 'queued' && (
          <div className="flex items-center gap-2">
            {!isEditMode ? (
              <>
                <IconButtonWithText
                  variant="violet"
                  onClick={handleEdit}
                >
                  <Pencil className="h-5 w-5" />
                  Edit
                </IconButtonWithText>
                <Separator orientation="vertical" className="h-8" />
                <label className="flex items-center gap-2 cursor-pointer">
                  <CheckButton
                    checked={showOnlyScheduled}
                    onCheckedChange={(checked) => setShowOnlyScheduled(checked as boolean)}
                    variant={showOnlyScheduled ? "success" : "default"}
                  />
                  <span className="text-sm font-medium whitespace-nowrap">Show only scheduled</span>
                </label>
              </>
            ) : (
              <>
                <IconButtonWithText
                  variant="amber"
                  onClick={handleCancel}
                  disabled={saving}
                >
                  <XIcon className="h-5 w-5" />
                  Cancel
                </IconButtonWithText>
                <IconButtonWithText
                  variant="blue"
                  onClick={handleSave}
                  disabled={saving}
                >
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
                  Deadline Date
                </span>
              </TableHead>
              <TableHead>
                <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Deadline Type
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
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  Loading...
                </TableCell>
              </TableRow>
            ) : data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  No {viewMode === 'sent' ? 'sent emails' : 'queued emails'} found
                </TableCell>
              </TableRow>
            ) : viewMode === 'sent' ? (
              (data as AuditEntry[]).map((entry) => (
                <TableRow key={entry.id} className="group hover:bg-accent/5">
                  <TableCell className="text-muted-foreground group-hover:text-foreground transition-colors">
                    {format(new Date(entry.sent_at), 'dd MMM yyyy')}
                  </TableCell>
                  <TableCell className="text-muted-foreground group-hover:text-foreground transition-colors">
                    {entry.deadline_date ? format(new Date(entry.deadline_date), 'dd MMM yyyy') : '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground group-hover:text-foreground transition-colors">
                    {entry.filing_type_id ? (FILING_TYPE_LABELS[entry.filing_type_id] || entry.filing_type_name) : '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground group-hover:text-foreground transition-colors">
                    {entry.template_name || '—'}
                  </TableCell>
                  <TableCell>
                    <div className={`px-3 py-2 rounded-md ${statusConfig[entry.delivery_status]?.bg || 'bg-gray-500/10'} inline-flex items-center gap-2`}>
                      <span className={statusConfig[entry.delivery_status]?.text || 'text-gray-500'}>
                        {statusConfig[entry.delivery_status]?.icon}
                      </span>
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
                  <TableRow key={reminder.id} className="group hover:bg-accent/5">
                    <TableCell className="text-muted-foreground group-hover:text-foreground transition-colors">
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
                    <TableCell className="text-muted-foreground group-hover:text-foreground transition-colors">
                      {format(new Date(reminder.deadline_date), 'dd MMM yyyy')}
                    </TableCell>
                    <TableCell className="text-muted-foreground group-hover:text-foreground transition-colors">
                      {reminder.filing_type_id ? (FILING_TYPE_LABELS[reminder.filing_type_id] || reminder.filing_type_name) : '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground group-hover:text-foreground transition-colors">
                      {reminder.template_name || '—'}
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
                            {/* Show options based on original status */}
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
                        <div className={`px-3 py-2 rounded-md ${statusConfig[currentStatus]?.bg || 'bg-gray-500/10'} inline-flex items-center gap-2`}>
                          <span className={statusConfig[currentStatus]?.text || 'text-gray-500'}>
                            {statusConfig[currentStatus]?.icon}
                          </span>
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
    </div>
  );
}
