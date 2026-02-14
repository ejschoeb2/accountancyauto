'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ScheduleStepEditor, ScheduleStepAddButton } from '../../components/schedule-step-editor'
import { ClientExclusions } from '../../components/client-exclusions'
import { ClientSelector } from '../../components/client-selector'
import { Button } from '@/components/ui/button'
import { IconButtonWithText } from '@/components/ui/icon-button-with-text'
import { PageLoadingProvider, usePageLoading } from '@/components/page-loading'
import {
  Card,
  CardHeader,
  CardTitle,
  CardAction,
  CardContent,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { CheckCircle, Trash2, X } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import {
  filingScheduleSchema,
  customScheduleSchema,
  type ScheduleInput,
  type FilingScheduleInput,
  type CustomScheduleInput,
} from '@/lib/validations/schedule'
import type { FilingType, FilingTypeId, EmailTemplate, Schedule, ScheduleStep } from '@/lib/types/database'

type DateMode = 'one-off' | 'recurring'

export default function EditSchedulePage() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const scheduleId = params.id as string
  const isNew = scheduleId === 'new'

  // Determine schedule type from URL param (new schedules) or loaded data (existing)
  const typeParam = searchParams.get('type')
  const initialScheduleType = typeParam === 'custom' ? 'custom' : 'filing'

  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)

  usePageLoading('schedule-edit', loading)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [scheduleType, setScheduleType] = useState<'filing' | 'custom'>(initialScheduleType)
  const [dateMode, setDateMode] = useState<DateMode>('one-off')
  const [selectedClientIds, setSelectedClientIds] = useState<Set<string>>(new Set())

  const VALID_FILING_TYPE_IDS: FilingTypeId[] = [
    'corporation_tax_payment', 'ct600_filing', 'companies_house', 'vat_return', 'self_assessment',
  ]
  const prefillFilingType = searchParams.get('filing_type_id')
  const defaultFilingTypeId: FilingTypeId = (
    isNew && prefillFilingType && VALID_FILING_TYPE_IDS.includes(prefillFilingType as FilingTypeId)
      ? prefillFilingType
      : 'corporation_tax_payment'
  ) as FilingTypeId

  const [filingTypes, setFilingTypes] = useState<FilingType[]>([])
  const [emailTemplates, setEmailTemplates] = useState<Array<{ id: string; name: string }>>([])

  // Use separate schemas based on schedule type
  const currentSchema = scheduleType === 'custom' ? customScheduleSchema : filingScheduleSchema

  const form = useForm<ScheduleInput>({
    resolver: zodResolver(currentSchema),
    defaultValues: scheduleType === 'custom'
      ? {
          schedule_type: 'custom' as const,
          name: '',
          description: '',
          steps: [],
          is_active: true,
          filing_type_id: null,
          custom_date: null,
          recurrence_rule: null,
          recurrence_anchor: null,
          send_hour: null,
        }
      : {
          schedule_type: 'filing' as const,
          filing_type_id: defaultFilingTypeId,
          name: '',
          description: '',
          steps: [],
          is_active: true,
          custom_date: null,
          recurrence_rule: null,
          recurrence_anchor: null,
        },
  })

  const stepsFieldArray = useFieldArray({ control: form.control, name: "steps" })

  // Load reference data and existing schedule
  useEffect(() => {
    const loadData = async () => {
      try {
        // Load filing types
        const filingTypesResponse = await fetch('/api/filing-types')
        if (!filingTypesResponse.ok) {
          throw new Error('Failed to load filing types')
        }
        const filingTypesData: FilingType[] = await filingTypesResponse.json()
        setFilingTypes(filingTypesData)

        // Load email templates
        const templatesResponse = await fetch('/api/email-templates')
        if (!templatesResponse.ok) {
          throw new Error('Failed to load email templates')
        }
        const templatesData: EmailTemplate[] = await templatesResponse.json()
        setEmailTemplates(templatesData.map(t => ({ id: t.id, name: t.name })))

        // Load existing schedule if editing
        if (!isNew) {
          const scheduleResponse = await fetch(`/api/schedules/${scheduleId}`)
          if (!scheduleResponse.ok) {
            if (scheduleResponse.status === 404) {
              toast.error('Schedule not found')
            } else {
              const error = await scheduleResponse.json()
              toast.error(error.error || 'Failed to load schedule')
            }
            router.push('/schedules')
            return
          }

          const scheduleData: Schedule & { steps: ScheduleStep[] } = await scheduleResponse.json()

          // Determine schedule type from loaded data
          const loadedType = scheduleData.schedule_type || 'filing'
          setScheduleType(loadedType)

          // Determine date mode for custom schedules
          if (loadedType === 'custom') {
            if (scheduleData.recurrence_rule) {
              setDateMode('recurring')
            } else {
              setDateMode('one-off')
            }
          }

          // Map schedule data to form format
          if (loadedType === 'custom') {
            form.reset({
              schedule_type: 'custom' as const,
              filing_type_id: null,
              name: scheduleData.name,
              description: scheduleData.description || '',
              is_active: scheduleData.is_active,
              custom_date: scheduleData.custom_date || null,
              recurrence_rule: scheduleData.recurrence_rule || null,
              recurrence_anchor: scheduleData.recurrence_anchor || null,
              send_hour: scheduleData.send_hour ?? null,
              steps: scheduleData.steps.map(step => ({
                email_template_id: step.email_template_id,
                delay_days: step.delay_days,
              })),
            } as CustomScheduleInput)
          } else {
            form.reset({
              schedule_type: 'filing' as const,
              filing_type_id: scheduleData.filing_type_id!,
              name: scheduleData.name,
              description: scheduleData.description || '',
              is_active: scheduleData.is_active,
              custom_date: null,
              recurrence_rule: null,
              recurrence_anchor: null,
              steps: scheduleData.steps.map(step => ({
                email_template_id: step.email_template_id,
                delay_days: step.delay_days,
              })),
            } as FilingScheduleInput)
          }
        }

        setLoading(false)
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to load data')
        router.push('/schedules')
      }
    }

    loadData()
  }, [scheduleId, isNew, router, form])

  const onSubmit = async (data: ScheduleInput) => {
    setSaving(true)
    try {
      const url = isNew ? '/api/schedules' : `/api/schedules/${scheduleId}`
      const method = isNew ? 'POST' : 'PUT'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || `Failed to ${isNew ? 'create' : 'update'} schedule`)
      }

      // For new custom schedules, save client exclusions (all clients NOT selected = excluded)
      if (isNew && scheduleType === 'custom') {
        const created = result
        const clientsRes = await fetch('/api/clients')
        if (clientsRes.ok) {
          const clientsData = await clientsRes.json()
          const allClients: { id: string }[] = clientsData.clients || clientsData || []
          const excludedIds = allClients
            .map(c => c.id)
            .filter(id => !selectedClientIds.has(id))

          if (excludedIds.length > 0) {
            await fetch(`/api/schedules/${created.id}/exclusions`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ excluded_client_ids: excludedIds }),
            })
          }
        }
      }

      toast.success(isNew ? 'Reminder schedule created!' : 'Reminder schedule updated!')
      router.push('/schedules')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `Failed to ${isNew ? 'create' : 'update'} reminder schedule`)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const response = await fetch(`/api/schedules/${scheduleId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete schedule')
      }

      toast.success('Reminder schedule deleted!')
      router.push('/schedules')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete reminder schedule')
      setDeleting(false)
      setShowDeleteDialog(false)
    }
  }

  const handleCancel = () => {
    router.push('/schedules')
  }

  return (
    <PageLoadingProvider>
    {loading ? null : (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-10 max-w-7xl mx-auto">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <h1 className="text-foreground">
          {isNew
            ? (scheduleType === 'custom' ? 'Create Custom Reminder Schedule' : 'Create Reminder Schedule')
            : 'Edit Reminder Schedule'}
        </h1>
        <div className="flex items-center gap-2">
          {!isNew && (
            <>
              <IconButtonWithText
                type="button"
                variant="destructive"
                onClick={() => setShowDeleteDialog(true)}
                title="Delete schedule"
              >
                <Trash2 className="h-5 w-5" />
                Delete
              </IconButtonWithText>
              <div className="h-8 w-px bg-border" />
            </>
          )}
          <IconButtonWithText
            type="button"
            variant="amber"
            onClick={handleCancel}
            title="Cancel"
          >
            <X className="h-5 w-5" />
            Cancel
          </IconButtonWithText>
          <IconButtonWithText
            type="submit"
            variant="blue"
            disabled={saving}
            title={saving ? 'Saving...' : isNew ? 'Create schedule' : 'Save changes'}
          >
            <CheckCircle className="h-5 w-5" />
            {saving ? 'Saving...' : isNew ? 'Create' : 'Save'}
          </IconButtonWithText>
        </div>
      </div>

      {/* Hidden schedule_type field */}
      <input type="hidden" {...form.register('schedule_type')} />

      {/* Basic Information */}
      <Card className="gap-1.5">
        <CardHeader>
          <CardTitle className="text-2xl">Basic Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Schedule Type indicator (read-only for existing schedules) */}
          {!isNew && (
            <div className="space-y-2">
              <Label>Reminder Type</Label>
              <p className="text-sm text-muted-foreground">
                {scheduleType === 'custom' ? 'Custom Reminder' : 'Filing Deadline Reminder'}
                {' '}&mdash; type cannot be changed after creation.
              </p>
            </div>
          )}

          {/* Filing Type dropdown - only for filing schedules */}
          {scheduleType === 'filing' && (
            <div className="space-y-2">
              <Label htmlFor="filing_type_id">Filing Type</Label>
              <Select
                value={form.watch('filing_type_id') as string ?? ''}
                onValueChange={(value) => form.setValue('filing_type_id', value as FilingTypeId)}
                disabled={!isNew}
              >
                <SelectTrigger id="filing_type_id">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {filingTypes.map((filingType) => (
                    <SelectItem key={filingType.id} value={filingType.id}>
                      {filingType.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!isNew && (
                <p className="text-sm text-muted-foreground">
                  Filing type cannot be changed after creation.
                </p>
              )}
              {form.formState.errors.filing_type_id && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.filing_type_id.message}
                </p>
              )}
            </div>
          )}

          {/* Custom schedule send hour */}
          {scheduleType === 'custom' && (
            <div className="space-y-2">
              <Label htmlFor="send_hour">Send Hour (UK time)</Label>
              <Select
                value={form.watch('send_hour') != null ? String(form.watch('send_hour')) : 'default'}
                onValueChange={(value) =>
                  form.setValue('send_hour', value === 'default' ? null : parseInt(value, 10))
                }
              >
                <SelectTrigger id="send_hour">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Use global default</SelectItem>
                  {Array.from({ length: 16 }, (_, i) => i + 6).map((h) => (
                    <SelectItem key={h} value={String(h)}>
                      {h === 0 ? '12:00 AM' : h < 12 ? `${h}:00 AM` : h === 12 ? '12:00 PM' : `${h - 12}:00 PM`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                Override when these reminders are sent. &ldquo;Use global default&rdquo; follows the setting on the Settings page.
              </p>
            </div>
          )}

          {/* Custom schedule date configuration */}
          {scheduleType === 'custom' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Date Configuration</Label>
                <Select
                  value={dateMode}
                  onValueChange={(value: DateMode) => {
                    setDateMode(value)
                    if (value === 'one-off') {
                      form.setValue('recurrence_rule', null)
                      form.setValue('recurrence_anchor', null)
                    } else {
                      form.setValue('custom_date', null)
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="one-off">One-off date</SelectItem>
                    <SelectItem value="recurring">Recurring</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {dateMode === 'one-off' ? (
                <div className="space-y-2">
                  <Label htmlFor="custom_date">Target Date</Label>
                  <Input
                    id="custom_date"
                    type="date"
                    className="hover:border-foreground/20"
                    value={form.watch('custom_date') || ''}
                    onChange={(e) => form.setValue('custom_date', e.target.value || null)}
                  />
                  <p className="text-sm text-muted-foreground">
                    Reminders will be scheduled relative to this date.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="recurrence_rule">Recurrence</Label>
                    <Select
                      value={form.watch('recurrence_rule') || ''}
                      onValueChange={(value) => form.setValue('recurrence_rule', value as 'monthly' | 'quarterly' | 'annually')}
                    >
                      <SelectTrigger id="recurrence_rule">
                        <SelectValue placeholder="Select frequency" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="quarterly">Quarterly</SelectItem>
                        <SelectItem value="annually">Annually</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="recurrence_anchor">Anchor Date</Label>
                    <Input
                      id="recurrence_anchor"
                      type="date"
                      className="hover:border-foreground/20"
                      value={form.watch('recurrence_anchor') || ''}
                      onChange={(e) => form.setValue('recurrence_anchor', e.target.value || null)}
                    />
                    <p className="text-sm text-muted-foreground">
                      The base date from which recurrence is calculated.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

        <div className="space-y-2">
          <Label htmlFor="name">Reminder Name</Label>
          <Input
            id="name"
            placeholder={scheduleType === 'custom'
              ? "e.g., Monthly Payroll Reminder"
              : "e.g., Standard Corporation Tax Reminders"}
            className="hover:border-foreground/20"
            {...form.register('name')}
          />
          {form.formState.errors.name && (
            <p className="text-sm text-destructive">
              {form.formState.errors.name.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            rows={3}
            placeholder="Internal notes about this schedule"
            className="hover:border-foreground/20"
            {...form.register('description')}
          />
          {form.formState.errors.description && (
            <p className="text-sm text-destructive">
              {form.formState.errors.description.message}
            </p>
          )}
        </div>
        </CardContent>
      </Card>

      {/* Reminder Steps */}
      <Card className="gap-1.5">
        <div className="px-8">
          <div className="flex items-start justify-between gap-4 mb-6">
            <div className="space-y-1">
              <h2 className="text-2xl font-semibold">Reminder Steps</h2>
              <p className="text-sm text-muted-foreground">
                Each step sends an email at a specific number of days before the deadline. Configure the email template and timing for each reminder.
              </p>
            </div>
            <ScheduleStepAddButton onAdd={() => stepsFieldArray.append({ email_template_id: "", delay_days: 7 })} />
          </div>
        </div>
        <CardContent>
          <ScheduleStepEditor form={form} fieldArray={stepsFieldArray} templates={emailTemplates} />
        </CardContent>
      </Card>

      {/* Client selector for new custom schedules (opt-in, none selected by default) */}
      {isNew && scheduleType === 'custom' && (
        <Card className="gap-1.5">
          <div className="px-8">
            <div className="mb-6">
              <div className="space-y-1">
                <h2 className="text-2xl font-semibold">Applies To</h2>
              </div>
            </div>
          </div>
          <CardContent>
            <ClientSelector
              selectedIds={selectedClientIds}
              onToggle={(clientId) => {
                setSelectedClientIds(prev => {
                  const next = new Set(prev)
                  if (next.has(clientId)) {
                    next.delete(clientId)
                  } else {
                    next.add(clientId)
                  }
                  return next
                })
              }}
            />
          </CardContent>
        </Card>
      )}

      {/* Client Exclusions - for existing schedules */}
      {!isNew && (
        <Card className="gap-1.5">
          <div className="px-8">
            <div className="mb-6">
              <div className="space-y-1">
                <h2 className="text-2xl font-semibold">Applies To</h2>
              </div>
            </div>
          </div>
          <CardContent>
            <ClientExclusions scheduleId={scheduleId} />
          </CardContent>
        </Card>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Reminder Schedule</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this reminder schedule? All reminder steps will be removed. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </form>
    )}
    </PageLoadingProvider>
  )
}
