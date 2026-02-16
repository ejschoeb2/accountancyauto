'use client'

import { useRef } from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { AVAILABLE_PLACEHOLDERS } from '@/lib/templates/variables'

interface PlaceholderDropdownProps {
  onSelect?: (id: string, label: string) => void
  // For unified mode - support both subject input and editor
  subjectInputRef?: React.RefObject<HTMLInputElement | null>
  onEditorInsert?: (id: string, label: string) => void
}

export function PlaceholderDropdown({
  onSelect,
  subjectInputRef,
  onEditorInsert,
}: PlaceholderDropdownProps) {
  const dropdownRef = useRef<HTMLButtonElement>(null)

  // Convert snake_case to Title Case
  const toTitleCase = (str: string): string => {
    return str
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  const handlePlaceholderSelect = (id: string, label: string) => {
    // Legacy mode - single callback
    if (onSelect) {
      onSelect(id, label)
      return
    }

    // Unified mode - detect which field has focus
    if (subjectInputRef?.current === document.activeElement) {
      // Subject input has focus
      const input = subjectInputRef.current
      if (!input) return

      const cursorPosition = input.selectionStart ?? input.value.length
      const textBefore = input.value.slice(0, cursorPosition)
      const textAfter = input.value.slice(cursorPosition)
      const placeholderText = `{{${id}}}`
      const newValue = textBefore + placeholderText + textAfter

      input.value = newValue
      input.dispatchEvent(new Event('input', { bubbles: true }))

      // Restore focus and set cursor
      setTimeout(() => {
        input.focus()
        const newCursorPosition = cursorPosition + placeholderText.length
        input.setSelectionRange(newCursorPosition, newCursorPosition)
      }, 0)
    } else {
      // Body editor has focus
      onEditorInsert?.(id, label)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          ref={dropdownRef}
          variant="ghost"
          type="button"
          className="px-4 py-2 h-10 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-500 hover:text-purple-500 transition-all duration-200 active:scale-[0.97] flex items-center gap-2 text-sm font-medium"
          title="Insert variable"
        >
          <Plus className="h-5 w-5" />
          Insert Variable
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        onCloseAutoFocus={(e) => e.preventDefault()}
        className="bg-popover text-popover-foreground rounded-md border shadow-md"
      >
        {AVAILABLE_PLACEHOLDERS.map((placeholder) => (
          <DropdownMenuItem
            key={placeholder.name}
            onClick={() => handlePlaceholderSelect(placeholder.name, toTitleCase(placeholder.name))}
            className="focus:bg-muted/30 focus:text-foreground rounded-sm px-2 py-1.5 text-sm cursor-default"
          >
            <span className="font-medium">{toTitleCase(placeholder.name)}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
