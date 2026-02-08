import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { TemplateCard } from './components/template-card'
import { ScheduleList } from './components/schedule-list'
import type { EmailTemplate, Schedule } from '@/lib/types/database'
import { cn } from '@/lib/utils'

export default async function TemplatesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const params = await searchParams
  const currentTab = params.tab === 'schedules' ? 'schedules' : 'templates'

  const supabase = await createClient()

  // Fetch templates
  const { data: templates } = await supabase
    .from('email_templates')
    .select('*')
    .order('created_at', { ascending: false })

  // Fetch schedules with related data
  const { data: schedules } = await supabase
    .from('schedules')
    .select('*')
    .order('created_at', { ascending: false })

  // Fetch step counts
  const { data: steps } = await supabase
    .from('schedule_steps')
    .select('schedule_id')

  const stepCounts = steps?.reduce((acc: Record<string, number>, step) => {
    acc[step.schedule_id] = (acc[step.schedule_id] || 0) + 1
    return acc
  }, {}) || {}

  // Fetch filing types for name lookup
  const { data: filingTypes } = await supabase
    .from('filing_types')
    .select('id, name')

  const filingTypeMap = new Map(filingTypes?.map(ft => [ft.id, ft.name]) || [])

  // Attach metadata to schedules
  const schedulesWithMeta = schedules?.map(schedule => ({
    ...schedule,
    step_count: stepCounts[schedule.id] || 0,
    filing_type_name: filingTypeMap.get(schedule.filing_type_id) || schedule.filing_type_id,
  }))

  return (
    <div className="space-y-8">
      {/* Page header with sub-tabs */}
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <h1 className="text-foreground">
              {currentTab === 'templates' ? 'Email Templates' : 'Reminder Schedules'}
            </h1>
            <p className="text-muted-foreground mt-1">
              {currentTab === 'templates'
                ? 'Create and manage your email templates'
                : 'Configure reminder schedules for filing deadlines'}
            </p>
          </div>
          <Link href={currentTab === 'templates' ? '/templates/new' : '/schedules/new/edit'}>
            <Button className="active:scale-[0.97]">
              {currentTab === 'templates' ? 'Create Template' : 'Create Schedule'}
            </Button>
          </Link>
        </div>

        {/* Sub-tab navigation */}
        <div className="flex gap-6 border-b">
          <Link
            href="/templates"
            className={cn(
              'pb-3 px-1 text-base font-medium transition-colors relative',
              currentTab === 'templates'
                ? 'text-foreground after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-primary'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Templates
          </Link>
          <Link
            href="/templates?tab=schedules"
            className={cn(
              'pb-3 px-1 text-base font-medium transition-colors relative',
              currentTab === 'schedules'
                ? 'text-foreground after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-primary'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Schedules
          </Link>
        </div>
      </div>

      {/* Tab content */}
      {currentTab === 'templates' ? (
        // Templates tab
        templates && templates.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {(templates as EmailTemplate[]).map((template) => (
              <Link
                key={template.id}
                href={`/templates/${template.id}/edit`}
                className="block"
              >
                <TemplateCard template={template} />
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed p-12 text-center">
            <h3 className="text-lg font-medium">No templates yet</h3>
            <p className="text-sm text-muted-foreground mt-2">
              Create your first email template to get started.
            </p>
            <Link href="/templates/new">
              <Button className="mt-4">Create Template</Button>
            </Link>
          </div>
        )
      ) : (
        // Schedules tab
        <ScheduleList schedules={schedulesWithMeta || []} />
      )}
    </div>
  )
}
