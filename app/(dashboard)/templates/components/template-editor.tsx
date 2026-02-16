'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import { PlaceholderNode } from '../extensions/placeholder-node'
import { PasteHandler } from '../extensions/paste-handler'
import type { TipTapDocument } from '@/lib/types/database'
import { useEffect, forwardRef, useImperativeHandle } from 'react'
import type { Editor } from '@tiptap/react'

interface TemplateEditorProps {
  initialContent?: TipTapDocument | null
  onUpdate?: (json: TipTapDocument) => void
}

export interface TemplateEditorHandle {
  insertPlaceholder: (id: string, label: string) => void
  getEditor: () => Editor | null
}

export const TemplateEditor = forwardRef<TemplateEditorHandle, TemplateEditorProps>(
  ({ initialContent, onUpdate }, ref) => {
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

    // Expose insertPlaceholder method and editor
    useImperativeHandle(ref, () => ({
      insertPlaceholder: (id: string, label: string) => {
        if (editor) {
          editor.chain().focus().insertContent({
            type: 'placeholder',
            attrs: { id, label },
          }).run()
        }
      },
      getEditor: () => editor,
    }), [editor])

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
      <EditorContent
        editor={editor}
        className="prose prose-sm max-w-none p-4 min-h-[300px] flex-1 focus-within:outline-none [&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-full"
      />
    )
  }
)

TemplateEditor.displayName = 'TemplateEditor'
