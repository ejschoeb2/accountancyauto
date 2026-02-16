'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { TemplateEditor } from '../components/template-editor'
import { SubjectLineEditor } from '../components/subject-line-editor'
import { PlaceholderDropdown } from '../components/placeholder-dropdown'
import { EditorToolbar } from '../components/template-editor-toolbar'
import { IconButtonWithText } from '@/components/ui/icon-button-with-text'
import {
  Card,
  CardContent,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CheckButton } from '@/components/ui/check-button'
import { CheckCircle, X } from 'lucide-react'
import { toast } from 'sonner'
import type { TipTapDocument } from '@/lib/types/database'

export default function NewTemplatePage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [subject, setSubject] = useState('')
  const [bodyJson, setBodyJson] = useState<TipTapDocument | null>(null)
  const [isActive, setIsActive] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editor, setEditor] = useState<any>(null)

  // Refs for unified placeholder insertion
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
      const response = await fetch('/api/email-templates', {
        method: 'POST',
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
        throw new Error(error.error || 'Failed to create template')
      }

      toast.success('Template created!')
      router.push('/templates')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create template')
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    router.push('/templates')
  }

  return (
    <div className="space-y-10 max-w-7xl mx-auto">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <h1 className="text-foreground">Create Email Template</h1>
        <div className="flex items-center gap-2">
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
            title={saving ? 'Saving...' : 'Create template'}
          >
            <CheckCircle className="h-5 w-5" />
            {saving ? 'Saving...' : 'Create'}
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
    </div>
  )
}
