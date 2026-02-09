"use client"

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Trash2 } from 'lucide-react'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card'
import { toast } from 'sonner'
import type { StepDisplay } from './filing-type-list'

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

interface CustomScheduleListProps {
  schedules: CustomScheduleDisplay[]
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

export function CustomScheduleList({ schedules }: CustomScheduleListProps) {
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

  if (schedules.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center">
        <p className="text-sm text-muted-foreground">
          No custom schedules yet. Create one to send reminders for anything beyond HMRC filings.
        </p>
      </div>
    )
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {schedules.map((schedule) => (
        <Link key={schedule.id} href={`/schedules/${schedule.id}/edit`}>
          <Card className="cursor-pointer h-full flex flex-col">
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1 min-w-0">
                  <CardTitle className="truncate">{schedule.name}</CardTitle>
                  {schedule.description && (
                    <CardDescription>{schedule.description}</CardDescription>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
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
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      handleDelete(schedule.id, schedule.name)
                    }}
                    disabled={deletingId === schedule.id}
                    className="h-10 w-10 rounded-lg bg-destructive/10 hover:bg-destructive/20 text-destructive hover:text-destructive transition-all duration-200 active:scale-[0.97]"
                  >
                    <Trash2 className="h-5 w-5" />
                  </Button>
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
              <div className="space-y-3 flex-1 flex flex-col">
                <p className="text-sm font-medium">
                  {schedule.steps.length} {schedule.steps.length === 1 ? 'step' : 'steps'}
                </p>
                {schedule.steps.length > 0 && (
                  <ol className="space-y-1.5 text-sm">
                    {schedule.steps.map((step) => (
                      <li key={step.step_number} className="flex items-center gap-2">
                        <span className="text-muted-foreground w-5 text-right shrink-0">
                          {step.step_number}.
                        </span>
                        <span className="truncate">{step.template_name}</span>
                        <span className="text-muted-foreground shrink-0">
                          &mdash; {step.delay_days}d before
                        </span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  )
}
