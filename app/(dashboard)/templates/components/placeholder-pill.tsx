'use client'

import { NodeViewWrapper } from '@tiptap/react'
import type { NodeViewProps } from '@tiptap/core'

export function PlaceholderPill({ node }: NodeViewProps) {
  const id = node.attrs.id as string
  const label = node.attrs.label as string

  return (
    <NodeViewWrapper
      as="span"
      className="inline-flex items-center rounded-full bg-primary/10 text-primary px-2 py-0.5 text-sm font-medium select-none"
      contentEditable={false}
    >
      {label || id}
    </NodeViewWrapper>
  )
}
