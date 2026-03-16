"use client"

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { TemplateEditor } from './template-editor'
import { SubjectLineEditor } from './subject-line-editor'
import { PlaceholderDropdown } from './placeholder-dropdown'
import { EditorToolbar } from './template-editor-toolbar'
import { Button } from '@/components/ui/button'
import { IconButtonWithText } from '@/components/ui/icon-button-with-text'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CheckButton } from '@/components/ui/check-button'
import { CheckCircle, X, Link, AlertCircle, Trash2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import type { TipTapDocument, EmailTemplate } from '@/lib/types/database'

interface TemplateEditorModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Null = create mode, string = edit mode */
  templateId: string | null
}

export function TemplateEditorModal({ open, onOpenChange, templateId }: TemplateEditorModalProps) {
  const router = useRouter()
  const isEditMode = !!templateId

  const [loading, setLoading] = useState(false)
  const [name, setName] = useState('')
  const [subject, setSubject] = useState('')
  const [bodyJson, setBodyJson] = useState<TipTapDocument | null>(null)
  const [isActive, setIsActive] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editor, setEditor] = useState<any>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const subjectInputRef = useRef<HTMLInputElement>(null)
  const editorRef = useRef<{ insertPlaceholder: (id: string, label: string) => void; getEditor: () => any } | null>(null)

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

  // Load template when opening in edit mode
  useEffect(() => {
    if (!open) {
      // Reset state when closing
      setName('')
      setSubject('')
      setBodyJson(null)
      setIsActive(true)
      setLoading(false)
      setEditor(null)
      return
    }

    if (!templateId) return // Create mode — start fresh

    setLoading(true)
    const loadTemplate = async () => {
      try {
        const response = await fetch(`/api/email-templates/${templateId}`)
        if (!response.ok) {
          toast.error('Failed to load template')
          onOpenChange(false)
          return
        }
        const template: EmailTemplate = await response.json()
        setName(template.name)
        setSubject(template.subject)
        setBodyJson(template.body_json)
        setIsActive(template.is_active)
      } catch {
        toast.error('Failed to load template')
        onOpenChange(false)
      } finally {
        setLoading(false)
      }
    }

    loadTemplate()
  }, [open, templateId, onOpenChange])

  const handleSave = async () => {
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
      const url = isEditMode ? `/api/email-templates/${templateId}` : '/api/email-templates'
      const method = isEditMode ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, subject, body_json: bodyJson, is_active: isActive }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || `Failed to ${isEditMode ? 'update' : 'create'} template`)
      }

      toast.success(isEditMode ? 'Template updated!' : 'Template created!')
      onOpenChange(false)
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save template')
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
      setShowDeleteDialog(false)
      onOpenChange(false)
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete template')
      setDeleting(false)
      setShowDeleteDialog(false)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-y-auto" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{isEditMode ? 'Edit Template' : 'Create Template'}</DialogTitle>
          </DialogHeader>

          {loading ? (
            <div className="py-12 text-center text-muted-foreground">Loading template...</div>
          ) : (
            <div className="space-y-4">
              {/* Template Name */}
              <div className="space-y-2">
                <Label htmlFor="modal-name">Template Name</Label>
                <Input
                  id="modal-name"
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

              {/* Toolbar */}
              <div className="flex items-center gap-2 flex-wrap">
                <PlaceholderDropdown
                  subjectInputRef={subjectInputRef}
                  onEditorInsert={(id, label) => {
                    editorRef.current?.insertPlaceholder(id, label)
                  }}
                />
                <Button
                  variant="ghost"
                  type="button"
                  className="px-4 py-2 h-10 rounded-lg bg-violet-500/10 hover:bg-violet-500/20 text-violet-500 hover:text-violet-500 transition-all duration-200 active:scale-[0.97] flex items-center gap-2 text-sm font-medium"
                  title="Insert portal link placeholder"
                  onClick={() => {
                    editorRef.current?.insertPlaceholder('portal_link', 'Portal Link')
                  }}
                >
                  <Link className="h-5 w-5" />
                  Insert Portal Link
                </Button>
                <div className="w-px h-6 bg-border" />
                <EditorToolbar editor={editor} />
              </div>

              {/* Portal link info */}
              <div className="flex items-center gap-3 p-4 bg-amber-500/10 rounded-xl">
                <AlertCircle className="size-5 text-amber-500 shrink-0" />
                <p className="text-sm text-amber-500">
                  The portal link placeholder will only generate a working link when this template is used in a deadline linked to a filing type, or sent via bulk email with a filing context selected.
                </p>
              </div>

              {/* Email Composer */}
              <Card className="overflow-hidden flex flex-col p-0">
                <SubjectLineEditor
                  ref={subjectInputRef}
                  value={subject}
                  onChange={setSubject}
                />
                <div className="flex-1 min-h-[300px]">
                  <TemplateEditor
                    ref={editorRef}
                    initialContent={bodyJson}
                    onUpdate={setBodyJson}
                  />
                </div>
              </Card>

              {/* Action buttons */}
              <div className="flex items-center justify-between pt-2">
                <div>
                  {isEditMode && (
                    <IconButtonWithText
                      variant="destructive"
                      onClick={() => setShowDeleteDialog(true)}
                      title="Delete template"
                    >
                      <Trash2 className="h-5 w-5" />
                      Delete
                    </IconButtonWithText>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <IconButtonWithText
                    variant="amber"
                    onClick={() => onOpenChange(false)}
                    disabled={saving}
                  >
                    <X className="h-5 w-5" />
                    Cancel
                  </IconButtonWithText>
                  <IconButtonWithText
                    variant="blue"
                    onClick={handleSave}
                    disabled={saving}
                  >
                    <CheckCircle className="h-5 w-5" />
                    {saving ? 'Saving...' : isEditMode ? 'Save' : 'Create'}
                  </IconButtonWithText>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Template</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this template? This action cannot be undone.
              If this template is in use by any schedules, deletion will fail.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
