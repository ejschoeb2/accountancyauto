---
phase: '05'
plan: '01'
subsystem: template-editor
tags: [tiptap, rich-text-editor, extensions, react]
requires:
  - phase: '04'
    plan: '02'
    what: v1.1 database tables with TipTapDocument type definition
provides:
  - TipTap 3.x installed and configured
  - PlaceholderNode custom extension for atomic variable pills
  - PasteHandler extension for format stripping
affects:
  - phase: '05'
    plan: '03'
    how: Template editor will use PlaceholderNode and PasteHandler extensions
tech-stack:
  added:
    - '@tiptap/react@3.19.0'
    - '@tiptap/pm@3.19.0'
    - '@tiptap/starter-kit@3.19.0'
  patterns:
    - TipTap custom Node extension with atom: true for uncorruptible inline nodes
    - ReactNodeViewRenderer for React component rendering within TipTap
    - ProseMirror Plugin for paste event interception
key-files:
  created:
    - app/(dashboard)/templates/extensions/placeholder-node.ts
    - app/(dashboard)/templates/components/placeholder-pill.tsx
    - app/(dashboard)/templates/extensions/paste-handler.ts
  modified:
    - package.json
    - package-lock.json
decisions:
  - what: PlaceholderNode configured as atomic inline node
    why: Prevents corruption - users cannot split or partially delete variable pills
    impact: Guaranteed template variable integrity in editor
  - what: PasteHandler strips ALL formatting to plain text
    why: User decision - paste always strips, no Ctrl+Shift+V alternative
    impact: Consistent paste behavior, user re-applies formatting via toolbar
  - what: Pills display as {{variable}} with primary color styling
    why: Clear visual distinction from body text, indicates protected content
    impact: Users immediately recognize placeholders as special elements
metrics:
  duration: 207s
  completed: 2026-02-08
---

# Phase 5 Plan 01: TipTap Extensions Foundation Summary

**One-liner:** TipTap 3.x installed with atomic PlaceholderNode pill extension and paste-formatting-stripping handler

## What Was Built

Installed TipTap 3.x React editor framework and created two custom extensions foundational to the template editor:

1. **PlaceholderNode Extension** - Custom TipTap Node that renders template variables (like {{client_name}}) as atomic inline pills that cannot be split, corrupted, or partially deleted. Uses React NodeView for styled pill rendering with primary color background.

2. **PasteHandler Extension** - ProseMirror Plugin that intercepts all paste events and extracts only plain text from clipboard, stripping all formatting including styles, images, and HTML structure. Ensures clean paste behavior from Word/Outlook.

Both extensions are ready to be imported and used by the template editor component in Plan 03.

## Objective Achievement

✅ **Objective met:** TipTap 3.x packages installed, PlaceholderNode extension creates protected variable pills, PasteHandler ensures plain-text-only paste behavior.

**Key deliverables:**
- ✅ @tiptap/react@3.19.0, @tiptap/pm@3.19.0, @tiptap/starter-kit@3.19.0 installed
- ✅ PlaceholderNode extension with `atom: true` and `inline: true` configuration
- ✅ PlaceholderPill React component renders styled pills via NodeViewWrapper
- ✅ PasteHandler extension with ProseMirror Plugin handlePaste implementation
- ✅ TypeScript compilation passes for all new files

## Task Commits

| Task | Name | Commit | Status |
|------|------|--------|--------|
| 1 | Install TipTap and create PlaceholderNode extension with pill component | c1663f4 | ✅ Complete |
| 2 | Create PasteHandler extension | 7d49549 | ✅ Complete |

**Total tasks:** 2/2 (100%)

## Technical Decisions

### 1. PlaceholderNode as Atomic Inline Node

**Decision:** Configure PlaceholderNode with `atom: true`, `inline: true`, and `group: 'inline'`

**Reasoning:**
- `atom: true` makes the node indivisible - cursor cannot enter, backspace cannot partially delete
- `inline: true` + `group: 'inline'` allows pills to flow within paragraph text
- ReactNodeViewRenderer connects to PlaceholderPill React component for styled rendering

**Impact:** Guarantees template variables remain intact - users cannot accidentally corrupt {{variable}} syntax by splitting or partially editing pills.

**Alternatives considered:**
- Mark-based approach (rejected - marks can be stripped, nodes cannot)
- Mention extension (rejected - designed for @-triggered autocomplete, not button-triggered insertion)

### 2. Paste Strips All Formatting

**Decision:** PasteHandler always extracts `text/plain` from clipboardData, no Ctrl+Shift+V alternative for formatted paste

**Reasoning:**
- User constraint: "Ctrl+V always strips formatting, no Ctrl+Shift+V alternative"
- Prevents complex Word/Outlook HTML from breaking editor schema
- Forces users to apply formatting via toolbar (controlled, predictable)

**Impact:** Clean, predictable paste behavior. No nested lists, no unexpected styles, no image embeddings. Users re-apply formatting with toolbar buttons.

