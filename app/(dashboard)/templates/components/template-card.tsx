import { Badge } from '@/components/ui/badge'
import type { EmailTemplate } from '@/lib/types/database'
import { formatDistanceToNow } from 'date-fns'

interface TemplateCardProps {
  template: EmailTemplate
}

export function TemplateCard({ template }: TemplateCardProps) {
  // Truncate subject for preview
  const subjectPreview =
    template.subject.length > 80
      ? template.subject.slice(0, 80) + '...'
      : template.subject

  return (
    <div className="rounded-lg border bg-card p-6 hover:shadow-md hover:border-accent/30 transition-all duration-200">
      <div className="space-y-3">
        {/* Header with name and active badge */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-lg truncate">{template.name}</h3>
          <Badge variant={template.is_active ? 'default' : 'secondary'}>
            {template.is_active ? 'Active' : 'Inactive'}
          </Badge>
        </div>

        {/* Subject preview */}
        <p className="text-sm text-muted-foreground truncate">
          {subjectPreview}
        </p>

        {/* Updated timestamp */}
        <p className="text-xs text-muted-foreground">
          Updated {formatDistanceToNow(new Date(template.updated_at), { addSuffix: true })}
        </p>
      </div>
    </div>
  )
}
