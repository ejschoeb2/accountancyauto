import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { PlaceholderPill } from '../components/placeholder-pill'

export const PlaceholderNode = Node.create({
  name: 'placeholder',

  group: 'inline',
  inline: true,
  atom: true, // CRITICAL: Makes node atomic (cannot be split)

  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-id'),
        renderHTML: (attributes) => {
          if (!attributes.id) {
            return {}
          }
          return {
            'data-id': attributes.id,
          }
        },
      },
      label: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-label'),
        renderHTML: (attributes) => {
          if (!attributes.label) {
            return {}
          }
          return {
            'data-label': attributes.label,
          }
        },
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-type="placeholder"]',
      },
    ]
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(
        {
          'data-type': 'placeholder',
          class: 'placeholder-pill',
        },
        HTMLAttributes
      ),
      node.attrs.label || node.attrs.id,
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(PlaceholderPill)
  },
})
