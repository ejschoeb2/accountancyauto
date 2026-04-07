'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import { PlaceholderNode } from '../extensions/placeholder-node'
import { PasteHandler } from '../extensions/paste-handler'
import type { TipTapDocument, TipTapNode } from '@/lib/types/database'
import { useEffect, forwardRef, useImperativeHandle } from 'react'
import type { Editor } from '@tiptap/react'

const PLACEHOLDER_LABELS: Record<string, string> = {
  client_name: 'Client Name',
  filing_type: 'Filing Type',
  deadline: 'Deadline',
  deadline_short: 'Deadline',
  days_until_deadline: 'Days Until Deadline',
  accountant_name: 'Accountant Name',
  documents_required: 'Documents Required',
  portal_link: 'Portal Link',
}

/**
 * Normalizes TipTap JSON content by converting {{variable}} text nodes
 * into proper placeholder nodes so they render as badges in the editor.
 */
function normalizePlaceholders(doc: TipTapDocument): TipTapDocument {
  const PATTERN = /\{\{(\w+)\}\}/g

  function processContent(nodes: TipTapNode[]): TipTapNode[] {
    const result: TipTapNode[] = []
    for (const node of nodes) {
      if (node.type === 'text' && typeof node.text === 'string' && PATTERN.test(node.text)) {
        // Split text around {{variable}} patterns
        PATTERN.lastIndex = 0
        let lastIndex = 0
        let match: RegExpExecArray | null
        while ((match = PATTERN.exec(node.text)) !== null) {
          const before = node.text.slice(lastIndex, match.index)
          if (before) {
            result.push({ ...node, text: before })
          }
          const varName = match[1]
          result.push({
            type: 'placeholder',
            attrs: { id: varName, label: PLACEHOLDER_LABELS[varName] || varName },
          })
          lastIndex = match.index + match[0].length
        }
        const after = node.text.slice(lastIndex)
        if (after) {
          result.push({ ...node, text: after })
        }
      } else if (node.content && Array.isArray(node.content)) {
        result.push({ ...node, content: processContent(node.content) })
      } else {
        result.push(node)
      }
    }
    return result
  }

  if (!doc.content) return doc
  return { ...doc, content: processContent(doc.content) }
}

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

      content: initialContent ? normalizePlaceholders(initialContent) : {
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
