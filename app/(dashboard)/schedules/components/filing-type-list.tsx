"use client"

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Icon } from '@/components/ui/icon'
import { Pencil, Trash2 } from 'lucide-react'
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

const STATUS_BADGE_CLASS: Record<boolean, string> = {
  true: 'bg-status-success text-white hover:bg-status-success font-sans',
  false: 'bg-status-neutral/20 text-status-neutral hover:bg-status-neutral/20 font-sans',
}

export interface StepDisplay {
  step_number: number
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

interface FilingTypeListProps {
  filingTypes: FilingType[]
  scheduleMap: Record<string, ScheduleWithSteps | null>
  deadlineDescriptions: Record<FilingTypeId, string>
}

export function FilingTypeList({ filingTypes, scheduleMap, deadlineDescriptions }: FilingTypeListProps) {
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

        return (
          <Card key={ft.id}>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1 min-w-0">
                  <CardTitle className="truncate">{ft.name}</CardTitle>
                  {ft.description && (
                    <CardDescription>{ft.description}</CardDescription>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {schedule && (
                    <Badge className={STATUS_BADGE_CLASS[schedule.is_active ? 'true' : 'false']}>
                      {schedule.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  )}
                  {schedule && (
                    <>
                      <Link href={`/schedules/${schedule.id}/edit`}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-10 w-10 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 hover:text-blue-500 transition-all duration-200 active:scale-[0.97]"
                        >
                          <Pencil className="h-5 w-5" />
                        </Button>
                      </Link>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(schedule.id, schedule.name)}
                        disabled={deletingId === schedule.id}
                        className="h-10 w-10 rounded-lg bg-destructive/10 hover:bg-destructive/20 text-destructive hover:text-destructive transition-all duration-200 active:scale-[0.97]"
                      >
                        <Trash2 className="h-5 w-5" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Client types & deadline rule */}
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-muted-foreground">Applies to:</span>
                  {ft.applicable_client_types.map((type) => (
                    <Badge key={type} variant="secondary" className="font-normal">
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
                <div className="space-y-3">
                  <p className="text-sm font-medium">
                    {schedule.name}{' '}
                    <span className="text-muted-foreground font-normal">
                      ({schedule.steps.length} {schedule.steps.length === 1 ? 'step' : 'steps'})
                    </span>
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
                            — {step.delay_days}d before
                          </span>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              ) : (
                <div className="text-center py-4 space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">No schedule configured</p>
                  <p className="text-xs text-muted-foreground">
                    Create a schedule to send reminders for this filing type
                  </p>
                </div>
              )}
            </CardContent>

            {!schedule && (
              <CardFooter>
                <Link href={`/schedules/new/edit?filing_type_id=${ft.id}`}>
                  <Button variant="outline" size="sm" className="active:scale-[0.97]">
                    <Icon name="add" size="sm" className="mr-1.5" />
                    Create Schedule
                  </Button>
                </Link>
              </CardFooter>
            )}
          </Card>
        )
      })}
    </div>
  )
}
