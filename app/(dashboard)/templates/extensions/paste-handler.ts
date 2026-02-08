import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'

export const PasteHandler = Extension.create({
  name: 'pasteHandler',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('pasteHandler'),
        props: {
          handlePaste: (view, event, slice) => {
            const text = event.clipboardData?.getData('text/plain')

            // If no text, allow default paste behavior
            if (!text) {
              return false
            }

            // Insert plain text only, replacing selection if any
            view.dispatch(
              view.state.tr.insertText(
                text,
                view.state.selection.from,
                view.state.selection.to
              )
            )

            // Prevent default paste behavior (strips all formatting)
            return true
          },
        },
      }),
    ]
  },
})
