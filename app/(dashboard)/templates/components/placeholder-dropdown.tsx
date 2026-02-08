'use client'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
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
        <Button variant="ghost" size="sm" type="button">
          Insert Placeholder
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
