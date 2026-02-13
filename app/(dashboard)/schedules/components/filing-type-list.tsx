"use client"

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ButtonBase } from '@/components/ui/button-base'
import { Badge } from '@/components/ui/badge'
import { Icon } from '@/components/ui/icon'
import { Trash2 } from 'lucide-react'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card'
import { toast } from 'sonner'
import type { FilingType, FilingTypeId } from '@/lib/types/database'

export interface StepDisplay {
  step_number: number
  template_id: string
  template_name: string
  delay_days: number
}

export interface ScheduleWithSteps {
  id: string
  name: string
  description: string | null
  is_active: boolean
  steps: StepDisplay[]
}

export interface CustomScheduleDisplay {
  id: string
  name: string
  description: string | null
  is_active: boolean
  custom_date: string | null
  recurrence_rule: string | null
  recurrence_anchor: string | null
  steps: StepDisplay[]
}

function formatDateInfo(schedule: CustomScheduleDisplay): string {
  if (schedule.custom_date) {
    return `Target: ${schedule.custom_date}`
  }
  if (schedule.recurrence_rule && schedule.recurrence_anchor) {
    const ruleLabel = schedule.recurrence_rule.charAt(0).toUpperCase() + schedule.recurrence_rule.slice(1)
    return `Recurs: ${ruleLabel} from ${schedule.recurrence_anchor}`
  }
  return 'No date configured'
}

interface FilingTypeListProps {
  filingTypes: FilingType[]
  scheduleMap: Record<string, ScheduleWithSteps | null>
  deadlineDescriptions: Record<FilingTypeId, string>
  customSchedules: CustomScheduleDisplay[]
}

