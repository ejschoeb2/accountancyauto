'use client'

import { Button } from '@/components/ui/button'
import { Bold, Italic, List, ListOrdered, Link2, Unlink } from 'lucide-react'
import type { Editor } from '@tiptap/react'

interface EditorToolbarProps {
  editor: Editor | null
  placeholderButtonSlot?: React.ReactNode
}

export function EditorToolbar({ editor, placeholderButtonSlot }: EditorToolbarProps) {
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
    <div className="border-b p-2 flex items-center gap-1 flex-wrap bg-background">
      {/* Bold */}
      <Button
        type="button"
        variant={editor.isActive('bold') ? 'default' : 'ghost'}
        size="sm"
        onClick={() => editor.chain().focus().toggleBold().run()}
        title="Bold (Ctrl+B)"
      >
        <Bold />
      </Button>

      {/* Italic */}
      <Button
        type="button"
        variant={editor.isActive('italic') ? 'default' : 'ghost'}
        size="sm"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        title="Italic (Ctrl+I)"
      >
        <Italic />
      </Button>

      {/* Separator */}
      <div className="w-px h-6 bg-border mx-1" />

      {/* Bullet List */}
      <Button
        type="button"
        variant={editor.isActive('bulletList') ? 'default' : 'ghost'}
        size="sm"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        title="Bullet List"
      >
        <List />
      </Button>

      {/* Ordered List */}
      <Button
        type="button"
        variant={editor.isActive('orderedList') ? 'default' : 'ghost'}
        size="sm"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        title="Numbered List"
      >
        <ListOrdered />
      </Button>

      {/* Separator */}
      <div className="w-px h-6 bg-border mx-1" />

      {/* Link */}
      {editor.isActive('link') ? (
        <Button
          type="button"
          variant="default"
          size="sm"
          onClick={() => editor.chain().focus().unsetLink().run()}
          title="Remove Link"
        >
          <Unlink />
        </Button>
      ) : (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleSetLink}
          title="Add Link"
        >
          <Link2 />
        </Button>
      )}

    </div>
  )
}
