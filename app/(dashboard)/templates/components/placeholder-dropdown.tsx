'use client'

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
  onSelect: (id: string, label: string) => void
}

export function PlaceholderDropdown({ onSelect }: PlaceholderDropdownProps) {
  // Convert snake_case to Title Case
  const toTitleCase = (str: string): string => {
    return str
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          type="button"
          className="h-10 w-10 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 hover:text-blue-500 transition-all duration-200 active:scale-[0.97]"
          title="Insert placeholder"
        >
          <Plus className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        {AVAILABLE_PLACEHOLDERS.map((placeholder) => (
          <DropdownMenuItem
            key={placeholder.name}
            onClick={() => onSelect(placeholder.name, toTitleCase(placeholder.name))}
          >
            <div className="flex flex-col">
              <span className="font-medium">{toTitleCase(placeholder.name)}</span>
              <span className="text-xs text-muted-foreground">
                {placeholder.name}
              </span>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
