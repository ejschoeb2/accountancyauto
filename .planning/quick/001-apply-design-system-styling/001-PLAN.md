---
phase: quick
plan: 001
type: execute
wave: 1
depends_on: []
autonomous: true
files_modified:
  # Task 1 - Layouts & shared UI
  - app/(auth)/onboarding/layout.tsx
  - app/(auth)/onboarding/page.tsx
  - app/(dashboard)/layout.tsx
  - components/qbo-status-banner.tsx
  # Task 2 - Dashboard components
  - app/(dashboard)/dashboard/components/summary-cards.tsx
  - app/(dashboard)/dashboard/components/dashboard-tabs.tsx
  - app/(dashboard)/dashboard/components/client-status-table.tsx
  - app/(dashboard)/dashboard/components/audit-log-table.tsx
  # Task 3 - Clients list & bulk actions
  - app/(dashboard)/clients/page.tsx
  - app/(dashboard)/clients/components/client-table.tsx
  - app/(dashboard)/clients/components/editable-cell.tsx
  - app/(dashboard)/clients/components/bulk-actions-toolbar.tsx
  - app/(dashboard)/clients/components/csv-import-dialog.tsx
  # Task 4 - Client detail page
  - app/(dashboard)/clients/[id]/page.tsx
  - app/(dashboard)/clients/[id]/components/records-received.tsx
  - app/(dashboard)/clients/[id]/components/filing-assignments.tsx
  - app/(dashboard)/clients/[id]/components/template-overrides.tsx
  - app/(dashboard)/clients/[id]/components/client-audit-log.tsx
  # Task 5 - Templates & Calendar
  - app/(dashboard)/templates/page.tsx
  - app/(dashboard)/templates/[id]/edit/page.tsx
  - app/(dashboard)/templates/components/template-step-editor.tsx
  - app/(dashboard)/calendar/page.tsx

must_haves:
  truths:
    - "No hardcoded color values (bg-white, text-blue-600, hex codes) remain in TSX files"
    - "All table rows have hover:bg-accent/5 row highlighting"
    - "Summary cards and template cards have hover:shadow-md transition-shadow effects"
    - "Nav links use hover:text-accent pattern"
    - "Card sections use consistent py-8 px-8 padding per design system"
    - "Client name links use text-accent hover:underline convention"
    - "Onboarding uses Icon component instead of inline SVGs"
  artifacts:
    - path: "app/(dashboard)/layout.tsx"
      provides: "Nav with design system hover patterns"
    - path: "app/(dashboard)/dashboard/components/summary-cards.tsx"
      provides: "Cards with hover interaction patterns"
    - path: "app/(dashboard)/clients/components/client-table.tsx"
      provides: "Table with row hover and accent links"
  key_links:
    - from: "all TSX files"
      to: "DESIGN_SYSTEM.md"
      via: "CSS custom properties"
      pattern: "text-accent|bg-accent|status-danger|status-warning|status-success"
---

<objective>
Apply the design system defined in DESIGN_SYSTEM.md consistently across all 28 TSX files in the application.

Purpose: The MVP shipped with some inconsistent styling - hardcoded colors, missing interaction patterns, inconsistent spacing, and inline SVGs where the Icon component should be used. This plan brings every file into alignment with the design system.

Output: All pages and components consistently use design tokens, interaction patterns, and spacing standards from DESIGN_SYSTEM.md.
</objective>

<execution_context>
@DESIGN_SYSTEM.md
</execution_context>

<context>
@DESIGN_SYSTEM.md
@app/globals.css
@components/ui/icon.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Fix layouts, onboarding, and shared components</name>
  <files>
    app/(auth)/onboarding/layout.tsx
    app/(auth)/onboarding/page.tsx
    app/(dashboard)/layout.tsx
    components/qbo-status-banner.tsx
  </files>
  <action>
**app/(auth)/onboarding/layout.tsx:**
- Replace hardcoded `bg-white` with `bg-background`

