"use client"

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import type { EmailTemplate } from '@/lib/types/database'
import { formatDistanceToNow } from 'date-fns'

const STATUS_BADGE_CLASS: Record<boolean, string> = {
  true: 'bg-status-success text-white hover:bg-status-success font-sans',
  false: 'bg-status-neutral/20 text-status-neutral hover:bg-status-neutral/20 font-sans',
}

interface TemplateCardProps {
  template: EmailTemplate
}

export function TemplateCard({ template }: TemplateCardProps) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete "${template.name}"?\n\nThis action cannot be undone.`)) {
      return
    }

    setDeleting(true)
    try {
      const response = await fetch(`/api/email-templates/${template.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete template')
      }

      toast.success(`Deleted "${template.name}"`)
      router.refresh()
    } catch (error) {
      console.error('Error deleting template:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to delete template')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="group rounded-lg border bg-card p-6 hover:shadow-md hover:border-accent/30 transition-all duration-200">
      <div className="flex items-center justify-between gap-4">
        {/* Left: name + subject */}
        <div className="flex items-center gap-4 min-w-0">
          <h3 className="font-semibold text-lg whitespace-nowrap">{template.name}</h3>
          <Badge className={STATUS_BADGE_CLASS[template.is_active ? 'true' : 'false']}>
            {template.is_active ? 'Active' : 'Inactive'}
          </Badge>
          <p className="text-sm text-muted-foreground truncate">
            {template.subject}
          </p>
        </div>

        {/* Right: timestamp + action buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <p className="text-xs text-muted-foreground whitespace-nowrap">
            Updated {formatDistanceToNow(new Date(template.updated_at), { addSuffix: true })}
          </p>
          <Link href={`/templates/${template.id}/edit`}>
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 hover:text-blue-500 transition-all duration-200 active:scale-[0.97]"
            >
              <Pencil className="h-5 w-5" />
            </Button>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleDelete}
            disabled={deleting}
            className="h-10 w-10 rounded-lg bg-destructive/10 hover:bg-destructive/20 text-destructive hover:text-destructive transition-all duration-200 active:scale-[0.97]"
          >
            <Trash2 className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  )
}
