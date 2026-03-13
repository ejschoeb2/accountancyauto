"use client"

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ButtonBase } from '@/components/ui/button-base'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card'
import { Trash2, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import type { EmailTemplate } from '@/lib/types/database'
import { formatDistanceToNow } from 'date-fns'

interface TemplateCardProps {
  template: EmailTemplate
  usedInSchedules: string[]
  portalIssue?: 'portal-disabled' | 'portal-missing'
}

export function TemplateCard({ template, usedInSchedules, portalIssue }: TemplateCardProps) {
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
      <Card className="cursor-pointer h-full flex flex-col">
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1 min-w-0">
              <CardTitle className="truncate text-lg">{template.name}</CardTitle>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {portalIssue === 'portal-disabled' && (
                <div className="px-3 py-2 rounded-md inline-flex items-center gap-1.5 bg-amber-500/10">
                  <AlertTriangle className="size-3.5 text-amber-500" />
                  <span className="text-sm font-medium text-amber-600 dark:text-amber-400">Portal link</span>
                </div>
              )}
              {template.is_custom && (
                <div className="px-3 py-2 rounded-md inline-flex items-center bg-violet-500/10">
                  <span className="text-sm font-medium text-violet-500">Custom</span>
                </div>
              )}
              <div className={`px-3 py-2 rounded-md inline-flex items-center ${
                template.is_active
                  ? 'bg-green-500/10'
                  : 'bg-status-neutral/10'
              }`}>
                <span className={`text-sm font-medium ${
                  template.is_active
                    ? 'text-green-600'
                    : 'text-status-neutral'
                }`}>
                  {template.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
              <ButtonBase
                variant="destructive"
                buttonType="icon-only"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  handleDelete(e)
                }}
                disabled={deleting}
              >
                <Trash2 className="h-5 w-5" />
              </ButtonBase>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 flex-1 flex flex-col">
          {/* Subject and Used in section */}
          <div className="space-y-2 text-sm">
            <div className="text-muted-foreground">
              <span className="font-medium text-foreground">Subject:</span>{' '}
              {template.subject}
            </div>
            {usedInSchedules.length > 0 && (
              <div className="text-muted-foreground">
                <span className="font-medium text-foreground">Used in:</span>{' '}
                {usedInSchedules.join(', ')}
              </div>
            )}
          </div>

          {/* Portal issue warning */}
          {portalIssue === 'portal-disabled' && (
            <div className="mt-auto pt-3 border-t">
              <p className="text-xs text-amber-600 dark:text-amber-400">
                This template contains a portal link placeholder but the client portal is disabled.
                The link will be empty in sent emails. Edit this template to remove it.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  )
}
