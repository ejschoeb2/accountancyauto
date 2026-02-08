/**
 * Shared TipTap extensions configuration
 *
 * CRITICAL: This config MUST match the editor extensions exactly.
 * Both the React editor and server-side HTML renderer use this.
 * Mismatched extensions cause nodes to be silently dropped during rendering.
 */

import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import { Node, mergeAttributes } from '@tiptap/core'

/**
 * PlaceholderNode extension for server-side rendering
 *
 * Renders {{variable}} syntax that can be replaced by substituteVariables()
 */
const PlaceholderNode = Node.create({
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
    // Output: <span data-type="placeholder" data-id="client_name">{{client_name}}</span>
    // substituteVariables() will replace {{client_name}} with actual value
    return [
      'span',
      mergeAttributes(
        {
          'data-type': 'placeholder',
        },
        HTMLAttributes
      ),
      `{{${node.attrs.id}}}`, // Output {{variable}} syntax for substitution
    ]
  },
})

/**
 * Get shared TipTap extensions used by both editor and renderer
 *
 * @returns Array of TipTap extensions
 */
export function getSharedExtensions() {
  return [
    StarterKit.configure({
      // Disable features not used in email templates
      heading: false,
      blockquote: false,
      codeBlock: false,
      horizontalRule: false,
      code: false,
      strike: false,
      // Keep: bold, italic, bulletList, orderedList, listItem, paragraph, document, text
    }),
    Link.configure({
      openOnClick: false,
      HTMLAttributes: {
        target: '_blank',
        rel: 'noopener noreferrer', // Security: prevent window.opener access
      },
    }),
    PlaceholderNode,
  ]
}