**app/(auth)/onboarding/page.tsx:**
- Replace the inline SVG checkmark (lines 123-135) with `<Icon name="check_circle" size="xl" className="text-status-success" />` and remove the wrapping div that creates the green circle background (the icon itself is sufficient, or keep the circle but use Icon inside)
- Replace the inline SVG X/error (lines 150-162) with `<Icon name="cancel" size="xl" className="text-status-danger" />` with same pattern
- The QuickBooks button `style={{ backgroundColor: "#0077C5" }}` is intentional brand color - keep it but add a comment: `{/* QuickBooks brand color - intentional override */}`
- Add `active:scale-[0.97]` to the QuickBooks connect button and "Go to Clients" button

**app/(dashboard)/layout.tsx:**
- Change nav link hover pattern from `text-primary/70 hover:text-primary` to `text-muted-foreground hover:text-accent transition-colors duration-200` (this matches the design system nav link pattern and gives a clearer visual distinction between idle and hover states)
- Keep the branding link `text-primary` as-is (that's correct)

**components/qbo-status-banner.tsx:**
- Already well-styled with status tokens. No changes needed. Just verify it uses design system tokens (it does).
  </action>
  <verify>
Run `npx next build` or `npx next lint` to confirm no compilation errors. Grep for `bg-white` in TSX files to confirm removal. Grep for `<svg` in onboarding/page.tsx to confirm SVGs replaced.
  </verify>
  <done>
Onboarding layout uses bg-background, onboarding page uses Icon component instead of inline SVGs, dashboard nav uses hover:text-accent pattern.
  </done>
</task>

<task type="auto">
  <name>Task 2: Polish dashboard components with interaction patterns</name>
  <files>
    app/(dashboard)/dashboard/components/summary-cards.tsx
    app/(dashboard)/dashboard/components/dashboard-tabs.tsx
    app/(dashboard)/dashboard/components/client-status-table.tsx
    app/(dashboard)/dashboard/components/audit-log-table.tsx
  </files>
  <action>
**summary-cards.tsx:**
- Add `hover:shadow-md transition-shadow duration-200` to each `<Card>` component (4 cards). Add these classes directly to `<Card>` since they support className.
- Change card padding to use design system standard: add `className="py-8 px-8"` to CardContent or adjust CardHeader/CardContent to match. Actually, the Card component from shadcn already handles padding via CardHeader/CardContent. The current `pb-2` on CardHeader is fine for the compact metric display. Leave card internal padding as-is since these are metric cards (intentionally compact), but DO add the hover effect.

**dashboard-tabs.tsx:**
- Add `transition-colors duration-200` to both tab buttons (it's missing from the className string)
- The existing tab styling with `border-primary text-primary` for active and `text-muted-foreground hover:text-foreground` for inactive is good. Just add the transition.

**client-status-table.tsx:**
- Add `hover:bg-accent/5` to each data `<TableRow>` in the map. The TableRow component accepts className. Add it as: `<TableRow key={client.id} className="hover:bg-accent/5">`
- The client name link already uses `text-accent hover:underline font-medium` - correct per design system. No change needed.

**audit-log-table.tsx:**
- Add `hover:bg-accent/5` to each data `<TableRow>` in the map: `<TableRow key={entry.id} className="hover:bg-accent/5">`
- Add `hover:border-foreground/20` to the search Input and date Inputs for the input hover pattern.
  </action>
  <verify>
Run `npx next lint` to confirm no errors. Visually: cards should show shadow on hover, table rows should show subtle blue tint on hover.
  </verify>
  <done>
Dashboard summary cards have hover shadow effects, tab buttons have transitions, all table rows in dashboard have hover:bg-accent/5, inputs have hover border pattern.
  </done>
</task>

<task type="auto">
  <name>Task 3: Style clients list page and bulk action components</name>
  <files>
    app/(dashboard)/clients/components/client-table.tsx
    app/(dashboard)/clients/components/editable-cell.tsx
    app/(dashboard)/clients/components/bulk-actions-toolbar.tsx
    app/(dashboard)/clients/components/csv-import-dialog.tsx
  </files>
  <action>
**client-table.tsx:**
- Add `text-accent` to the client name Link (line ~195). Change from `className="font-medium hover:underline"` to `className="text-accent font-medium hover:underline"` to match design system link convention.
- Add `hover:bg-accent/5` to each data `<TableRow>` in the row map (line ~413): `<TableRow key={row.id} data-state={row.getIsSelected() && "selected"} className="hover:bg-accent/5">`
- Add `hover:border-foreground/20` to the search Input (the one with `className="pl-9"`). Append the hover class.
- The filter Selects and badges already look good. No change needed for those.

**editable-cell.tsx:**
- The hover pattern `hover:bg-muted/50` on the display div (line 144) is reasonable for an editable cell trigger - keep it, it's intentionally distinct from table row hover.
- No changes needed - already well-styled.

**bulk-actions-toolbar.tsx:**
- Add `active:scale-[0.97]` to the "Bulk Edit" primary button for click feedback per design system.
- The toolbar styling is already clean. No other changes.

**csv-import-dialog.tsx:**
- The drag/drop area uses `border-primary bg-primary/5` for dragging state - change to `border-accent bg-accent/5` since accent is the highlight color (primary is navy, too dark for a drag indicator).
- Add `active:scale-[0.97]` to the Import button (the primary action button at the bottom).
- The success badge on line 303 uses `className="bg-status-success"` - this is correct.
  </action>
  <verify>
Run `npx next lint`. Grep client-table.tsx for `text-accent` on client name links. Check that table rows have hover classes.
  </verify>
  <done>
Client name links use text-accent, table rows have hover highlighting, primary buttons have click feedback, CSV dialog uses accent color for drag state.
  </done>
</task>

<task type="auto">
  <name>Task 4: Style client detail page and sub-components</name>
  <files>
    app/(dashboard)/clients/[id]/page.tsx
    app/(dashboard)/clients/[id]/components/records-received.tsx
    app/(dashboard)/clients/[id]/components/filing-assignments.tsx
    app/(dashboard)/clients/[id]/components/template-overrides.tsx
    app/(dashboard)/clients/[id]/components/client-audit-log.tsx
  </files>
  <action>
**clients/[id]/page.tsx:**
- Change card section padding from `p-6` to `py-8 px-8` on both card divs (lines 98 and 153) to match design system card padding standard.
- The badges for "Reminders Paused" and "Has Overrides" already use correct design system tokens. No change.
- The `<dl>` grid for client details is fine. No change.

**records-received.tsx:**
- Change section padding from `p-6` to `py-8 px-8` on the outer div (line 103).
- Fix the filing type item hover: change `hover:bg-accent/50` (too strong, creates a solid blue tint) to `hover:bg-accent/5` (subtle, matches table row hover pattern).
- Add `active:scale-[0.97]` to the Pause/Resume Reminders button since it's a primary action.

**filing-assignments.tsx:**
- Change section padding from `p-6` to `py-8 px-8` on all outer card divs (lines 161, 170, 180).
- Change inner filing item padding from `p-4` to match card padding? No - `p-4` is fine for inner items, they're nested cards within the section. Keep `p-4`.
- The override form uses `bg-muted/50 p-3` which is fine for a nested form area.
- Add `hover:border-foreground/20` to the date and text Input fields in the override form.

**template-overrides.tsx:**
- Change section padding from `p-6` to `py-8 px-8` on the three outer card divs (lines 244, 253, 263).
- The template header button expand/collapse area is fine.
- The "Reset All" button already uses `text-destructive hover:text-destructive/80` - correct per design system.
- Add `hover:border-foreground/20` to Input and Textarea fields in the edit mode section.

**client-audit-log.tsx:**
- Add `hover:bg-accent/5` to each data `<TableRow>` in the map (line ~141): `<TableRow key={entry.id} className="hover:bg-accent/5">`
- Add `hover:border-foreground/20` to date Input fields.
  </action>
  <verify>
Run `npx next lint`. Check that section cards use py-8 px-8 padding. Grep for `hover:bg-accent/50` to confirm it's been replaced with `hover:bg-accent/5` in records-received.
  </verify>
  <done>
Client detail card sections use consistent py-8 px-8 padding, records-received hover uses subtle accent/5, all table rows have hover highlighting, inputs have hover border pattern.
  </done>
</task>

<task type="auto">
  <name>Task 5: Style templates and calendar pages</name>
  <files>
    app/(dashboard)/templates/page.tsx
    app/(dashboard)/templates/[id]/edit/page.tsx
    app/(dashboard)/templates/components/template-step-editor.tsx
    app/(dashboard)/calendar/page.tsx
  </files>
  <action>
**templates/page.tsx:**
- The template card already has `hover:shadow-md hover:border-accent/30 transition-colors` which is close. Change `transition-colors` to `transition-all duration-200` so the shadow transition is also smooth.
- Add `active:scale-[0.97]` to the "Create Template" Button.
- The empty state card uses `border-dashed p-12` which is fine. No change.

**templates/[id]/edit/page.tsx:**
- Change card section padding from `p-8` (already correct on some) - verify all three bordered sections use `py-8 px-8`. Currently they use `p-8` which is equivalent. Leave them as `p-8` since `p-8` = `py-8 px-8` (same result, more concise).
- Add `hover:border-foreground/20` to the name Input, description Textarea, and delay_days Input fields.
- Add `active:scale-[0.97]` to the primary submit Button ("Create Template" / "Save Changes").
- The Delete button uses `variant="destructive"` which is correct. No change.

**template-step-editor.tsx:**
- Add `hover:border-foreground/20` to the delay_days Input, subject Input, and body Textarea fields inside each accordion step.
- The "Remove Step" button uses `variant="destructive"` - correct. No change.
- The "Add Step" button is outline variant - no interaction pattern needed beyond default.

**calendar/page.tsx:**
- The `FILING_TYPE_LEGEND` array uses hardcoded hex colors like `"#3b82f6"`. These are for visual legend dots that match the calendar event colors. Since the calendar component (react-big-calendar) requires inline style hex colors for event backgrounds, and these legend dots need to match, the hex values here are intentional and necessary. Add a code comment explaining this: `// Hex colors match react-big-calendar event styling (inline styles required by the library)`
- Change card section padding from `p-6` to `py-8 px-8` on the two card divs (lines 72 and 77) wrapping the calendar and legend.
- The heading uses `text-3xl font-bold` while other pages use `text-2xl font-semibold`. Normalize to `text-2xl font-semibold tracking-tight` for consistency with other page headings.
  </action>
  <verify>
Run `npx next lint` and `npx next build` to confirm no compilation errors across the entire app. Visually spot-check that templates page cards animate on hover and calendar page has consistent heading style.
  </verify>
  <done>
Template cards have smooth hover transitions, form inputs have hover border effects, primary buttons have click feedback, calendar page has consistent heading and card padding, hex colors in calendar are documented as intentional.
  </done>
</task>

</tasks>

<verification>
After all tasks complete:

1. **No hardcoded colors:** Run search across all TSX files for `bg-white`, `text-blue-600`, `text-green-`, `text-red-`, `bg-green-`, `bg-red-` - should find zero matches.
2. **Consistent hover patterns:** Grep for `hover:bg-accent/5` - should appear in all table components (client-status-table, audit-log-table, client-table, client-audit-log).
3. **Card hover effects:** Grep for `hover:shadow-md` - should appear in summary-cards and templates page.
4. **Accent links:** Grep for `text-accent.*hover:underline` - should appear on all client name links.
5. **Build passes:** `npx next build` completes without errors.
6. **No inline SVGs in onboarding:** Grep onboarding/page.tsx for `<svg` - should find zero matches.
</verification>

<success_criteria>
- All 28 TSX files follow DESIGN_SYSTEM.md conventions
- Zero hardcoded Tailwind color classes (bg-white, text-blue-600, etc.) remain
- All data table rows have hover:bg-accent/5
- All card components have hover:shadow-md transition effects
- All client name links use text-accent hover:underline
- All primary action buttons have active:scale-[0.97]
- All card sections on detail pages use py-8 px-8 padding
- Onboarding page uses Icon component, not inline SVGs
- Application builds without errors
</success_criteria>

<output>
After completion, create `.planning/quick/001-apply-design-system-styling/001-SUMMARY.md`
</output>
