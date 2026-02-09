import { createClient } from '@/lib/supabase/server'
import { FilingTypeList, type ScheduleWithSteps, type StepDisplay } from './components/filing-type-list'
import { DEADLINE_DESCRIPTIONS } from '@/lib/deadlines/descriptions'
import type { EmailTemplate, FilingType, Schedule, ScheduleStep } from '@/lib/types/database'

export default async function SchedulesPage() {
  const supabase = await createClient()

  // Fetch filing types
  const { data: filingTypes } = await supabase
    .from('filing_types')
    .select('*')
    .order('name')

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
        template_name: templateNameMap.get(step.email_template_id) ?? 'Unknown template',
        delay_days: step.delay_days,
      })
      return acc
    },
    {}
  ) ?? {}

  // Build scheduleMap: filing_type_id -> ScheduleWithSteps | null
  const scheduleMap: Record<string, ScheduleWithSteps | null> = {}
  for (const ft of (filingTypes as FilingType[] | null) ?? []) {
    scheduleMap[ft.id] = null
  }
  for (const s of (schedules as Schedule[] | null) ?? []) {
    scheduleMap[s.filing_type_id] = {
      id: s.id,
      name: s.name,
      description: s.description,
      is_active: s.is_active,
      steps: stepsBySchedule[s.id] ?? [],
    }
  }

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="space-y-1">
        <h1>Schedules</h1>
        <p className="text-muted-foreground mt-1">
          Manage reminder schedules for each filing type
        </p>
      </div>

      <FilingTypeList
        filingTypes={(filingTypes as FilingType[]) ?? []}
        scheduleMap={scheduleMap}
        deadlineDescriptions={DEADLINE_DESCRIPTIONS}
      />
    </div>
  )
}