**Alternatives considered:**
- Ctrl+Shift+V for plain paste (rejected - user wants single paste behavior)
- Sanitize and preserve some formatting (rejected - too complex, edge cases unpredictable)

### 3. Pill Styling with Primary Color

**Decision:** Pills render with `bg-primary/10 text-primary rounded-full px-2 py-0.5` Tailwind classes

**Reasoning:**
- Must be visually distinct from body text (clear affordance)
- Primary color aligns with existing design system
- `rounded-full` creates pill/badge appearance
- `select-none` prevents accidental text selection within pill

**Impact:** Placeholders are immediately recognizable as special protected elements, not regular text.

**Alternatives considered:**
- Neutral gray styling (rejected - not distinct enough)
- Border-only pills (rejected - less visual weight)

## Decisions Made

1. **PlaceholderNode is atomic inline** - Cannot be split or corrupted by cursor/backspace/selection
2. **Paste always strips formatting** - No Ctrl+Shift+V alternative, paste is always plain text
3. **Pills display as {{variable}}** - Template syntax visible in editor for clarity
4. **Pills styled with primary color** - Clear visual distinction from body text

## Files Created

### Extensions
- `app/(dashboard)/templates/extensions/placeholder-node.ts` - TipTap custom Node extension, exports PlaceholderNode with atom: true
- `app/(dashboard)/templates/extensions/paste-handler.ts` - TipTap Extension with ProseMirror Plugin, exports PasteHandler

### Components
- `app/(dashboard)/templates/components/placeholder-pill.tsx` - React NodeView component for rendering placeholder pills with styled appearance

### Dependencies
- `package.json` - Added @tiptap/react, @tiptap/pm, @tiptap/starter-kit
- `package-lock.json` - TipTap dependency tree (62 packages)

## Next Phase Readiness

**Phase 5 Plan 02 (Template Editor UI Component):**
- ✅ PlaceholderNode ready to import and add to editor extensions array
- ✅ PasteHandler ready to import and add to editor extensions array
- ✅ PlaceholderPill component can be referenced via ReactNodeViewRenderer
- ⚠️ Note: Editor must set `immediatelyRender: false` to avoid Next.js SSR hydration mismatch

**Phase 5 Plan 03 (Toolbar & Placeholder Insertion):**
- ✅ PlaceholderNode configured to accept {id, label} attributes
- ✅ Insertion via `editor.chain().focus().insertContent({type: 'placeholder', attrs: {id: 'client_name', label: 'Client Name'}}).run()`
- 📝 PLACEHOLDER_VARIABLES constant already exists in lib/types/database.ts for dropdown options

**Blockers:** None

**Open questions:**
- List nesting prevention configuration - defer to Plan 02 testing
- Email HTML inline style conversion - defer to Phase 6 (Email Rendering)

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

All verification criteria met:

✅ `npm ls @tiptap/react @tiptap/pm @tiptap/starter-kit` shows all three packages installed
✅ All three extension/component files exist and export their respective modules
✅ PlaceholderNode has `atom: true` and `inline: true` (line 9-10 of placeholder-node.ts)
✅ PasteHandler intercepts paste and extracts only `text/plain` (line 13 of paste-handler.ts)
✅ No TypeScript compilation errors in the new files

## Testing Notes

**Manual verification deferred to Plan 02 integration:**
- PlaceholderNode atom behavior (cursor cannot enter pill, backspace deletes whole pill)
- PasteHandler strips formatting from Word/Outlook paste
- Pills render with correct styling and {{variable}} display

**Why defer:** Extensions are foundational - full testing requires editor component (Plan 02/03).

## Knowledge for Future Claude

**If modifying PlaceholderNode:**
- NEVER remove `atom: true` - this is what prevents corruption
- NEVER add `content` property - atomic nodes cannot have content
- The `id` attribute is the variable key (e.g., 'client_name'), `label` is display text (e.g., 'Client Name')
- Pills must stay inline - DO NOT change to `group: 'block'`

**If modifying PasteHandler:**
- ALWAYS extract `text/plain` only - DO NOT add rich HTML parsing
- MUST return `true` to prevent default paste behavior
- MUST use both `from` and `to` in insertText to handle selection replacement

**React 19 compatibility:**
- Project uses React 19.2.3
- TipTap 3.19.0 officially supports React 18, React 19 support in progress
- No errors observed during installation or TypeScript compilation
- Full validation during Plan 02 editor integration

## Performance Metrics

- **Duration:** 207 seconds (~3.5 minutes)
- **Tasks completed:** 2/2
- **Files created:** 3
- **Files modified:** 2 (package.json, package-lock.json)
- **npm packages added:** 62 (TipTap + dependencies)
- **TypeScript errors:** 0

---
*Phase 5 Plan 01 complete - TipTap extensions ready for editor integration*

## Self-Check: PASSED
