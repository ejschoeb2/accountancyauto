'use client'

import { useState, useRef, useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { PlaceholderDropdown } from './placeholder-dropdown'
import { AVAILABLE_PLACEHOLDERS } from '@/lib/templates/variables'

interface SubjectLineEditorProps {
  value: string
  onChange: (value: string) => void
}

export function SubjectLineEditor({ value, onChange }: SubjectLineEditorProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  const handlePlaceholderInsert = useCallback(
    (id: string) => {
      const input = inputRef.current
      if (!input) return

      const cursorPosition = input.selectionStart ?? value.length
      const textBefore = value.slice(0, cursorPosition)
      const textAfter = value.slice(cursorPosition)
      const placeholderText = `{{${id}}}`
      const newValue = textBefore + placeholderText + textAfter

      // Update the value
      onChange(newValue)

      // Restore focus and set cursor after inserted text
      setTimeout(() => {
        input.focus()
        const newCursorPosition = cursorPosition + placeholderText.length
        input.setSelectionRange(newCursorPosition, newCursorPosition)
      }, 0)
    },
    [value, onChange]
  )

  // Convert {{variable}} patterns to visual pills for preview
  const renderPreview = () => {
    if (!value) {
      return (
        <div className="text-sm text-muted-foreground">
          Preview will appear here
        </div>
      )
    }

    // Split on {{...}} pattern
    const parts = value.split(/(\{\{\w+\}\})/)

    return (
      <div className="text-sm flex flex-wrap items-center gap-1">
        {parts.map((part, index) => {
          // Check if this is a placeholder
          const match = part.match(/^\{\{(\w+)\}\}$/)
          if (match) {
            const variableName = match[1]
            // Find the display label from AVAILABLE_PLACEHOLDERS
            const placeholder = AVAILABLE_PLACEHOLDERS.find(
              (p) => p.name === variableName
            )
            const label = placeholder
              ? variableName
                  .split('_')
                  .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                  .join(' ')
              : variableName

            return (
              <span
                key={index}
                className="inline-flex items-center rounded-full bg-primary/10 text-primary px-2 py-0.5 text-sm font-medium"
              >
                {`{{${label}}}`}
              </span>
            )
          }

          // Plain text
          return <span key={index}>{part}</span>
        })}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Enter subject line..."
          className="flex-1"
        />
        <PlaceholderDropdown
          onSelect={(id) => handlePlaceholderInsert(id)}
        />
      </div>

      {/* Visual preview */}
      <div className="rounded-lg border bg-muted/30 p-3">
        <div className="text-xs font-medium text-muted-foreground mb-1">
          Preview:
        </div>
        {renderPreview()}
      </div>
    </div>
  )
}
