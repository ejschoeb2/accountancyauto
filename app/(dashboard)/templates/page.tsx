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
            Create Template
          </IconButtonWithText>
        </Link>
      </div>

      {/* Template list */}
      {templates && templates.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2">
          {(templates as EmailTemplate[]).map((template) => (
            <TemplateCard key={template.id} template={template} />
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
              Create Template
            </IconButtonWithText>
          </Link>
        </div>
      )}
    </div>
  )
}
