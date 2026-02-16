'use client'

import { ButtonBase } from '@/components/ui/button-base'
import { Bold, Italic, List, ListOrdered, Link2, Unlink } from 'lucide-react'
import type { Editor } from '@tiptap/react'

interface EditorToolbarProps {
  editor: Editor | null
}

export function EditorToolbar({ editor }: EditorToolbarProps) {
  if (!editor) {
    return null
  }

  const handleSetLink = () => {
    const previousUrl = editor.getAttributes('link').href
    const url = window.prompt('Enter URL:', previousUrl)

    // Cancelled
    if (url === null) {
      return
    }

    // Empty string unsets the link
    if (url === '') {
      editor.chain().focus().unsetLink().run()
      return
    }

    // Update link
    editor.chain().focus().setLink({ href: url }).run()
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

      {/* Link */}
      {editor.isActive('link') ? (
        <ButtonBase
          type="button"
          variant="muted"
          buttonType="icon-only"
          isSelected={true}
          onClick={() => editor.chain().focus().unsetLink().run()}
          title="Remove Link"
        >
          <Unlink className="h-4 w-4" />
        </ButtonBase>
      ) : (
        <ButtonBase
          type="button"
          variant="muted"
          buttonType="icon-only"
          isSelected={false}
          onClick={handleSetLink}
          title="Add Link"
        >
          <Link2 className="h-4 w-4" />
        </ButtonBase>
      )}

    </div>
  )
}
