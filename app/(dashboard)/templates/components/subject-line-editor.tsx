'use client'

import { forwardRef, useRef, useEffect, useState, useMemo } from 'react'
import { Input } from '@/components/ui/input'

interface SubjectLineEditorProps {
  value: string
  onChange: (value: string) => void
  placeholderButtonSlot?: React.ReactNode
}

export const SubjectLineEditor = forwardRef<HTMLInputElement, SubjectLineEditorProps>(
  ({ value, onChange, placeholderButtonSlot }, ref) => {
    const inputRef = useRef<HTMLInputElement>(null)
    const [isFocused, setIsFocused] = useState(false)

    // Expose input ref to parent
    useEffect(() => {
      if (ref) {
        if (typeof ref === 'function') {
          ref(inputRef.current)
        } else {
          (ref as any).current = inputRef.current
        }
      }
    }, [ref])

    // Parse value to identify variable positions for overlay
    const parsedContent = useMemo(() => {
      if (!value) return []

      const parts: Array<{ type: 'text' | 'variable'; content: string; start: number; end: number }> = []
      let lastIndex = 0
      const regex = /\{\{([^}]+)\}\}/g
      let match

      while ((match = regex.exec(value)) !== null) {
        // Add text before the placeholder
        if (match.index > lastIndex) {
          parts.push({
            type: 'text',
            content: value.slice(lastIndex, match.index),
            start: lastIndex,
            end: match.index,
          })
        }

        // Add the placeholder
        parts.push({
          type: 'variable',
          content: match[0],
          start: match.index,
          end: regex.lastIndex,
        })

        lastIndex = regex.lastIndex
      }

      // Add remaining text
      if (lastIndex < value.length) {
        parts.push({
          type: 'text',
          content: value.slice(lastIndex),
          start: lastIndex,
          end: value.length,
        })
      }

      return parts
    }, [value])

    return (
      <div className="flex items-center gap-3 border-b px-4 py-3">
        <span className="text-sm font-medium text-muted-foreground shrink-0">Subject:</span>
        <div className="flex-1 relative">
          {/* Styled overlay - always shown when there's content */}
          {value && (
            <div
              className="absolute inset-0 px-3 py-2 pointer-events-none flex items-center flex-wrap gap-x-0.5"
              aria-hidden="true"
            >
              {parsedContent.map((part, index) => {
                if (part.type === 'variable') {
                  return (
                    <span
                      key={index}
                      className="inline-flex items-center rounded-full bg-primary/10 text-primary px-2 py-0.5 text-sm font-medium select-none"
                    >
                      {part.content}
                    </span>
                  )
                } else {
                  return (
                    <span key={index} className="text-sm whitespace-pre">
                      {part.content}
                    </span>
                  )
                }
              })}
            </div>
          )}

          {/* Actual input - text is transparent to show styled overlay, but caret remains visible */}
          <Input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder="Subject line..."
            className={`flex-1 border-0 bg-transparent focus-visible:ring-0 text-sm ${
              value ? 'text-transparent caret-black dark:caret-white' : ''
            }`}
          />
        </div>
        {placeholderButtonSlot && (
          <div className="shrink-0">
            {placeholderButtonSlot}
          </div>
        )}
      </div>
    )
  }
)

SubjectLineEditor.displayName = 'SubjectLineEditor'
