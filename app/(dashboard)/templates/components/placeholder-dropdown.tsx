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
  // Capture active element and cursor position BEFORE the dropdown click steals focus
  const activeElementOnOpenRef = useRef<Element | null>(null)
  const subjectCursorRef = useRef<number>(0)

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

    // Unified mode - check which field had focus when dropdown was opened
    const isSubjectFocused =
      subjectInputRef?.current && activeElementOnOpenRef.current === subjectInputRef.current

    if (isSubjectFocused) {
      // Subject input had focus
      const input = subjectInputRef!.current!

      const cursorPosition = subjectCursorRef.current
      const textBefore = input.value.slice(0, cursorPosition)
      const textAfter = input.value.slice(cursorPosition)
      const placeholderText = `{{${id}}}`
      const newValue = textBefore + placeholderText + textAfter

      // Use native value setter to reliably trigger React's onChange on controlled input
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype, 'value'
      )?.set
      if (nativeInputValueSetter) {
        nativeInputValueSetter.call(input, newValue)
      } else {
        input.value = newValue
      }
      input.dispatchEvent(new Event('input', { bubbles: true }))

      // Restore focus and set cursor
      setTimeout(() => {
        input.focus()
        const newCursorPosition = cursorPosition + placeholderText.length
        input.setSelectionRange(newCursorPosition, newCursorPosition)
      }, 0)
    } else {
      // Body editor had focus (or nothing specific)
      onEditorInsert?.(id, label)
    }
  }

  // Capture focus state on pointerdown — fires before focus shifts to the dropdown trigger
  const handlePointerDown = () => {
    activeElementOnOpenRef.current = document.activeElement
    if (subjectInputRef?.current && subjectInputRef.current === document.activeElement) {
      subjectCursorRef.current =
        subjectInputRef.current.selectionStart ?? subjectInputRef.current.value.length
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          ref={dropdownRef}
          variant="ghost"
          type="button"
          className="px-4 py-2 h-10 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-500 hover:text-sky-500 transition-all duration-200 active:scale-[0.97] flex items-center gap-2 text-sm font-medium"
          title="Insert variable"
          onPointerDown={handlePointerDown}
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