export function FilingTypeList({ filingTypes, scheduleMap, deadlineDescriptions, customSchedules }: FilingTypeListProps) {
  const router = useRouter()
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const handleDelete = async (scheduleId: string, scheduleName: string) => {
    if (!confirm(`Are you sure you want to delete "${scheduleName}"?\n\nThis will remove the schedule and all its steps. This action cannot be undone.`)) {
      return
    }

    setDeletingId(scheduleId)
    try {
      const res = await fetch(`/api/schedules/${scheduleId}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to delete schedule')
      }

      toast.success(`Deleted "${scheduleName}"`)
      router.refresh()
    } catch (error) {
      console.error('Error deleting schedule:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to delete schedule')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {filingTypes.map((ft) => {
        const schedule = scheduleMap[ft.id] ?? null
        const href = schedule
          ? `/schedules/${schedule.id}/edit`
          : `/schedules/new/edit?filing_type_id=${ft.id}`

        return (
          <Link key={ft.id} href={href}>
            <Card className="cursor-pointer h-full flex flex-col">
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <CardTitle className="truncate text-lg">{ft.name}</CardTitle>
                    {ft.description && (
                      <CardDescription>{ft.description}</CardDescription>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {schedule && (
                      <div className={`px-3 py-2 rounded-md inline-flex items-center ${
                        schedule.is_active
                          ? 'bg-status-success/10'
                          : 'bg-status-neutral/10'
                      }`}>
                        <span className={`text-sm font-medium ${
                          schedule.is_active
                            ? 'text-status-success'
                            : 'text-status-neutral'
                        }`}>
                          {schedule.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    )}
                    {schedule && (
                      <ButtonBase
                        variant="destructive"
                        buttonType="icon-only"
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          handleDelete(schedule.id, schedule.name)
                        }}
                        disabled={deletingId === schedule.id}
                      >
                        <Trash2 className="h-5 w-5" />
                      </ButtonBase>
                    )}
                  </div>
                </div>
              </CardHeader>

            <CardContent className="space-y-4 flex-1 flex flex-col">
              {/* Client types & deadline rule */}
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-foreground">Applies to:</span>
                  {ft.applicable_client_types.map((type) => (
                    <Badge key={type} variant="secondary" className="font-normal bg-blue-500/10 text-blue-500 rounded-md px-3 py-1.5 text-sm">
                      {type}
                    </Badge>
                  ))}
                </div>
                <div className="text-muted-foreground">
                  <span className="font-medium text-foreground">Deadline rule:</span>{' '}
                  {deadlineDescriptions[ft.id]}
                </div>
              </div>

              <hr />

              {/* Schedule section */}
              {schedule ? (
                <div className="space-y-3 flex-1 flex flex-col">
                  <p className="text-base font-bold">
                    Reminder Schedule:
                  </p>
                  {schedule.steps.length > 0 && (
                    <ol className="space-y-2 text-sm">
                      {schedule.steps.map((step) => (
                        <li key={step.step_number} className="flex items-start gap-2">
                          <span className="text-muted-foreground w-5 text-right shrink-0">
                            {step.step_number}.
                          </span>
                          <span className="min-w-0">
                            {step.template_name} <span className="text-muted-foreground">— {step.delay_days}d before</span>
                          </span>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              ) : (
                <div className="text-center flex-1 flex items-center justify-center space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">No reminder schedule configured</p>
                  <p className="text-xs text-muted-foreground">
                    Create a reminder schedule to automatically notify clients about this deadline
                  </p>
                </div>
              )}
            </CardContent>

            {!schedule && (
              <CardFooter>
                <Button variant="outline" size="sm" className="active:scale-[0.97]" onClick={(e) => e.stopPropagation()}>
                  <Icon name="add" size="sm" className="mr-1.5" />
                  Create Reminder Schedule
                </Button>
              </CardFooter>
            )}
            </Card>
          </Link>
        )
      })}

      {/* Custom schedule cards */}
      {customSchedules.map((schedule) => (
        <Link key={schedule.id} href={`/schedules/${schedule.id}/edit`}>
          <Card className="cursor-pointer h-full flex flex-col">
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1 min-w-0">
                  <CardTitle className="truncate text-lg">{schedule.name}</CardTitle>
                  {schedule.description && (
                    <CardDescription>{schedule.description}</CardDescription>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="px-3 py-2 rounded-md inline-flex items-center bg-violet-500/10">
                    <span className="text-sm font-medium text-violet-500">Custom</span>
                  </div>
                  <div className={`px-3 py-2 rounded-md inline-flex items-center ${
                    schedule.is_active
                      ? 'bg-status-success/10'
                      : 'bg-status-neutral/10'
                  }`}>
                    <span className={`text-sm font-medium ${
                      schedule.is_active
                        ? 'text-status-success'
                        : 'text-status-neutral'
                    }`}>
                      {schedule.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <ButtonBase
                    variant="destructive"
                    buttonType="icon-only"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      handleDelete(schedule.id, schedule.name)
                    }}
                    disabled={deletingId === schedule.id}
                  >
                    <Trash2 className="h-5 w-5" />
                  </ButtonBase>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4 flex-1 flex flex-col">
              {/* Date info */}
              <div className="text-sm text-muted-foreground">
                {formatDateInfo(schedule)}
              </div>

              <hr />

              {/* Steps section */}
              {schedule.steps.length > 0 ? (
                <div className="space-y-3 flex-1 flex flex-col">
                  <p className="text-base font-bold">Schedule:</p>
                  <ol className="space-y-2 text-sm">
                    {schedule.steps.map((step) => (
                      <li key={step.step_number} className="flex items-start gap-2">
                        <span className="text-muted-foreground w-5 text-right shrink-0">
                          {step.step_number}.
                        </span>
                        <span className="min-w-0">
                          {step.template_name} <span className="text-muted-foreground">&mdash; {step.delay_days}d before</span>
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>
              ) : (
                <div className="text-center flex-1 flex items-center justify-center">
                  <p className="text-sm text-muted-foreground">No steps configured</p>
                </div>
              )}
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  )
}
