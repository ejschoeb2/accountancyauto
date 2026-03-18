'use client'

import { ButtonBase } from '@/components/ui/button-base'
import { Bold, Italic, List, ListOrdered } from 'lucide-react'
import type { Editor } from '@tiptap/react'

interface EditorToolbarProps {
  editor: Editor | null
}

export function EditorToolbar({ editor }: EditorToolbarProps) {
  if (!editor) {
    return null
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Bold */}
      <ButtonBase
        type="button"
        variant="muted"
        buttonType="icon-only"
        isSelected={editor.isActive('bold')}
        onClick={() => editor.chain().focus().toggleBold().run()}
        title="Bold (Ctrl+B)"
      >
        <Bold className="h-4 w-4" />
      </ButtonBase>

      {/* Italic */}
      <ButtonBase
        type="button"
        variant="muted"
        buttonType="icon-only"
        isSelected={editor.isActive('italic')}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        title="Italic (Ctrl+I)"
      >
        <Italic className="h-4 w-4" />
      </ButtonBase>

      {/* Bullet List */}
      <ButtonBase
        type="button"
        variant="muted"
        buttonType="icon-only"
        isSelected={editor.isActive('bulletList')}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        title="Bullet List"
      >
        <List className="h-4 w-4" />
      </ButtonBase>

      {/* Ordered List */}
      <ButtonBase
        type="button"
        variant="muted"
        buttonType="icon-only"
        isSelected={editor.isActive('orderedList')}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        title="Numbered List"
      >
        <ListOrdered className="h-4 w-4" />
      </ButtonBase>

    </div>
  )
}
