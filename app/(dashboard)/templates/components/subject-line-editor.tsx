'use client'

import { useRef, useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { PlaceholderDropdown } from './placeholder-dropdown'

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

  return (
    <div className="flex items-center gap-3 border-b px-4 py-3">
      <span className="text-sm font-medium text-muted-foreground shrink-0">Subject:</span>
      <Input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Subject line..."
        className="flex-1 border-0 bg-transparent focus-visible:ring-0 text-sm"
      />
      <PlaceholderDropdown
        onSelect={(id) => handlePlaceholderInsert(id)}
      />
    </div>
  )
}
