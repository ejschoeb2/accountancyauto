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
  CardContent,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ArrowLeft, Bell, BellOff, CheckCircle, Pencil, RotateCcw, Trash2, X } from 'lucide-react'
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
  const [toggling, setToggling] = useState(false)
  const [isActive, setIsActive] = useState(true)
  const [scheduleType, setScheduleType] = useState<'filing' | 'custom'>(initialScheduleType)
  const [dateMode, setDateMode] = useState<DateMode>('one-off')
  const [selectedClientIds, setSelectedClientIds] = useState<Set<string>>(new Set())
  const [initialClientIds, setInitialClientIds] = useState<Set<string>>(new Set())
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false)

  const VALID_FILING_TYPE_IDS: FilingTypeId[] = [
    'corporation_tax_payment', 'ct600_filing', 'companies_house', 'vat_return', 'self_assessment',
    'mtd_quarterly_update', 'confirmation_statement', 'p11d_filing', 'paye_monthly',
    'cis_monthly_return', 'payroll_year_end', 'sa_payment_on_account',
    'partnership_tax_return', 'trust_tax_return',
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
            router.push('/deadlines')
            return
          }

          const scheduleData: Schedule & { steps: ScheduleStep[] } = await scheduleResponse.json()

          // Determine schedule type from loaded data
          const loadedType = scheduleData.schedule_type || 'filing'
          setScheduleType(loadedType)
          setIsActive(scheduleData.is_active)

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
        router.push('/deadlines')
      }
    }

    loadData()
  }, [scheduleId, isNew, router, form])

  // Track unsaved changes
  const hasUnsavedChanges = form.formState.isDirty || (
    isNew && scheduleType === 'custom' && (
      selectedClientIds.size !== initialClientIds.size ||
      Array.from(selectedClientIds).some(id => !initialClientIds.has(id))
    )
  )

  // Warn on browser close/refresh with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault()
        e.returnValue = ''
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [hasUnsavedChanges])

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

      toast.success(isNew ? 'Deadline created!' : 'Deadline updated!')
      setShowUnsavedDialog(false)
      router.push('/deadlines')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `Failed to ${isNew ? 'create' : 'update'} deadline`)
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

      toast.success('Deadline deleted!')
      router.push('/deadlines')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete deadline')
      setDeleting(false)
      setShowDeleteDialog(false)
    }
  }

  const handleToggleActive = async () => {
    setToggling(true)
    try {
      const res = await fetch(`/api/schedules/${scheduleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !isActive }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to update schedule')
      }

      const next = !isActive
      setIsActive(next)
      form.setValue('is_active', next, { shouldDirty: false })
      toast.success(next ? 'Deadline activated' : 'Deadline deactivated')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update schedule')
    } finally {
      setToggling(false)
    }
  }

  const handleCancel = () => {
    if (hasUnsavedChanges) {
      setShowUnsavedDialog(true)
    } else {
      router.push('/deadlines')
    }
  }

  const confirmCancel = () => {
    router.push('/deadlines')
  }

  const handleResetChanges = () => {
    form.reset()
    setSelectedClientIds(new Set(initialClientIds))
  }

  return (
    <PageLoadingProvider>
    {loading ? null : (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-10 max-w-7xl mx-auto">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <h1 className="text-foreground">
          {isNew
            ? (scheduleType === 'custom' ? 'Create Custom Deadline' : 'Create Deadline')
            : 'Edit Deadline'}
        </h1>
        <div className="flex items-center gap-2">
          {!isNew && (
            <>
              {scheduleType === 'custom' && (
                <IconButtonWithText
                  type="button"
                  variant="destructive"
                  onClick={() => setShowDeleteDialog(true)}
                  title="Delete deadline"
                >
                  <Trash2 className="h-5 w-5" />
                  Delete
                </IconButtonWithText>
              )}
              <IconButtonWithText
                type="button"
                variant="amber"
                onClick={handleCancel}
                title="Go back"
              >
                <ArrowLeft className="h-5 w-5" />
                Go Back
              </IconButtonWithText>
              <div className="h-8 w-px bg-border" />
              <IconButtonWithText
                type="button"
                variant={isActive ? 'destructive' : 'green'}
                onClick={handleToggleActive}
                disabled={toggling}
                title={isActive ? 'Deactivate deadline' : 'Activate deadline'}
              >
                {isActive ? <BellOff className="h-5 w-5" /> : <Bell className="h-5 w-5" />}
                {toggling ? '...' : isActive ? 'Deactivate' : 'Activate'}
              </IconButtonWithText>
            </>
          )}
          {isNew && (
            <IconButtonWithText
              type="button"
              variant="amber"
              onClick={handleCancel}
              title="Cancel"
            >
              <X className="h-5 w-5" />
              Cancel
            </IconButtonWithText>
          )}
          {!isNew && hasUnsavedChanges && (
            <IconButtonWithText
              type="button"
              variant="amber"
              onClick={handleResetChanges}
              title="Undo changes"
            >
              <RotateCcw className="h-5 w-5" />
              Cancel Changes
            </IconButtonWithText>
          )}
          <IconButtonWithText
            type="submit"
            variant="blue"
            disabled={saving || (!isNew && !hasUnsavedChanges)}
            title={saving ? 'Saving...' : isNew ? 'Create deadline' : 'Save changes'}
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
        <div className="px-8">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="space-y-1">
              <h2 className="text-2xl font-semibold">Basic Information</h2>
              <p className="text-sm text-muted-foreground">
                Configure the name, filing type, and basic settings for this deadline.
              </p>
            </div>
          </div>
        </div>
        <CardContent className="space-y-6">
          {/* Schedule Type indicator (read-only for existing schedules) */}
          {!isNew && (
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Deadline Type</Label>
              <p className="text-sm text-muted-foreground">
                {scheduleType === 'custom' ? 'Custom Deadline' : 'Filing Deadline'}
                {' '}&mdash; type cannot be changed after creation.
              </p>
            </div>
          )}

          {/* Filing Type dropdown - only for filing schedules */}
          {scheduleType === 'filing' && (
            <div className="space-y-2">
              <Label htmlFor="filing_type_id" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Filing Type</Label>
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

          {/* Document requirements for the selected filing type */}
          {scheduleType === 'filing' && (() => {
            const selectedFilingTypeId = form.watch('filing_type_id')
            const selectedFt = filingTypes.find(ft => ft.id === selectedFilingTypeId)
            const docs = selectedFt?.document_requirements ?? []
            if (docs.length === 0) return null
            const mandatory = docs.filter(d => d.is_mandatory)
            const optional = docs.filter(d => !d.is_mandatory)
            return (
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Documents to collect</Label>
                <ul className="list-disc pl-5 space-y-1.5">
                  {mandatory.map(d => (
                    <li key={d.label} className="text-sm font-medium">{d.label}</li>
                  ))}
                  {optional.map(d => (
                    <li key={d.label} className="text-sm font-medium">
                      {d.label} <span className="text-muted-foreground font-normal">(may also need)</span>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })()}

          {/* Custom schedule send hour */}
          {scheduleType === 'custom' && (
            <div className="space-y-2">
              <Label htmlFor="send_hour" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Send Hour (UK time)</Label>
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
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Date Configuration</Label>
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
                  <Label htmlFor="custom_date" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Target Date</Label>
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
                    <Label htmlFor="recurrence_rule" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Recurrence</Label>
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
                    <Label htmlFor="recurrence_anchor" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Anchor Date</Label>
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
          <Label htmlFor="name" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Deadline Name</Label>
          <Input
            id="name"
            placeholder={scheduleType === 'custom'
              ? "e.g., Monthly Payroll Deadline"
              : "e.g., Standard Corporation Tax Deadline"}
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
          <Label htmlFor="description" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Description</Label>
          <Textarea
            id="description"
            rows={3}
            placeholder="Internal notes about this deadline"
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
          <div className="flex items-start justify-between gap-4 mb-4">
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
          <ScheduleStepEditor form={form} fieldArray={stepsFieldArray} templates={emailTemplates} scheduleType={scheduleType} />
        </CardContent>
      </Card>

      {/* Client selector for new custom schedules (opt-in, none selected by default) */}
      {isNew && scheduleType === 'custom' && (
        <Card className="gap-1.5">
          <div className="px-8">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="space-y-1">
                <h2 className="text-2xl font-semibold">Applies To</h2>
                <p className="text-sm text-muted-foreground">
                  Select which clients this deadline should apply to.
                </p>
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
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="space-y-1">
                <h2 className="text-2xl font-semibold">Applies To</h2>
                <p className="text-sm text-muted-foreground">
                  This deadline applies to all clients by default. Untick any clients to exclude them.
                </p>
              </div>
            </div>
          </div>
          <CardContent>
            <ClientExclusions scheduleId={scheduleId} />
          </CardContent>
        </Card>
      )}

      {/* Unsaved Changes Dialog */}
      <Dialog open={showUnsavedDialog} onOpenChange={() => {}}>
        <DialogContent className="[&>button]:hidden">
          <DialogHeader>
            <DialogTitle>Unsaved Changes</DialogTitle>
            <DialogDescription>
              You have unsaved changes. Are you sure you want to leave without saving?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <IconButtonWithText
              variant="violet"
              onClick={() => setShowUnsavedDialog(false)}
            >
              <Pencil className="h-5 w-5" />
              Keep Editing
            </IconButtonWithText>
            <IconButtonWithText
              variant="destructive"
              onClick={confirmCancel}
            >
              <X className="h-5 w-5" />
              Discard Changes
            </IconButtonWithText>
            <IconButtonWithText
              variant="blue"
              onClick={() => form.handleSubmit(onSubmit)()}
              disabled={saving}
            >
              <CheckCircle className="h-5 w-5" />
              {saving ? 'Saving...' : 'Save Changes'}
            </IconButtonWithText>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Deadline</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this deadline? All reminder steps will be removed. This action cannot be undone.
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
