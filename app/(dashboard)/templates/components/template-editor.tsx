'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import { PlaceholderNode } from '../extensions/placeholder-node'
import { PasteHandler } from '../extensions/paste-handler'
import { EditorToolbar } from './template-editor-toolbar'
import type { TipTapDocument } from '@/lib/types/database'
import { useEffect, forwardRef, useImperativeHandle } from 'react'

interface TemplateEditorProps {
  initialContent?: TipTapDocument | null
  onUpdate?: (json: TipTapDocument) => void
  placeholderButtonSlot?: React.ReactNode
}

export interface TemplateEditorHandle {
  insertPlaceholder: (id: string, label: string) => void
}

export const TemplateEditor = forwardRef<TemplateEditorHandle, TemplateEditorProps>(
  ({ initialContent, onUpdate, placeholderButtonSlot }, ref) => {
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

    // Expose insertPlaceholder method
    useImperativeHandle(ref, () => ({
      insertPlaceholder: (id: string, label: string) => {
        if (editor) {
          editor.chain().focus().insertContent({
            type: 'placeholder',
            attrs: { id, label },
          }).run()
        }
      },
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
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between border-b bg-background">
          <EditorToolbar editor={editor} placeholderButtonSlot={null} />
          <div className="px-2 py-2 shrink-0">
            {placeholderButtonSlot}
          </div>
        </div>
        <EditorContent
          editor={editor}
          className="prose prose-sm max-w-none p-4 min-h-[300px] flex-1 focus-within:outline-none [&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-full"
        />
      </div>
    )
  }
)

TemplateEditor.displayName = 'TemplateEditor'
