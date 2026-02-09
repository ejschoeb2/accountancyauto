"use client"

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import type { EmailTemplate } from '@/lib/types/database'
import { formatDistanceToNow } from 'date-fns'

interface TemplateCardProps {
  template: EmailTemplate
}

export function TemplateCard({ template }: TemplateCardProps) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

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
    <Link href={`/templates/${template.id}/edit`}>
      <Card className="cursor-pointer">
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1 min-w-0">
              <CardTitle className="truncate">{template.name}</CardTitle>
              <CardDescription>{template.subject}</CardDescription>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <div className={`px-3 py-2 rounded-md inline-flex items-center ${
                template.is_active
                  ? 'bg-status-success/10'
                  : 'bg-status-neutral/10'
              }`}>
                <span className={`text-sm font-medium ${
                  template.is_active
                    ? 'text-status-success'
                    : 'text-status-neutral'
                }`}>
                  {template.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
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
        </CardHeader>

        <CardContent className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Updated {formatDistanceToNow(new Date(template.updated_at), { addSuffix: true })}
          </p>
        </CardContent>
      </Card>
    </Link>
  )
}
