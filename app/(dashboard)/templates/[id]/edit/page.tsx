'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { TemplateEditor } from '../../components/template-editor'
import { SubjectLineEditor } from '../../components/subject-line-editor'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { CheckCircle, Trash2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import type { TipTapDocument, EmailTemplate } from '@/lib/types/database'

export default function EditTemplatePage() {
  const router = useRouter()
  const params = useParams()
  const templateId = params.id as string

  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [subject, setSubject] = useState('')
  const [bodyJson, setBodyJson] = useState<TipTapDocument | null>(null)
  const [isActive, setIsActive] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Load existing template
  useEffect(() => {
    const loadTemplate = async () => {
      try {
        const response = await fetch(`/api/email-templates/${templateId}`)

        if (!response.ok) {
          if (response.status === 404) {
            toast.error('Template not found')
          } else {
            const error = await response.json()
            toast.error(error.error || 'Failed to load template')
          }
          router.push('/templates')
          return
        }

        const template: EmailTemplate = await response.json()
        setName(template.name)
        setSubject(template.subject)
        setBodyJson(template.body_json)
        setIsActive(template.is_active)
        setLoading(false)
      } catch (error) {
        toast.error('Failed to load template')
        router.push('/templates')
      }
    }

    loadTemplate()
  }, [templateId, router])

  const handleSave = async () => {
    // Validation
    if (!name.trim()) {
      toast.error('Template name is required')
      return
    }
    if (!subject.trim()) {
      toast.error('Subject line is required')
      return
    }
    if (!bodyJson) {
      toast.error('Email body is required')
      return
    }

    setSaving(true)
    try {
      const response = await fetch(`/api/email-templates/${templateId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          subject,
          body_json: bodyJson,
          is_active: isActive,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update template')
      }

      toast.success('Template updated!')
      router.push('/templates')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update template')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const response = await fetch(`/api/email-templates/${templateId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete template')
      }

      toast.success('Template deleted!')
      router.push('/templates')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete template')
      setDeleting(false)
      setShowDeleteDialog(false)
    }
  }

  const handleCancel = () => {
    router.push('/templates')
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-foreground">Loading...</h1>
      </div>
    )
  }

  return (
    <div className="space-y-10">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <h1 className="text-foreground">Edit Template</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowDeleteDialog(true)}
            className="h-10 w-10 rounded-lg bg-destructive/10 hover:bg-destructive/20 text-destructive hover:text-destructive transition-all duration-200 active:scale-[0.97]"
            title="Delete template"
          >
            <Trash2 className="h-5 w-5" />
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            size="icon"
            className="h-10 w-10 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 hover:text-blue-500 transition-all duration-200 active:scale-[0.97]"
            title={saving ? 'Saving...' : 'Save template'}
          >
            <CheckCircle className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Template Name */}
      <div className="space-y-2">
        <Label htmlFor="name">Template Name</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Monthly VAT Reminder"
          className="hover:border-foreground/20"
        />
      </div>

      {/* Active Checkbox */}
      <div className="flex items-center space-x-2">
        <Checkbox
          id="is_active"
          checked={isActive}
          onCheckedChange={(checked) => setIsActive(checked as boolean)}
        />
        <Label htmlFor="is_active" className="cursor-pointer">
          Active (available for use in schedules)
        </Label>
      </div>

      {/* Email Composer */}
      <div className="rounded-lg border overflow-hidden flex flex-col">
        <SubjectLineEditor value={subject} onChange={setSubject} />
        <div className="flex-1">
          <TemplateEditor initialContent={bodyJson} onUpdate={setBodyJson} />
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Template</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this template? This action cannot be undone.
              {' '}If this template is in use by any schedules, deletion will fail.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
