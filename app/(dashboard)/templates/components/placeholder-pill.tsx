'use client'

import { NodeViewWrapper } from '@tiptap/react'
import type { NodeViewProps } from '@tiptap/core'
import { Link } from 'lucide-react'

export function PlaceholderPill({ node }: NodeViewProps) {
  const id = node.attrs.id as string
  const label = node.attrs.label as string

  if (id === 'portal_link') {
    return (
      <NodeViewWrapper
        as="span"
        className="inline-flex items-center gap-1.5 rounded-md bg-violet-500/10 text-violet-600 px-3 py-1 text-sm font-medium select-none"
        contentEditable={false}
      >
        <Link className="size-3.5 shrink-0" />
        <span className="underline underline-offset-2 decoration-violet-400/50">https://app.prompt.so/portal/abc123</span>
      </NodeViewWrapper>
    )
  }

  return (
    <NodeViewWrapper
      as="span"
      className="inline-flex items-center rounded-md bg-sky-500/10 text-sky-600 px-3 py-1 text-sm font-medium select-none"
      contentEditable={false}
    >
      {label || id}
    </NodeViewWrapper>
  )
}
