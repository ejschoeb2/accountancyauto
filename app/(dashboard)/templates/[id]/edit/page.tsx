'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { TemplateEditor } from '../../components/template-editor'
import { SubjectLineEditor } from '../../components/subject-line-editor'
import { PlaceholderDropdown } from '../../components/placeholder-dropdown'
import { EditorToolbar } from '../../components/template-editor-toolbar'
import { Button } from '@/components/ui/button'
import { IconButtonWithText } from '@/components/ui/icon-button-with-text'
import { LoadingScreen } from '@/components/loading-screen'
import {
  Card,
  CardContent,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CheckButton } from '@/components/ui/check-button'
import { CheckCircle, Pencil, Trash2, X } from 'lucide-react'
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
  const [editor, setEditor] = useState<any>(null)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false)

  // Refs for unified placeholder insertion
  const subjectInputRef = useRef<HTMLInputElement>(null)
  const editorRef = useRef<{ insertPlaceholder: (id: string, label: string) => void; getEditor: () => any } | null>(null)

  // Store original values for change tracking
  const [originalValues, setOriginalValues] = useState<{
    name: string
    subject: string
    bodyJson: TipTapDocument | null
    isActive: boolean
  } | null>(null)

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
        setOriginalValues({
          name: template.name,
          subject: template.subject,
          bodyJson: template.body_json,
          isActive: template.is_active,
        })
        setLoading(false)
      } catch (error) {
        toast.error('Failed to load template')
        router.push('/templates')
      }
    }

    loadTemplate()
  }, [templateId, router])

  // Update editor state when ref changes
  useEffect(() => {
    const interval = setInterval(() => {
      if (editorRef.current) {
        const ed = editorRef.current.getEditor()
        if (ed && ed !== editor) {
          setEditor(ed)
        }
      }
    }, 100)

    return () => clearInterval(interval)
  }, [editor])

  // Track unsaved changes
  useEffect(() => {
    if (!originalValues) return

    const hasChanges =
      name !== originalValues.name ||
      subject !== originalValues.subject ||
      isActive !== originalValues.isActive ||
      JSON.stringify(bodyJson) !== JSON.stringify(originalValues.bodyJson)

    setHasUnsavedChanges(hasChanges)
  }, [name, subject, bodyJson, isActive, originalValues])

  // Warn on browser close/refresh with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault()
        e.returnValue = ''
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [hasUnsavedChanges])

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
      setHasUnsavedChanges(false)
      setShowUnsavedDialog(false)
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
    if (hasUnsavedChanges) {
      setShowUnsavedDialog(true)
    } else {
      router.push('/templates')
    }
  }

  const confirmCancel = () => {
    setHasUnsavedChanges(false)
    router.push('/templates')
  }

  if (loading) {
    return <LoadingScreen />
  }

  return (
    <div className="space-y-10 max-w-7xl mx-auto">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <h1 className="text-foreground">Edit Template</h1>
        <div className="flex items-center gap-2">
          <IconButtonWithText
            variant="destructive"
            onClick={() => setShowDeleteDialog(true)}
            title="Delete template"
          >
            <Trash2 className="h-5 w-5" />
            Delete
          </IconButtonWithText>
          <div className="h-8 w-px bg-border" />
          <IconButtonWithText
            variant="amber"
            onClick={handleCancel}
            title="Cancel"
          >
            <X className="h-5 w-5" />
            Cancel
          </IconButtonWithText>
          <IconButtonWithText
            variant="blue"
            onClick={handleSave}
            disabled={saving}
            title={saving ? 'Saving...' : 'Save template'}
          >
            <CheckCircle className="h-5 w-5" />
            {saving ? 'Saving...' : 'Save'}
          </IconButtonWithText>
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
        <CheckButton
          checked={isActive}
          onCheckedChange={(checked) => setIsActive(checked as boolean)}
          aria-label="Active template"
        />
        <Label className="cursor-pointer" onClick={() => setIsActive(!isActive)}>
          Active (available for use in schedules)
        </Label>
      </div>

      {/* Toolbar with Insert Variable button on left */}
      <div className="flex items-center gap-2 flex-wrap">
        <PlaceholderDropdown
          subjectInputRef={subjectInputRef}
          onEditorInsert={(id, label) => {
            editorRef.current?.insertPlaceholder(id, label)
          }}
        />
        <div className="w-px h-6 bg-border" />
        <EditorToolbar editor={editor} />
      </div>

      {/* Email Composer */}
      <Card className="overflow-hidden flex flex-col p-0">
        {/* Subject Line */}
        <SubjectLineEditor
          ref={subjectInputRef}
          value={subject}
          onChange={setSubject}
        />

        {/* Email Body */}
        <div className="flex-1">
          <TemplateEditor
            ref={editorRef}
            initialContent={bodyJson}
            onUpdate={setBodyJson}
          />
        </div>
      </Card>

      {/* Unsaved Changes Dialog */}
      <Dialog open={showUnsavedDialog} onOpenChange={() => {}}>
        <DialogContent className="[&>button]:hidden">
          <DialogHeader>
            <DialogTitle>Unsaved Changes</DialogTitle>
            <DialogDescription>
              You have unsaved changes. Are you sure you want to leave without saving?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <IconButtonWithText
              variant="violet"
              onClick={() => setShowUnsavedDialog(false)}
            >
              <Pencil className="h-5 w-5" />
              Keep Editing
            </IconButtonWithText>
            <IconButtonWithText
              variant="destructive"
              onClick={confirmCancel}
            >
              <X className="h-5 w-5" />
              Discard Changes
            </IconButtonWithText>
            <IconButtonWithText
              variant="blue"
              onClick={handleSave}
              disabled={saving}
            >
              <CheckCircle className="h-5 w-5" />
              {saving ? 'Saving...' : 'Save Changes'}
            </IconButtonWithText>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
