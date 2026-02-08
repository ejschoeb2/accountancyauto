import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { TemplateCard } from './components/template-card'
import type { EmailTemplate } from '@/lib/types/database'

export default async function TemplatesPage() {
  const supabase = await createClient()

  // Fetch templates
  const { data: templates } = await supabase
    .from('email_templates')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <h1 className="text-foreground">Templates</h1>
          <p className="text-muted-foreground mt-1">
            Manage your email templates
          </p>
        </div>

        <Link href="/templates/new">
          <Button className="active:scale-[0.97]">
            Create Template
          </Button>
        </Link>
      </div>

      {/* Template list */}
      {templates && templates.length > 0 ? (
        <div className="space-y-4">
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
            <Button className="mt-4">Create Template</Button>
          </Link>
        </div>
      )}
    </div>
  )
}
