'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { TemplateEditor } from '../../templates/components/template-editor'
import { SubjectLineEditor } from '../../templates/components/subject-line-editor'
import { PlaceholderDropdown } from '../../templates/components/placeholder-dropdown'
import { Button } from '@/components/ui/button'
import { IconButtonWithText } from '@/components/ui/icon-button-with-text'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CheckButton } from '@/components/ui/check-button'
import { CheckCircle, X } from 'lucide-react'
import { toast } from 'sonner'
import type { TipTapDocument, EmailTemplate } from '@/lib/types/database'

interface InlineTemplateEditorProps {
  templateId: string
  onCancel: () => void
  onSave: () => void
}

export function InlineTemplateEditor({ templateId, onCancel, onSave }: InlineTemplateEditorProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [subject, setSubject] = useState('')
  const [bodyJson, setBodyJson] = useState<TipTapDocument | null>(null)
  const [isActive, setIsActive] = useState(true)
  const [saving, setSaving] = useState(false)

  // Refs for unified placeholder insertion
  const subjectInputRef = useRef<HTMLInputElement>(null)
  const editorRef = useRef<{ insertPlaceholder: (id: string, label: string) => void } | null>(null)

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
          onCancel()
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
        onCancel()
      }
    }

    loadTemplate()
  }, [templateId, onCancel])

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
      onSave()
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update template')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        Loading template...
      </div>
    )
  }

  return (
    <div className="space-y-4 p-6 bg-muted/30 rounded-lg border">
      {/* Action buttons */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Edit Template</h3>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={saving}
            size="sm"
          >
            <X className="h-4 w-4 mr-1.5" />
            Cancel
          </Button>
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

      {/* Email Composer */}
      <Card className="overflow-hidden flex flex-col p-0">
        <SubjectLineEditor
          ref={subjectInputRef}
          value={subject}
          onChange={setSubject}
          placeholderButtonSlot={
            <PlaceholderDropdown
              subjectInputRef={subjectInputRef}
              onEditorInsert={(id, label) => {
                editorRef.current?.insertPlaceholder(id, label)
              }}
            />
          }
        />
        <div className="flex-1">
          <TemplateEditor
            ref={editorRef}
            initialContent={bodyJson}
            onUpdate={setBodyJson}
          />
        </div>
      </Card>
    </div>
  )
}
