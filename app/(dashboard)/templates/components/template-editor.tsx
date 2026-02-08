'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import { PlaceholderNode } from '../extensions/placeholder-node'
import { PasteHandler } from '../extensions/paste-handler'
import { EditorToolbar } from './template-editor-toolbar'
import type { TipTapDocument } from '@/lib/types/database'
import { useEffect } from 'react'

interface TemplateEditorProps {
  initialContent?: TipTapDocument | null
  onUpdate?: (json: TipTapDocument) => void
}

export function TemplateEditor({ initialContent, onUpdate }: TemplateEditorProps) {
  const editor = useEditor({
    immediatelyRender: false, // CRITICAL: Next.js SSR
    shouldRerenderOnTransaction: false, // Performance optimization

    extensions: [
      StarterKit.configure({
        heading: false,
        blockquote: false,
        codeBlock: false,
        horizontalRule: false,
        code: false,
        strike: false,
      }),
      Link.configure({
        openOnClick: false,
        autolink: true, // Auto-detect pasted URLs per user decision
        HTMLAttributes: {
          class: 'text-primary underline',
        },
      }),
      PlaceholderNode,
      PasteHandler,
    ],

    content: initialContent || {
      type: 'doc',
      content: [{ type: 'paragraph' }],
    },

    onUpdate: ({ editor }) => {
      onUpdate?.(editor.getJSON() as TipTapDocument)
    },
  })

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      editor?.destroy()
    }
  }, [editor])

  // Loading state
  if (!editor) {
    return (
      <div className="rounded-lg border p-4 text-muted-foreground">
        Loading editor...
      </div>
    )
  }

  return (
    <div className="rounded-lg border">
      <EditorToolbar editor={editor} />
      <EditorContent
        editor={editor}
        className="prose prose-sm max-w-none p-4 min-h-[200px] focus-within:outline-none [&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[200px]"
      />
    </div>
  )
}
