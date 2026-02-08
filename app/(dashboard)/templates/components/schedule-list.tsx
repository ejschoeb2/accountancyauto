"use client"

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Copy, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { Schedule } from '@/lib/types/database'
import { toast } from 'sonner'

interface ScheduleWithMeta extends Schedule {
  step_count: number
  filing_type_name: string
}

interface ScheduleListProps {
  schedules: ScheduleWithMeta[]
}

export function ScheduleList({ schedules }: ScheduleListProps) {
  const router = useRouter()
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null)

  const handleDuplicate = async (scheduleId: string, scheduleName: string) => {
    setDuplicatingId(scheduleId)
    try {
      const res = await fetch(`/api/schedules/${scheduleId}/duplicate`, {
        method: 'POST',
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to duplicate schedule')
      }

      toast.success(`Duplicated "${scheduleName}"`)
      router.refresh()
    } catch (error) {
      console.error('Error duplicating schedule:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to duplicate schedule')
    } finally {
      setDuplicatingId(null)
    }
  }

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

  if (!schedules || schedules.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-12 text-center">
        <h3 className="text-lg font-medium">No schedules yet</h3>
        <p className="text-sm text-muted-foreground mt-2">
          Create your first reminder schedule to get started.
        </p>
        <Link href="/schedules/new/edit">
          <Button className="mt-4">Create Schedule</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {schedules.map((schedule) => (
        <div
          key={schedule.id}
          className="rounded-lg border bg-card p-6 hover:shadow-md hover:border-accent/30 transition-all duration-200"
        >
          <div className="flex items-start justify-between gap-4">
            {/* Schedule info */}
            <Link href={`/schedules/${schedule.id}/edit`} className="flex-1 min-w-0">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <h3 className="font-semibold text-lg truncate">{schedule.name}</h3>
                  <Badge variant={schedule.is_active ? 'default' : 'secondary'}>
                    {schedule.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span>{schedule.filing_type_name}</span>
                  <span>•</span>
                  <span>{schedule.step_count} {schedule.step_count === 1 ? 'step' : 'steps'}</span>
                </div>
                {schedule.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {schedule.description}
                  </p>
                )}
              </div>
            </Link>

            {/* Actions */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDuplicate(schedule.id, schedule.name)}
                disabled={duplicatingId === schedule.id}
              >
                <Copy className="size-4 mr-1.5" />
                {duplicatingId === schedule.id ? 'Duplicating...' : 'Duplicate'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDelete(schedule.id, schedule.name)}
                disabled={deletingId === schedule.id}
              >
                <Trash2 className="size-4 mr-1.5" />
                {deletingId === schedule.id ? 'Deleting...' : 'Delete'}
              </Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
