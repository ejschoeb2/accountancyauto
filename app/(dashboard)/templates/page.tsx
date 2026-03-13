import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { IconButtonWithText } from '@/components/ui/icon-button-with-text'
import { Plus, AlertTriangle } from 'lucide-react'
import { TemplateCard } from './components/template-card'
import { getClientPortalEnabled } from '@/app/actions/settings'
import type { EmailTemplate } from '@/lib/types/database'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Email Templates',
  description: 'Create and manage email templates for client communications',
}

/**
 * Recursively checks whether a TipTap JSON body contains a portal_link placeholder.
 */
function templateHasPortalLink(bodyJson: any): boolean {
  if (!bodyJson || typeof bodyJson !== 'object') return false
  if (bodyJson.type === 'placeholder' && bodyJson.attrs?.id === 'portal_link') return true
  if (Array.isArray(bodyJson.content)) {
    return bodyJson.content.some((child: any) => templateHasPortalLink(child))
  }
  return false
}

export default async function TemplatesPage() {
  const supabase = await createClient()

  // Fetch templates and client portal setting in parallel
  const [{ data: templates }, { data: scheduleSteps }, { data: schedules }, portalEnabled] =
    await Promise.all([
      supabase.from('email_templates').select('*').order('created_at', { ascending: false }),
      supabase.from('schedule_steps').select('email_template_id, schedule_id'),
      supabase.from('schedules').select('id, name'),
      getClientPortalEnabled(),
    ])

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

  // Detect portal link issues per template
  const portalIssueMap = new Map<string, 'portal-disabled' | 'portal-missing'>()
  for (const template of (templates as EmailTemplate[]) || []) {
    const hasPortalLink = templateHasPortalLink(template.body_json)
    if (!portalEnabled && hasPortalLink) {
      portalIssueMap.set(template.id, 'portal-disabled')
    }
  }

  // Show a page-level banner if portal is disabled and any template uses portal_link
  const hasPortalConflicts = Array.from(portalIssueMap.values()).some(v => v === 'portal-disabled')

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

      {/* Portal conflict banner */}
      {hasPortalConflicts && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
          <AlertTriangle className="size-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-amber-600 dark:text-amber-400">
              Client portal is disabled but some templates contain portal links
            </p>
            <p className="text-muted-foreground mt-1">
              These templates will send emails with empty portal links. Edit the affected templates to remove the portal link placeholder, or{' '}
              <Link href="/settings" className="underline text-amber-600 dark:text-amber-400 hover:no-underline">
                re-enable the client portal
              </Link>.
            </p>
          </div>
        </div>
      )}

      {/* Template list */}
      {templates && templates.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2">
          {(templates as EmailTemplate[]).map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              usedInSchedules={templateUsageMap.get(template.id) || []}
              portalIssue={portalIssueMap.get(template.id)}
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
