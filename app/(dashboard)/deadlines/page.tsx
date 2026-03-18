import { createClient } from '@/lib/supabase/server'
import { DeadlinesView, type ScheduleWithSteps, type StepDisplay, type CustomScheduleDisplay } from './components/filing-type-list'
import { DEADLINE_DESCRIPTIONS } from '@/lib/deadlines/descriptions'
import type { EmailTemplate, FilingType, Schedule, ScheduleStep } from '@/lib/types/database'
import { getOrgFilingTypeSelections, getAllFilingTypes } from '@/app/actions/deadlines'

export default async function SchedulesPage() {
  const supabase = await createClient()

  // Fetch org filing type selections + all filing types in parallel
  const [orgSelections, allFilingTypes] = await Promise.all([
    getOrgFilingTypeSelections(),
    getAllFilingTypes(),
  ])

  // Build a set of active type IDs for this org
  const activeTypeIds = orgSelections.length > 0
    ? orgSelections.filter(s => s.is_active).map(s => s.filing_type_id)
    : allFilingTypes.filter(ft => ft.is_seeded_default).map(ft => ft.id)

  // Fetch schedules
  const { data: schedules } = await supabase
    .from('schedules')
    .select('*')

  // Fetch all schedule steps ordered by step_number
  const { data: steps } = await supabase
    .from('schedule_steps')
    .select('*')
    .order('step_number')

  // Fetch email templates (for name lookup)
  const { data: templates } = await supabase
    .from('email_templates')
    .select('*')
    .order('created_at', { ascending: false })

  // Build template name lookup
  const templateNameMap = new Map(
    (templates as EmailTemplate[] | null)?.map(t => [t.id, t.name]) ?? []
  )

  // Group steps by schedule_id and annotate with template name
  const stepsBySchedule = (steps as ScheduleStep[] | null)?.reduce<Record<string, StepDisplay[]>>(
    (acc, step) => {
      if (!acc[step.schedule_id]) acc[step.schedule_id] = []
      acc[step.schedule_id].push({
        step_number: step.step_number,
        template_id: step.email_template_id,
        template_name: templateNameMap.get(step.email_template_id) ?? 'Unknown template',
        delay_days: step.delay_days,
      })
      return acc
    },
    {}
  ) ?? {}

  // Separate filing and custom schedules
  const allSchedules = (schedules as Schedule[] | null) ?? []
  const filingSchedules = allSchedules.filter(s => s.schedule_type !== 'custom')
  const customSchedules = allSchedules.filter(s => s.schedule_type === 'custom')

  // Build scheduleMap for ALL filing types
  const scheduleMap: Record<string, ScheduleWithSteps | null> = {}
  for (const ft of allFilingTypes) {
    scheduleMap[ft.id] = null
  }
  for (const s of filingSchedules) {
    if (s.filing_type_id) {
      scheduleMap[s.filing_type_id] = {
        id: s.id,
        name: s.name,
        description: s.description,
        is_active: s.is_active,
        steps: stepsBySchedule[s.id] ?? [],
      }
    }
  }

  // Build custom schedule display data
  const customScheduleDisplays: CustomScheduleDisplay[] = customSchedules.map(s => ({
    id: s.id,
    name: s.name,
    description: s.description,
    is_active: s.is_active,
    custom_date: s.custom_date,
    recurrence_rule: s.recurrence_rule,
    recurrence_anchor: s.recurrence_anchor,
    steps: stepsBySchedule[s.id] ?? [],
  }))

  // Fetch client counts by client_type for the "applies to" display
  const { data: clients } = await supabase
    .from('clients')
    .select('client_type')

  const clientCountByType: Record<string, number> = {}
  for (const c of (clients ?? [])) {
    if (c.client_type) {
      clientCountByType[c.client_type] = (clientCountByType[c.client_type] ?? 0) + 1
    }
  }

  // Build a map of filing_type_id → number of matching clients
  const clientCountsByFilingType: Record<string, number> = {}
  for (const ft of allFilingTypes) {
    clientCountsByFilingType[ft.id] = ft.applicable_client_types.reduce(
      (sum, ct) => sum + (clientCountByType[ct] ?? 0),
      0
    )
  }

  return (
    <DeadlinesView
      allFilingTypes={allFilingTypes as FilingType[]}
      activeTypeIds={activeTypeIds}
      scheduleMap={scheduleMap}
      deadlineDescriptions={DEADLINE_DESCRIPTIONS}
      customSchedules={customScheduleDisplays}
      clientCountsByFilingType={clientCountsByFilingType}
    />
  )
}
