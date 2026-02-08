'use client'

import { forwardRef } from 'react'
import { Input } from '@/components/ui/input'

interface SubjectLineEditorProps {
  value: string
  onChange: (value: string) => void
}

export const SubjectLineEditor = forwardRef<HTMLInputElement, SubjectLineEditorProps>(
  ({ value, onChange }, ref) => {
    return (
      <div className="flex items-center gap-3 border-b px-4 py-3">
        <span className="text-sm font-medium text-muted-foreground shrink-0">Subject:</span>
        <Input
          ref={ref}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Subject line..."
          className="flex-1 border-0 bg-transparent focus-visible:ring-0 text-sm"
        />
      </div>
    )
  }
)
