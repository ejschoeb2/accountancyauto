'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { TemplateEditor } from '../components/template-editor'
import { SubjectLineEditor } from '../components/subject-line-editor'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CheckButton } from '@/components/ui/check-button'
import { toast } from 'sonner'
import type { TipTapDocument } from '@/lib/types/database'

export default function NewTemplatePage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [subject, setSubject] = useState('')
  const [bodyJson, setBodyJson] = useState<TipTapDocument | null>(null)
  const [isActive, setIsActive] = useState(true)
  const [saving, setSaving] = useState(false)

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
    <div className="space-y-10">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <h1 className="text-foreground">Create Template</h1>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="active:scale-[0.97]"
          >
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>

      {/* Template Details */}
      <div className="rounded-lg border p-8 space-y-6">
        <h2 className="text-lg font-semibold">Template Details</h2>

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
      </div>

      {/* Subject Line */}
      <div className="rounded-lg border p-8 space-y-6">
        <h2 className="text-lg font-semibold">Subject Line</h2>
        <SubjectLineEditor value={subject} onChange={setSubject} />
      </div>

      {/* Email Body */}
      <div className="rounded-lg border p-8 space-y-6">
        <h2 className="text-lg font-semibold">Email Body</h2>
        <TemplateEditor onUpdate={setBodyJson} />
      </div>
    </div>
  )
}
