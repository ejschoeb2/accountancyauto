import { createClient } from '@/lib/supabase/server'
import { TemplatesView } from './components/templates-view'
import { getClientPortalEnabled, markTemplatesVisited } from '@/app/actions/settings'
import type { EmailTemplate, TipTapNode } from '@/lib/types/database'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Email Templates',
  description: 'Create and manage email templates for client communications',
}

/**
 * Recursively checks whether a TipTap JSON body contains a portal_link placeholder.
 */
function templateHasPortalLink(bodyJson: TipTapNode | unknown): boolean {
  if (!bodyJson || typeof bodyJson !== 'object') return false
  const node = bodyJson as TipTapNode
  if (node.type === 'placeholder' && (node.attrs as Record<string, unknown>)?.id === 'portal_link') return true
  if (Array.isArray(node.content)) {
    return node.content.some((child) => templateHasPortalLink(child))
  }
  return false
}

export default async function TemplatesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Mark templates as visited for onboarding tracking (fire-and-forget)
  markTemplatesVisited().catch(() => {});

  const [{ data: templates }, { data: scheduleSteps }, { data: schedules }, portalEnabled] =
    await Promise.all([
      supabase
        .from('email_templates')
        .select('*')
        .eq('owner_id', user!.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('schedule_steps')
        .select('email_template_id, schedule_id')
        .eq('owner_id', user!.id),
      supabase.from('schedules').select('id, name').eq('owner_id', user!.id),
      getClientPortalEnabled(),
    ])

  // Build map of template_id -> schedule names
  const templateUsageMap: Record<string, string[]> = {}
  const scheduleNameMap = new Map(
    (schedules || []).map(s => [s.id, s.name])
  )

  for (const step of scheduleSteps || []) {
    const scheduleName = scheduleNameMap.get(step.schedule_id)
    if (scheduleName) {
      const existing = templateUsageMap[step.email_template_id] || []
      if (!existing.includes(scheduleName)) {
        existing.push(scheduleName)
        templateUsageMap[step.email_template_id] = existing
      }
    }
  }

  // Detect portal link issues per template
  const portalIssueMap: Record<string, 'portal-disabled' | 'portal-missing'> = {}
  for (const template of (templates as EmailTemplate[]) || []) {
    const hasPortalLink = templateHasPortalLink(template.body_json)
    if (!portalEnabled && hasPortalLink) {
      portalIssueMap[template.id] = 'portal-disabled'
    }
  }

  const hasPortalConflicts = Object.values(portalIssueMap).some(v => v === 'portal-disabled')

  return (
    <TemplatesView
      templates={(templates as EmailTemplate[]) || []}
      templateUsageMap={templateUsageMap}
      portalIssueMap={portalIssueMap}
      hasPortalConflicts={hasPortalConflicts}
    />
  )
}
