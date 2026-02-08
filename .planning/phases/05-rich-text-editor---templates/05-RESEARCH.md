# Phase 5: Rich Text Editor & Templates - Research

**Researched:** 2026-02-08
**Domain:** TipTap 3.x Rich Text Editor with React
**Confidence:** HIGH

## Summary

TipTap 3.x is the modern standard for rich text editing in React applications, built on ProseMirror with a clean extension API. The editor stores content as JSON (preserving semantic structure) and exports to HTML for rendering. For this phase, we'll use TipTap's core packages (@tiptap/react, @tiptap/pm, @tiptap/starter-kit) to build a minimal formatting toolbar, custom atomic placeholder nodes using the Node API, and a button-triggered dropdown for placeholder insertion (NOT the Mention extension's character-trigger pattern).

Key technical challenges: (1) Creating truly atomic placeholder nodes that cannot be split or corrupted, (2) Stripping all paste formatting while preserving text, (3) Handling Next.js SSR requirements with `immediatelyRender: false`, and (4) Storing rich content as TipTap JSON in the database's body_json column.

**Primary recommendation:** Use TipTap's Node.create() API with `atom: true` and `inline: true` to create placeholder pills, disable StarterKit extensions we don't need (underline, code, strike, etc.), implement a custom paste handler to strip formatting, and programmatically insert placeholders via editor.chain().insertContent().run() when dropdown selection occurs.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Editor Toolbar & Formatting
- **Formatting options**: Minimal set only — bold, italic, lists (bullets/numbered), and links
- **Toolbar position**: Fixed top, always visible above the editor (like Gmail compose)
- **Subject line formatting**: Plain text only, no rich text formatting in subject
- **Link insertion**: Auto-detect pasted URLs and convert to links; toolbar button for manual link insertion
- **Default styling**: No template-level or global defaults — always starts plain
- **Keyboard shortcuts**: Yes, standard shortcuts work (Ctrl+B for bold, Ctrl+I for italic, etc.)
- **Metrics display**: No character count or word count shown
- **List nesting**: Flat lists only, no nested/indented sub-items

#### Placeholder Insertion UX
- **Body insertion method**: Button + dropdown only (no slash command) — click "Insert Placeholder" button, select from dropdown
- **Placeholder appearance in editor**: Styled pill/badge with colored background (clear visual distinction, protected from accidental editing)
- **Subject line insertion method**: Button dropdown (consistent with body)
- **Placeholder styling in subject**: Yes, same styled pill treatment as body

#### Template Management UI
- **Navigation location**: Main tab called "Templates" (top-level navigation, same level as Clients/Dashboard)
- **List page layout**: Cards in grid layout showing template preview and metadata
- **Search/filter**: No search or filter functionality — simple list/grid of all templates
- **New template creation**: Button opens full editor page (navigate away from list to dedicated editor page)

#### Content Pasting Behavior
- **Style stripping**: Strip all formatting — paste as plain text only, user re-applies formatting with toolbar
- **Paste notification**: No notification, silent paste
- **Paste shortcuts**: Ctrl+V always strips formatting, no Ctrl+Shift+V alternative
- **Image handling**: Ignore images completely — they don't appear, paste text only if present

### Claude's Discretion
- Exact color/styling of placeholder pills (as long as they're visually distinct and protected)
- Error state messaging for editor failures
- Loading states for template list and editor
- Exact card design in grid layout
- Button placement and styling for toolbar

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.

</user_constraints>

## Standard Stack

The established libraries/tools for TipTap-based rich text editing:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @tiptap/react | 3.19.0+ | React bindings + core functionality | Official React integration, includes hooks (useEditor, EditorContent) |
| @tiptap/pm | latest | ProseMirror dependencies | Required peer dependency for editor to function |
| @tiptap/starter-kit | latest | Collection of common extensions | Bundles Bold, Italic, Lists, Links, Document, Paragraph, Text nodes |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| DOMPurify | 3.x | HTML sanitization | Server-side sanitization before storing HTML output (XSS prevention) |
| isomorphic-dompurify | latest | DOMPurify wrapper for Node.js | If sanitizing on backend (recommended for security) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| TipTap JSON storage | HTML storage | JSON preserves semantic structure, safer from XSS, easier to transform; HTML is larger and riskier |
| Custom Node for placeholders | Mention extension | Mention uses character triggers (@); we need button-triggered insertion |
| StarterKit | Individual extensions | StarterKit bundles everything but allows disabling; manual assembly more explicit but verbose |

**Installation:**
```bash
npm install @tiptap/react @tiptap/pm @tiptap/starter-kit
npm install --save-dev @types/dompurify  # If using DOMPurify
```

## Architecture Patterns

### Recommended Project Structure
```
app/(dashboard)/templates/
├── page.tsx                           # Template list (grid of cards)
├── new/
│   └── page.tsx                       # Template editor (create)
├── [id]/
│   └── edit/
│       └── page.tsx                   # Template editor (edit existing)
├── components/
│   ├── template-editor.tsx            # Main TipTap editor wrapper
│   ├── template-editor-toolbar.tsx    # Fixed toolbar (bold, italic, lists, links)
│   ├── placeholder-dropdown.tsx       # Button + dropdown for inserting placeholders
│   ├── placeholder-node.tsx           # Custom Node View for placeholder pills
│   └── template-card.tsx              # Card for template list grid
└── extensions/
    └── placeholder-node.ts            # TipTap extension for placeholder custom node
```

### Pattern 1: TipTap Editor Setup with Next.js SSR

**What:** Configure useEditor hook to avoid SSR hydration issues and control re-rendering
**When to use:** Every TipTap editor in Next.js App Router
**Example:**
```typescript
// Source: https://tiptap.dev/docs/editor/getting-started/install/nextjs
'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'

export function TemplateEditor({ initialContent }: { initialContent?: any }) {
  const editor = useEditor({
    immediatelyRender: false,  // CRITICAL: Prevents SSR rendering
    shouldRerenderOnTransaction: false,  // Performance: Prevents re-render on every keystroke
    extensions: [
      StarterKit.configure({
        // Disable extensions we don't need
        heading: false,
        blockquote: false,
        codeBlock: false,
        horizontalRule: false,
        code: false,
        strike: false,
        // Keep only: bold, italic, bulletList, orderedList, listItem, link
      }),
    ],
    content: initialContent,
  })

  return <EditorContent editor={editor} />
}
```

### Pattern 2: Custom Atomic Placeholder Node

**What:** Create inline atomic nodes that cannot be split or edited (pills/badges)
**When to use:** For variables, mentions, or any content that must remain intact
**Example:**
```typescript
// Source: https://tiptap.dev/docs/editor/extensions/custom-extensions/create-new/node
import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'

export const PlaceholderNode = Node.create({
  name: 'placeholder',

  group: 'inline',
  inline: true,
  atom: true,  // CRITICAL: Makes node atomic (cannot be split)

  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: element => element.getAttribute('data-id'),
        renderHTML: attributes => ({ 'data-id': attributes.id }),
      },
      label: {
        default: null,
        parseHTML: element => element.getAttribute('data-label'),
        renderHTML: attributes => ({ 'data-label': attributes.label }),
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
        { 'data-type': 'placeholder' },
        HTMLAttributes
      ),
      node.attrs.label || node.attrs.id,
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(PlaceholderPill)
  },
})
```

### Pattern 3: Strip Paste Formatting

**What:** Convert all pasted content to plain text, removing styles, images, and complex formatting
**When to use:** When you want users to apply formatting via toolbar only
**Example:**
```typescript
// Source: https://github.com/ueberdosis/tiptap/discussions/4118
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
            if (!text) return false

            // Insert as plain text only
            view.dispatch(
              view.state.tr.insertText(text, view.state.selection.from)
            )
            return true  // Prevents default paste behavior
          },
        },
      }),
    ]
  },
})
```

### Pattern 4: Programmatic Node Insertion (Button-Triggered)

**What:** Insert placeholder nodes via button click (not character trigger)
**When to use:** When UI requires explicit button/dropdown selection
**Example:**
```typescript
// Source: https://tiptap.dev/docs/editor/api/commands
function insertPlaceholder(editor: Editor, placeholderId: string, label: string) {
  editor
    .chain()
    .focus()  // CRITICAL: Restore focus to editor
    .insertContent({
      type: 'placeholder',
      attrs: { id: placeholderId, label },
    })
    .run()
}

// In dropdown component:
<DropdownMenuItem
  onSelect={() => {
    insertPlaceholder(editor, 'client_name', 'Client Name')
  }}
>
  Client Name
</DropdownMenuItem>
```

### Pattern 5: Subject Line Placeholder Insertion (Non-Rich Text)

**What:** Handle placeholders in plain text input with styled display
**When to use:** Subject lines or other plain text fields that need placeholder visual distinction
**Example:**
```typescript
// Controlled input approach with styled pill rendering
function SubjectLineEditor({ value, onChange }: { value: string, onChange: (v: string) => void }) {
  const [cursorPosition, setCursorPosition] = useState(0)

  const insertPlaceholder = (placeholderId: string, label: string) => {
    const before = value.slice(0, cursorPosition)
    const after = value.slice(cursorPosition)
    const placeholder = `{{${placeholderId}}}`
    onChange(before + placeholder + after)
  }

  // Render with syntax highlighting for {{variable}} patterns
  return (
    <div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={(e) => setCursorPosition(e.target.selectionStart || 0)}
      />
      {/* Visual preview with pills */}
      <div>{renderPlaceholdersAsPills(value)}</div>
    </div>
  )
}
```

### Anti-Patterns to Avoid

- **Using Mention extension for placeholders:** Mention is designed for @-triggered autocomplete; button-triggered insertion requires custom node + manual command execution
- **Storing HTML in database:** JSON preserves semantic structure, is safer from XSS, and easier to transform/export
- **Rendering editor on server:** Always set `immediatelyRender: false` to prevent Next.js SSR hydration mismatches
- **Not calling editor.destroy():** Memory leaks occur if editor isn't cleaned up on component unmount
- **Using allowBase64 in Image extension:** Security risk; never enable base64 image embedding

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Rich text editor from scratch | Custom contentEditable wrapper | TipTap 3.x | Handles cursor position, selections, undo/redo, complex DOM updates, cross-browser quirks |
| HTML sanitization | Custom regex for script/style tags | DOMPurify | Handles edge cases, obfuscated attacks, nested tags, attribute-based XSS |
| Paste formatting cleanup | String replacement for HTML tags | TipTap ProseMirror plugin | Properly handles clipboard data formats, Word XML, RTF conversion |
| Atomic node behavior | contentEditable=false + manual selection | TipTap Node with `atom: true` | Prevents partial deletion, cursor positioning bugs, copy/paste corruption |
| List nesting prevention | CSS to hide indent controls | StarterKit configure with custom ListKeymap | Prevents keyboard shortcuts, drag-and-drop nesting, paste-induced nesting |

**Key insight:** Rich text editing is deceptively complex. ProseMirror (TipTap's foundation) solves thousands of edge cases around selection, cursor behavior, collaborative editing, and schema validation. Don't reimplement these — configure TipTap's extensions instead.

## Common Pitfalls

### Pitfall 1: SSR Hydration Mismatch
**What goes wrong:** Editor renders on server with different content/state than client, causing React hydration errors
**Why it happens:** TipTap initializes with DOM-dependent state that differs between server/client
**How to avoid:** Always set `immediatelyRender: false` in useEditor hook; mark component as `'use client'`
**Warning signs:** Console errors about hydration mismatch, editor flickering on load, content disappearing

### Pitfall 2: Re-rendering on Every Keystroke
**What goes wrong:** Editor re-renders entire component tree on every character typed, causing performance issues
**Why it happens:** Default `shouldRerenderOnTransaction: true` triggers React re-render on every editor state change
**How to avoid:** Set `shouldRerenderOnTransaction: false`, isolate editor in separate component, use `useEditorState` for reading without re-rendering
**Warning signs:** Typing lag, dropped keystrokes, high CPU usage during editing

### Pitfall 3: Memory Leaks from Undestroyed Editors
**What goes wrong:** Editor instances persist in memory after component unmounts, causing memory leaks
**Why it happens:** ProseMirror maintains references to DOM nodes and internal state
**How to avoid:** Call `editor?.destroy()` in useEffect cleanup function
**Warning signs:** Increasing memory usage over time, browser slowdown after multiple editor creations/destructions

### Pitfall 4: Placeholder Node Corruption (Not Truly Atomic)
**What goes wrong:** Users can place cursor inside placeholder, split it, or delete parts of it
**Why it happens:** Missing `atom: true` property or incorrect `inline` vs `block` group assignment
**How to avoid:** Set both `atom: true` and `inline: true`, ensure node has no content property
**Warning signs:** Cursor appears inside placeholder pill, backspace deletes only part of placeholder

### Pitfall 5: XSS from Unsanitized HTML Output
**What goes wrong:** Malicious scripts injected through editor content execute when HTML is rendered
**Why it happens:** TipTap's Link extension allows `javascript:` URLs, HTML output not sanitized before storage/rendering
**How to avoid:** Sanitize HTML with DOMPurify before storing, validate link URLs, store as JSON (safer), upgrade @tiptap/extension-link to 2.10.4+
**Warning signs:** CVE-2025-14284 vulnerability, javascript: URLs in links, unescaped HTML in output

### Pitfall 6: Paste Behavior Mismatch
**What goes wrong:** Pasting from Word/Outlook brings complex styles, nested lists, or breaks editor schema
**Why it happens:** Default paste handler tries to preserve formatting, Word HTML is extremely complex
**How to avoid:** Implement custom paste handler that extracts only plain text via `clipboardData.getData('text/plain')`
**Warning signs:** Editor breaks after paste, unexpected formatting appears, nested lists despite configuration

### Pitfall 7: Lost Focus After Button Click
**What goes wrong:** Clicking toolbar button or dropdown causes editor to lose focus, cursor position lost
**Why it happens:** Button click moves focus to button element, editor no longer active
**How to avoid:** Always call `.focus()` in command chain before inserting content: `editor.chain().focus().insertContent()`
**Warning signs:** Content inserted at wrong position, cursor disappears after button click

## Code Examples

Verified patterns from official sources:

### Example 1: Complete Editor Component Setup
```typescript
// Source: https://tiptap.dev/docs/editor/getting-started/install/nextjs
'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { useEffect } from 'react'

interface TemplateEditorProps {
  initialContent?: any
  onUpdate?: (json: any) => void
}

export function TemplateEditor({ initialContent, onUpdate }: TemplateEditorProps) {
  const editor = useEditor({
    immediatelyRender: false,
    shouldRerenderOnTransaction: false,
    extensions: [
      StarterKit.configure({
        // Disable unwanted extensions
        heading: false,
        blockquote: false,
        codeBlock: false,
        horizontalRule: false,
        code: false,
        strike: false,
        // Keep: bold, italic, bulletList, orderedList, listItem, link, paragraph, document, text
      }),
    ],
    content: initialContent,
    onUpdate: ({ editor }) => {
      onUpdate?.(editor.getJSON())
    },
  })

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      editor?.destroy()
    }
  }, [editor])

  if (!editor) {
    return <div>Loading editor...</div>
  }

  return <EditorContent editor={editor} />
}
```

### Example 2: Save/Load JSON Content
```typescript
// Source: https://tiptap.dev/docs/guides/output-json-html

// Save to database
async function saveTemplate(editor: Editor) {
  const json = editor.getJSON()
  const html = editor.getHTML()  // For email rendering

  await fetch('/api/templates', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Template Name',
      subject: 'Email Subject',
      body_json: json,      // Store JSON for editing
      body_plain: html,     // Store HTML for email delivery (sanitize first!)
    }),
  })
}

// Load from database
function loadTemplate(editor: Editor, bodyJson: any) {
  editor.commands.setContent(bodyJson)
}
```

### Example 3: Toolbar with shadcn/ui Components
```typescript
// Source: Community best practices + shadcn/ui documentation
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Bold, Italic, List, ListOrdered, Link } from 'lucide-react'

export function EditorToolbar({ editor }: { editor: Editor }) {
  if (!editor) return null

  return (
    <div className="border-b p-2 flex gap-1 sticky top-0 bg-background z-10">
      <Button
        size="icon-sm"
        variant={editor.isActive('bold') ? 'default' : 'ghost'}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold />
      </Button>

      <Button
        size="icon-sm"
        variant={editor.isActive('italic') ? 'default' : 'ghost'}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic />
      </Button>

      <Button
        size="icon-sm"
        variant={editor.isActive('bulletList') ? 'default' : 'ghost'}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List />
      </Button>

      <Button
        size="icon-sm"
        variant={editor.isActive('orderedList') ? 'default' : 'ghost'}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered />
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="outline">
            Insert Placeholder
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent onCloseAutoFocus={(e) => e.preventDefault()}>
          <DropdownMenuItem
            onSelect={() => {
              editor.chain().focus().insertContent({
                type: 'placeholder',
                attrs: { id: 'client_name', label: 'Client Name' },
              }).run()
            }}
          >
            Client Name
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => {
              editor.chain().focus().insertContent({
                type: 'placeholder',
                attrs: { id: 'deadline', label: 'Deadline' },
              }).run()
            }}
          >
            Deadline
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| TipTap v1 | TipTap v3 | 2024 | Complete rewrite, better React 18+ support, new package structure (@tiptap/react) |
| character-trigger suggestions | Button + command API | Ongoing | More flexible UX, not limited to slash commands or @ mentions |
| HTML storage | JSON storage | Best practice | Safer, semantic, transformable; HTML only for rendering |
| re-render on every keystroke | shouldRerenderOnTransaction: false | TipTap v2.5.0 | 10x+ performance improvement for large documents |
| Server-render compatible | immediatelyRender: false | TipTap v2.5.0 | Fixes Next.js SSR hydration issues |

**Deprecated/outdated:**
- **@tiptap/extension-link < 2.10.4**: CVE-2025-14284 XSS vulnerability in link URLs
- **TipTap v1.x**: Legacy API, no longer maintained, incompatible with React 18+
- **allowBase64 in Image extension**: Security risk, removed/deprecated in newer versions

## Open Questions

Things that couldn't be fully resolved:

1. **React 19 Full Compatibility**
   - What we know: TipTap 3.19.0 officially supports React 18; React 19 support is in progress but not fully complete
   - What's unclear: Whether all TipTap extensions work with React 19, or if only core editor is compatible
   - Recommendation: Project already uses React 19.2.3 successfully; proceed with TipTap 3.x and test thoroughly. If issues arise, React 18 is fallback option.

2. **List Nesting Prevention Configuration**
   - What we know: User wants flat lists only, no nested/indented sub-items
   - What's unclear: Exact StarterKit configuration to prevent list nesting (keyboard shortcuts, tab key behavior)
   - Recommendation: Start with default ListItem extension, test if nesting occurs, then customize ListKeymap or create custom ListItem if needed

3. **Placeholder Pill Styling Best Practices**
   - What we know: Placeholders must be visually distinct, colored background, pill/badge appearance
   - What's unclear: Exact Tailwind classes or CSS approach that works best with TipTap's rendering
   - Recommendation: Use inline Node View with Tailwind classes (bg-primary/10, text-primary, rounded-full, px-2, py-0.5); test that styles persist in getHTML() output

4. **Email HTML Inline Style Conversion**
   - What we know: TipTap outputs semantic HTML with classes; email clients need inline styles
   - What's unclear: Best library/approach for class-to-inline-style conversion (juice, inline-css, etc.)
   - Recommendation: Store TipTap JSON, render HTML when sending emails, use juice or inline-css library on backend to convert classes to inline styles. Defer to Phase 6 (Email Rendering & Preview).

## Sources

### Primary (HIGH confidence)
- [TipTap React Installation](https://tiptap.dev/docs/editor/getting-started/install/react) - Core setup and dependencies
- [TipTap Next.js Installation](https://tiptap.dev/docs/editor/getting-started/install/nextjs) - SSR configuration
- [TipTap Node API](https://tiptap.dev/docs/editor/extensions/custom-extensions/create-new/node) - Custom node creation
- [TipTap Node Views](https://tiptap.dev/docs/editor/extensions/custom-extensions/node-views) - React component rendering
- [TipTap Commands API](https://tiptap.dev/docs/editor/api/commands) - Programmatic content manipulation
- [TipTap StarterKit Extension](https://tiptap.dev/docs/editor/extensions/functionality/starterkit) - Extension configuration
- [TipTap Export JSON/HTML](https://tiptap.dev/docs/guides/output-json-html) - Content serialization
- [TipTap Paste Rules](https://tiptap.dev/docs/editor/api/paste-rules) - Paste customization
- [TipTap Suggestion Utility](https://tiptap.dev/docs/editor/api/utilities/suggestion) - Autocomplete mechanism
- [TipTap Mention Extension](https://tiptap.dev/docs/editor/extensions/nodes/mention) - Atomic node pattern reference

### Secondary (MEDIUM confidence)
- [shadcn/ui Dropdown Menu](https://ui.shadcn.com/docs/components/dropdown-menu) - UI component integration
- [TipTap Performance Guide](https://tiptap.dev/docs/guides/performance) - Verified optimization patterns
- [TipTap Best Practices (Liveblocks)](https://liveblocks.io/docs/guides/tiptap-best-practices-and-tips) - Community patterns
- [Minimal TipTap with shadcn](https://github.com/Aslam97/minimal-tiptap) - Example implementation

### Tertiary (LOW confidence - requires validation)
- [tiptap-clean-paste extension](https://github.com/unicscode/tiptap-clean-paste) - Paste handler example (community extension)
- GitHub Issues: [Memory Leak #5654](https://github.com/ueberdosis/tiptap/issues/5654), [XSS in Link #3673](https://github.com/ueberdosis/tiptap/issues/3673)
- [OWASP XSS Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html) - Security guidance

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Official TipTap documentation, npm package data
- Architecture: HIGH - Official examples, verified patterns from docs
- Pitfalls: MEDIUM-HIGH - Mix of official warnings and community-reported issues
- Open questions: MEDIUM - Areas requiring implementation testing

**Research date:** 2026-02-08
**Valid until:** ~30 days (TipTap is stable, React ecosystem moves slowly)

**React 19 Compatibility Note:** Project uses React 19.2.3. TipTap 3.19.0 officially supports React 18, with React 19 support in progress. Core editor appears compatible based on npm package metadata and recent GitHub activity, but full validation needed during implementation.
