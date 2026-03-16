"use client"

import { useState, useMemo, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ButtonBase } from '@/components/ui/button-base'
import { IconButtonWithText } from '@/components/ui/icon-button-with-text'
import { ButtonWithText } from '@/components/ui/button-with-text'
import { ToggleGroup } from '@/components/ui/toggle-group'
import { Icon } from '@/components/ui/icon'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SlidersHorizontal, X, Trash2, Plus, Search, CircleMinus } from 'lucide-react'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card'
import { toast } from 'sonner'
import { updateOrgFilingTypeSelections } from '@/app/actions/deadlines'
import type { FilingType, FilingTypeId } from '@/lib/types/database'
import { ActivateDeadlineModal } from './activate-deadline-modal'

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

type StatusFilter = 'active' | 'inactive'

const CLIENT_TYPE_OPTIONS = [
  'Limited Company',
  'LLP',
  'Sole Trader',
  'Partnership',
  'Individual',
] as const

interface DeadlinesViewProps {
  allFilingTypes: FilingType[]
  activeTypeIds: string[]
  scheduleMap: Record<string, ScheduleWithSteps | null>
  deadlineDescriptions: Record<FilingTypeId, string>
  customSchedules: CustomScheduleDisplay[]
}

export function DeadlinesView({
  allFilingTypes,
  activeTypeIds,
  scheduleMap,
  deadlineDescriptions,
  customSchedules,
}: DeadlinesViewProps) {
  const router = useRouter()
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [showFilters, setShowFilters] = useState(false)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active')
  const [typeFilters, setTypeFilters] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState('name-asc')
  const [isPending, startTransition] = useTransition()
  const [activatingFilingType, setActivatingFilingType] = useState<FilingType | null>(null)

  const activeSet = useMemo(() => new Set(activeTypeIds), [activeTypeIds])

  const toggleTypeFilter = (type: string) => {
    setTypeFilters(prev => {
      const next = new Set(prev)
      next.has(type) ? next.delete(type) : next.add(type)
      return next
    })
  }

  const clearAllFilters = () => {
    setTypeFilters(new Set())
  }

  // Filter filing types
  const filteredFilingTypes = useMemo(() => {
    let result = allFilingTypes.filter(ft => {
      // Status filter
      const isActive = activeSet.has(ft.id)
      if (statusFilter === 'active' && !isActive) return false
      if (statusFilter === 'inactive' && isActive) return false

      // Search
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        const matchesName = ft.name.toLowerCase().includes(q)
        const matchesDesc = ft.description?.toLowerCase().includes(q)
        if (!matchesName && !matchesDesc) return false
      }

      // Client type filter
      if (typeFilters.size > 0) {
        const hasMatch = ft.applicable_client_types.some(ct => typeFilters.has(ct))
        if (!hasMatch) return false
      }

      return true
    })

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case 'name-asc':
          return a.name.localeCompare(b.name)
        case 'name-desc':
          return b.name.localeCompare(a.name)
        case 'type-asc':
          return (a.applicable_client_types[0] ?? '').localeCompare(b.applicable_client_types[0] ?? '')
        default:
          return (a.sort_order ?? 99) - (b.sort_order ?? 99)
      }
    })

    return result
  }, [allFilingTypes, activeSet, statusFilter, searchQuery, typeFilters, sortBy])

  const handleActivateWithExclusions = async (excludedClientIds: string[]) => {
    if (!activatingFilingType) return
    const filingTypeId = activatingFilingType.id
    const newActiveIds = [...activeTypeIds, filingTypeId]
    const result = await updateOrgFilingTypeSelections(newActiveIds)
    if (result.error) {
      toast.error(result.error)
      return
    }

    // Save exclusions if any were selected
    if (excludedClientIds.length > 0) {
      // Get schedule ID: newly created or pre-existing
      const scheduleId =
        result.newScheduleIds?.[filingTypeId] ?? scheduleMap[filingTypeId]?.id
      if (scheduleId) {
        await fetch(`/api/schedules/${scheduleId}/exclusions`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ excluded_client_ids: excludedClientIds }),
        })
      }
    }

    toast.success('Deadline activated')
    setActivatingFilingType(null)
    router.refresh()
  }

  const handleDeactivate = (filingTypeId: string) => {
    startTransition(async () => {
      const newActiveIds = activeTypeIds.filter(id => id !== filingTypeId)
      const result = await updateOrgFilingTypeSelections(newActiveIds)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Deadline deactivated')
        router.refresh()
      }
    })
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

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Page header with toggle */}
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <h1>Deadlines</h1>
          <p className="text-muted-foreground mt-1">
            Manage filing and custom deadlines, and configure when clients are reminded
          </p>
        </div>
        <ToggleGroup
          options={[
            { value: 'active', label: 'Active Deadlines' },
            { value: 'inactive', label: 'Inactive Deadlines' },
          ]}
          value={statusFilter}
          onChange={setStatusFilter}
          variant="muted"
        />
      </div>

      {/* Search + Controls toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search deadlines..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 hover:border-foreground/20"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
              onClick={() => setSearchQuery('')}
            >
              <X className="size-4" />
            </Button>
          )}
        </div>

        {/* Controls */}
        <div className="flex gap-2 sm:ml-auto items-center">
          <Link href="/deadlines/new/edit?type=custom">
            <IconButtonWithText variant="green">
              <Plus className="h-5 w-5" />
              Create Deadline
            </IconButtonWithText>
          </Link>
          <IconButtonWithText
            type="button"
            variant={showFilters ? "amber" : "violet"}
            onClick={() => setShowFilters(v => !v)}
            title={showFilters ? "Close filters" : "Open filters"}
          >
            <SlidersHorizontal className="h-5 w-5" />
            {showFilters ? "Close Filters" : "Filter"}
          </IconButtonWithText>
          <div className="w-px h-6 bg-border mx-1" />
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">Sort by:</span>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="h-9 min-w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Default Order</SelectItem>
                <SelectItem value="name-asc">Name (A-Z)</SelectItem>
                <SelectItem value="name-desc">Name (Z-A)</SelectItem>
                <SelectItem value="type-asc">Client Type (A-Z)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Collapsible filter panel */}
      {showFilters && (
        <Card>
          <CardContent className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2 flex-1">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Applies to</span>
                <div className="flex flex-wrap gap-2">
                  {CLIENT_TYPE_OPTIONS.map(type => (
                    <ButtonWithText
                      key={type}
                      onClick={() => toggleTypeFilter(type)}
                      isSelected={typeFilters.has(type)}
                      variant="muted"
                    >
                      {type}
                    </ButtonWithText>
                  ))}
                </div>
              </div>
              {typeFilters.size > 0 && (
                <div className="space-y-2">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide invisible">Clear</span>
                  <IconButtonWithText
                    type="button"
                    variant="destructive"
                    onClick={clearAllFilters}
                    title="Clear all filters"
                  >
                    <X className="h-5 w-5" />
                    Clear all filters
                  </IconButtonWithText>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filing type cards */}
      <div className="grid gap-6 md:grid-cols-2">
        {filteredFilingTypes.map((ft) => {
          const schedule = scheduleMap[ft.id] ?? null
          const isActive = activeSet.has(ft.id)
          const href = schedule
            ? `/deadlines/${schedule.id}/edit`
            : `/deadlines/new/edit?filing_type_id=${ft.id}`

          return (
            <div key={ft.id} className="relative">
              <Link href={isActive ? href : '#'} className={!isActive ? 'pointer-events-none' : undefined}>
                <Card className={`h-full flex flex-col ${!isActive ? 'opacity-75' : ''}`}>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1 min-w-0">
                        <CardTitle className="truncate text-lg">{ft.name}</CardTitle>
                        {ft.description && (
                          <CardDescription>{ft.description}</CardDescription>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0 pointer-events-auto">
                        {isActive && (
                          <ButtonBase
                            variant="amber"
                            buttonType="icon-text"
                            disabled={isPending}
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              handleDeactivate(ft.id)
                            }}
                          >
                            <CircleMinus className="size-4" />
                            {isPending ? 'Saving...' : 'Deactivate'}
                          </ButtonBase>
                        )}
                        {!isActive && (
                          <ButtonBase
                            variant="green"
                            buttonType="icon-text"
                            disabled={isPending}
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              setActivatingFilingType(ft)
                            }}
                          >
                            <Plus className="size-4" />
                            Activate
                          </ButtonBase>
                        )}
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4 flex-1 flex flex-col">
                    {/* Client types & deadline rule */}
                    <div className="space-y-2 text-sm">
                      <div className="text-muted-foreground">
                        <span className="font-medium text-foreground">Applies to:</span>{' '}
                        {ft.applicable_client_types.join(', ')}
                      </div>
                      <div className="text-muted-foreground">
                        <span className="font-medium text-foreground">Deadline rule:</span>{' '}
                        {deadlineDescriptions[ft.id]}
                      </div>
                    </div>

                    <hr />

                    {/* Schedule section — only for active types */}
                    {isActive && schedule ? (
                      <div className="space-y-3 flex-1 flex flex-col">
                        <p className="text-base font-bold">
                          Reminder Steps:
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
                    ) : isActive ? (
                      <div className="text-center flex-1 flex items-center justify-center">
                        <p className="text-sm font-medium text-muted-foreground">No reminders configured</p>
                      </div>
                    ) : (
                      <div className="text-center flex-1 flex items-center justify-center">
                        <p className="text-sm text-muted-foreground">Activate this deadline to configure reminders</p>
                      </div>
                    )}
                  </CardContent>

                  {isActive && !schedule && (
                    <CardFooter>
                      <Button variant="outline" size="sm" className="active:scale-[0.97]" onClick={(e) => e.stopPropagation()}>
                        <Icon name="add" size="sm" className="mr-1.5" />
                        Configure Reminders
                      </Button>
                    </CardFooter>
                  )}
                </Card>
              </Link>
            </div>
          )
        })}

        {/* Custom schedule cards — only show when viewing active */}
        {statusFilter === 'active' && customSchedules
          .filter(s => {
            if (!searchQuery) return true
            const q = searchQuery.toLowerCase()
            return s.name.toLowerCase().includes(q) || s.description?.toLowerCase().includes(q)
          })
          .map((schedule) => (
          <Link key={schedule.id} href={`/deadlines/${schedule.id}/edit`}>
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

      {/* Empty state */}
      {filteredFilingTypes.length === 0 && (statusFilter !== 'active' || customSchedules.length === 0) && (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-sm">
            {statusFilter === 'inactive'
              ? 'All deadlines are currently active.'
              : searchQuery
                ? 'No deadlines match your search.'
                : 'No deadlines match your filters.'}
          </p>
        </div>
      )}

      {/* Activate deadline modal */}
      <ActivateDeadlineModal
        filingType={activatingFilingType}
        onClose={() => setActivatingFilingType(null)}
        onActivate={handleActivateWithExclusions}
      />
    </div>
  )
}

// Keep backwards-compatible export name
export { DeadlinesView as FilingTypeList }
