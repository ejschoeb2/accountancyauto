'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ScheduleStepEditor } from '../../components/schedule-step-editor'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { CheckCircle, Trash2 } from 'lucide-react'
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
import { scheduleSchema, type ScheduleInput } from '@/lib/validations/schedule'
import type { FilingType, FilingTypeId, EmailTemplate, Schedule, ScheduleStep } from '@/lib/types/database'

export default function EditSchedulePage() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const scheduleId = params.id as string
  const isNew = scheduleId === 'new'

  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deleting, setDeleting] = useState(false)

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

  const form = useForm<ScheduleInput>({
    resolver: zodResolver(scheduleSchema),
    defaultValues: {
      filing_type_id: defaultFilingTypeId,
      name: '',
      description: '',
      steps: [],
      is_active: true,
    },
  })

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

          // Map schedule data to form format
          form.reset({
            filing_type_id: scheduleData.filing_type_id,
            name: scheduleData.name,
            description: scheduleData.description || '',
            is_active: scheduleData.is_active,
            steps: scheduleData.steps.map(step => ({
              email_template_id: step.email_template_id,
              delay_days: step.delay_days,
            })),
          })
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

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || `Failed to ${isNew ? 'create' : 'update'} schedule`)
      }

      toast.success(isNew ? 'Schedule created!' : 'Schedule updated!')
      router.push('/schedules')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `Failed to ${isNew ? 'create' : 'update'} schedule`)
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

      toast.success('Schedule deleted!')
      router.push('/schedules')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete schedule')
      setDeleting(false)
      setShowDeleteDialog(false)
    }
  }

  const handleCancel = () => {
    router.push('/schedules')
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-foreground">Loading...</h1>
      </div>
    )
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-10">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <h1 className="text-foreground">{isNew ? 'Create Schedule' : 'Edit Schedule'}</h1>
        <div className="flex items-center gap-2">
          {!isNew && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setShowDeleteDialog(true)}
              className="h-10 w-10 rounded-lg bg-destructive/10 hover:bg-destructive/20 text-destructive hover:text-destructive transition-all duration-200 active:scale-[0.97]"
              title="Delete schedule"
            >
              <Trash2 className="h-5 w-5" />
            </Button>
          )}
          <Button
            type="submit"
            variant="ghost"
            size="icon"
            disabled={saving}
            className="h-10 w-10 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 hover:text-blue-500 transition-all duration-200 active:scale-[0.97]"
            title={saving ? 'Saving...' : isNew ? 'Create schedule' : 'Save changes'}
          >
            <CheckCircle className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Basic Information */}
      <div className="rounded-lg border p-8 space-y-6">
        <h2 className="text-lg font-semibold">Basic Information</h2>

        <div className="space-y-2">
          <Label htmlFor="filing_type_id">Filing Type</Label>
          <Select
            value={form.watch('filing_type_id')}
            onValueChange={(value) => form.setValue('filing_type_id', value as ScheduleInput['filing_type_id'])}
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
          {form.formState.errors.filing_type_id && (
            <p className="text-sm text-destructive">
              {form.formState.errors.filing_type_id.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="name">Schedule Name</Label>
          <Input
            id="name"
            placeholder="e.g., Standard Corporation Tax Reminders"
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

        <div className="flex items-center space-x-2">
          <Checkbox
            id="is_active"
            checked={form.watch('is_active')}
            onCheckedChange={(checked) => form.setValue('is_active', checked as boolean)}
          />
          <Label htmlFor="is_active" className="cursor-pointer">
            Active (will be used for generating reminders)
          </Label>
        </div>
      </div>

      {/* Schedule Steps */}
      <div className="rounded-lg border p-8 space-y-6">
        <h2 className="text-lg font-semibold">Schedule Steps</h2>
        <ScheduleStepEditor form={form} templates={emailTemplates} filingTypes={filingTypes.map(ft => ({ id: ft.id, name: ft.name }))} />
      </div>

      {/* Bottom action bar */}
      <div className="flex items-center justify-between pb-8">
        <Button
          type="button"
          variant="outline"
          onClick={handleCancel}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={saving}
          className="active:scale-[0.97]"
        >
          {saving ? 'Saving...' : isNew ? 'Create Schedule' : 'Save Changes'}
        </Button>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Schedule</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this schedule? All steps will be removed. This action cannot be undone.
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
  )
}
