import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { IconButtonWithText } from '@/components/ui/icon-button-with-text'
import { Plus } from 'lucide-react'
import { TemplateCard } from './components/template-card'
import type { EmailTemplate } from '@/lib/types/database'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Email Templates',
  description: 'Create and manage email templates for client communications',
}

export default async function TemplatesPage() {
  const supabase = await createClient()

  // Fetch templates
  const { data: templates } = await supabase
    .from('email_templates')
    .select('*')
    .order('created_at', { ascending: false })

  // Fetch schedule steps to determine template usage
  const { data: scheduleSteps } = await supabase
    .from('schedule_steps')
    .select('email_template_id, schedule_id')

  // Fetch schedules for names
  const { data: schedules } = await supabase
    .from('schedules')
    .select('id, name')

  // Build map of template_id -> schedule names
  const templateUsageMap = new Map<string, string[]>()
  const scheduleNameMap = new Map(
    (schedules || []).map(s => [s.id, s.name])
  )

  for (const step of scheduleSteps || []) {
    const scheduleName = scheduleNameMap.get(step.schedule_id)
    if (scheduleName) {
      const existing = templateUsageMap.get(step.email_template_id) || []
      if (!existing.includes(scheduleName)) {
        existing.push(scheduleName)
        templateUsageMap.set(step.email_template_id, existing)
      }
    }
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <h1>Email Templates</h1>
          <p className="text-muted-foreground mt-1">
            Create and manage reusable templates for client communications.
          </p>
        </div>

        <Link href="/templates/new">
          <IconButtonWithText variant="violet">
            <Plus className="h-5 w-5" />
            Create Email Template
          </IconButtonWithText>
        </Link>
      </div>

      {/* Template list */}
      {templates && templates.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2">
          {(templates as EmailTemplate[]).map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              usedInSchedules={templateUsageMap.get(template.id) || []}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <h3 className="text-lg font-medium">No templates yet</h3>
          <p className="text-sm text-muted-foreground mt-2">
            Create your first email template to get started.
          </p>
          <Link href="/templates/new">
            <IconButtonWithText variant="violet" className="mt-4">
              <Plus className="h-5 w-5" />
              Create Email Template
            </IconButtonWithText>
          </Link>
        </div>
      )}
    </div>
  )
}
