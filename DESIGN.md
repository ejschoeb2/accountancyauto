# Peninsula Accounting - Design Patterns

This document defines standard UI patterns and components used across the application.

## Dropdown Components

### Sort Dropdowns (Standard Pattern)

For all sort-by dropdowns across the application, use the **Select component** pattern instead of DropdownMenu.

**Standard Implementation:**

```tsx
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// In component
<div className="flex items-center gap-2">
  <span className="text-sm font-medium text-muted-foreground">Sort by:</span>
  <Select value={sortBy} onValueChange={setSortBy}>
    <SelectTrigger className="h-9 min-w-[180px]">
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="option-1">Option 1</SelectItem>
      <SelectItem value="option-2">Option 2</SelectItem>
      <SelectItem value="option-3">Option 3</SelectItem>
    </SelectContent>
  </Select>
</div>
```

**Key Features:**
- Height: `h-9` (36px)
- Minimum width: `min-w-[180px]`
- Uses `SelectValue` to display current selection
- Clean, consistent styling across the app
- Automatically handles focus states and accessibility

**Examples:**
- Clients page: Sort by Most Urgent, Name (A-Z/Z-A), Deadline, Type
- Email Logs page: Sort by Client Name, Send Date, Deadline Date

### Filter Dropdowns

For filter-related dropdowns with more complex interactions or multi-select needs, continue using DropdownMenu or ButtonWithText as appropriate.

### Date Range Filters (Standard Pattern)

For date range filtering across the application, use the following consistent pattern:

**Standard Implementation:**

```tsx
<div className="space-y-2">
  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
    Date Range Label
  </span>
  <div className="flex flex-wrap gap-4 items-end">
    <div className="flex items-center gap-3">
      <label className="text-xs text-muted-foreground whitespace-nowrap">From:</label>
      <Input
        type="date"
        value={dateFrom}
        onChange={(e) => setDateFrom(e.target.value)}
        className="w-40 hover:border-foreground/20"
      />
    </div>
    <div className="flex items-center gap-3">
      <label className="text-xs text-muted-foreground whitespace-nowrap">To:</label>
      <Input
        type="date"
        value={dateTo}
        onChange={(e) => setDateTo(e.target.value)}
        className="w-40 hover:border-foreground/20"
      />
    </div>
  </div>
</div>
```

**Key Features:**
- Input width: `w-40` (160px) for date inputs
- Consistent "From:" and "To:" labels
- Clean, inline layout with gap spacing

**Examples:**
- Clients page: Next Deadline Date Range filter
- Email Logs page: Send Date / Deadline Date filter

## Editable Cells

### Select Inputs in Edit Mode

When using editable cells with select inputs (like client type), use:

```tsx
<SelectTrigger className="h-8 min-w-[140px]" autoFocus>
  <SelectValue />
</SelectTrigger>
```

**Key Features:**
- Height: `h-8` (32px) - slightly smaller for inline editing
- Auto-focus when entering edit mode
- Minimum width ensures dropdown doesn't collapse

## Toggle Components

### View Mode Toggles (Standard Pattern)

For all view/mode toggles across the application, use the **ToggleGroup component**. It renders as a pill-shaped segmented control matching the `TabsList`/`TabsTrigger` aesthetic: `h-11`, `bg-muted` container, `bg-background` active item with shadow.

**Standard Implementation:**

```tsx
import { ToggleGroup } from '@/components/ui/toggle-group';

// In component
<ToggleGroup
  options={[
    { value: 'view1', label: 'View 1' },
    { value: 'view2', label: 'View 2' },
  ]}
  value={viewMode}
  onChange={setViewMode}
/>
```

**Key Features:**
- Height: `h-11` (44px) — larger than default inputs for visual prominence
- Container: `bg-muted rounded-lg p-[3px]`
- Active item: `bg-background text-foreground shadow-sm`
- Inactive item: `text-foreground/60 hover:text-foreground`
- Each item: `px-4` horizontal padding

**Page Header Placement:**

When a toggle controls the entire page view, position it **inline with the page header** on the right side using `flex items-center justify-between gap-4`. This is the standard pattern:

```tsx
<div className="flex items-center justify-between gap-4">
  <div className="space-y-1">
    <h1>Page Title</h1>
    <p className="text-muted-foreground">Description text</p>
  </div>
  <ToggleGroup
    options={[...]}
    value={viewMode}
    onChange={setViewMode}
  />
</div>
```

Use `items-start` instead of `items-center` only when multiple stacked toggles appear on the right (e.g. Email Activity page with two conditional toggles).

**Examples:**
- Settings page: General / Email / Billing tabs (uses `TabsList`/`TabsTrigger` directly — same visual)
- Clients page: Client Data / Client Deadlines toggle
- Email Logs page: Outbound / Inbound toggle (+ conditional Sent / Queued below)

## Badges vs Buttons

Badges and buttons use similar coloured pill styling but have distinct roles:

- **Badges** are read-only status indicators. They **never** have icons — text only.
- **Buttons** are interactive and **always** have an icon alongside their label.

### Standard Badge (Inline `div+span` Pattern)

All status badges across the application use this consistent sizing:

```tsx
<div className="px-3 py-2 rounded-md inline-flex items-center bg-{color}/10">
  <span className="text-sm font-medium text-{color}">Label</span>
</div>
```

**Key Values:** `px-3 py-2 rounded-md text-sm font-medium` — no icons, no `gap-*`.

**Examples:**
- Schedules page: Active / Inactive / Custom badges
- Settings page: Admin / Member role badges, Active / Pending status badges
- Clients table: Reminders (Active/Paused), Status (traffic light labels)
- Dashboard: Traffic light status badges
- Document cards: Confidence, Scanned PDF, Review needed badges

### Badge Colour Palette

| Purpose | Background | Text |
|---|---|---|
| Active / Green | `bg-green-500/10` | `text-green-600` |
| Admin / Info | `bg-blue-500/10` | `text-blue-500` |
| Pending / Amber | `bg-amber-500/10` | `text-amber-600` |
| Inactive / Neutral | `bg-status-neutral/10` | `text-status-neutral` |
| Custom / Violet | `bg-violet-500/10` | `text-violet-500` |
| Danger / Red | `bg-red-500/10` | `text-red-500` |
| Traffic light statuses | See Traffic Light Status System section below |

## Button Variants

### Action Buttons (`ButtonBase`)

All action buttons use the `ButtonBase` component (`@/components/ui/button-base`) — soft-colored pill buttons with `bg-{color}/10` backgrounds and `active:scale-[0.97]` press feedback.

**Standard Implementation:**

```tsx
import { ButtonBase } from "@/components/ui/button-base";
import { Plus } from "lucide-react";

<ButtonBase variant="green" buttonType="icon-text" onClick={handleCreate}>
  <Plus className="size-4" />
  Create
</ButtonBase>
```

**Button types:**
- `icon-text` — icon + label (default for most actions), `h-10 gap-2 px-4`
- `icon-only` — icon only, `h-9 w-9`
- `text-only` — label only, `h-10 px-4`

**Variant colour mapping:**

| Action | Variant |
|---|---|
| Add/Create, Confirm | `green` |
| Import/Upload, Reassign | `sky` |
| Edit, Filter (default) | `violet` |
| Edit active, Filter active, Cancel | `amber` |
| Delete/Remove | `destructive` |
| General actions, Invite, Change role, Resend | `blue` |
| Neutral/secondary | `muted` |

All action buttons **must** include an icon (use `buttonType="icon-text"` with a `size-4` Lucide icon).

**When to use `Button` (shadcn) instead:** Only for form submit buttons inside `DialogFooter` where the standard shadcn styling is preferred, or for links (`asChild` with `<Link>`).

### Disabled State: Intent-Locked Buttons

When a button should be visually unavailable until a condition is met (e.g., no unsaved changes, no email entered), keep the intended colour variant and add `disabled={!condition}`. The base `disabled:opacity-50 disabled:pointer-events-none` styles convey the inactive state without switching to `muted`.

**Pattern:**

```tsx
<ButtonBase
  variant="blue"
  buttonType="icon-text"
  disabled={!hasChanges || isSubmitting}
>
  <CheckCircle className="size-4" />
  Save
</ButtonBase>
```

**Rules:**
- Do **not** switch `variant` to `muted` to indicate an unavailable state — keep the intended colour
- The button renders at 50% opacity when disabled, signalling it is locked without losing its identity
- Pointer events are blocked so the cursor gives no false affordance

**Examples:**
- Settings > Team: Invite button — blue, disabled until an email address is typed
- Schedule edit page: Save button — blue, disabled until unsaved changes exist

## Icon Usage

### Standard Icons
- **Search**: Search input fields
- **SlidersHorizontal**: Filter toggles
- **Pencil**: Edit mode toggles
- **X**: Close/clear actions
- **Calendar**: Date-related actions
- **Plus**: Add/Create actions
- **Upload**: Import/Upload actions

## Traffic Light Status System

The application uses a time-based status system to track client reminder progress and deadline urgency:

### Status Definitions

- **🔴 Red (Overdue)**: Deadline has passed and records have not been received
- **🟠 Orange (Critical)**: Less than 1 week until deadline, no records received (urgent action required)
- **🟡 Amber (Approaching)**: 1-4 weeks until deadline, no records received (action needed soon)
- **🔵 Blue (Scheduled)**: More than 4 weeks until deadline, no records received (on schedule)
- **🟢 Green (Records Received)**: Records have been received (completed, regardless of deadline)
- **⚫ Grey (Inactive)**: Client has reminders paused OR no active filings

### Time Thresholds

- **Critical (Orange)**: `deadline < 7 days`
- **Approaching (Amber)**: `7 days ≤ deadline < 28 days`
- **Scheduled (Blue)**: `deadline ≥ 28 days`

### Priority Order

Status is calculated in this priority order (first match wins):
1. **Grey** - if paused or no active filings
2. **Green** - if ALL filings have records received
3. **Red** - if ANY deadline passed without records
4. **Orange** - if ANY deadline < 1 week away without records
5. **Amber** - if ANY deadline 1-4 weeks away without records
6. **Blue** - all remaining filings > 4 weeks away

### Color Definitions

Custom status colors are defined in `globals.css`:

```css
/* Light mode */
--status-danger: oklch(0.577 0.245 27.325);      /* Red */
--status-critical: oklch(0.713 0.202 40.85);     /* Orange */
--status-warning: oklch(0.705 0.183 54.13);      /* Amber */
--status-info: oklch(0.623 0.214 259.1);         /* Blue */
--status-neutral: oklch(0.554 0.027 256.8);      /* Grey */
```

**Note:** Green status uses Tailwind's green palette (`bg-green-500`, `text-green-600`) to match button styling.

### Usage in Filters

When implementing status filters, use these labels:
- "Overdue" for Red
- "Critical" for Orange
- "Approaching" for Amber
- "Scheduled" for Blue
- "Records Received" for Green
- "Inactive" for Grey

### Usage in UI Components

```tsx
// Example status badge (text only — no icons on badges)
const statusConfig = {
  red: {
    bg: 'bg-status-danger/10',
    text: 'text-status-danger',
    label: 'Overdue',
  },
  orange: {
    bg: 'bg-status-critical/10',
    text: 'text-status-critical',
    label: 'Critical',
  },
  amber: {
    bg: 'bg-status-warning/10',
    text: 'text-status-warning',
    label: 'Approaching',
  },
  blue: {
    bg: 'bg-status-info/10',
    text: 'text-status-info',
    label: 'Scheduled',
  },
  green: {
    bg: 'bg-green-500/10',
    text: 'text-green-600',
    label: 'Records Received',
  },
  grey: {
    bg: 'bg-status-neutral/10',
    text: 'text-status-neutral',
    label: 'Inactive',
  },
};
```

## Standard Card (Section Box) Pattern

This is the definitive pattern for all section boxes in the app. It covers three layers: the container styles, the header anatomy, and the labelled-field content pattern.

### 1. Container Styles

The `Card` component (`components/ui/card.tsx`) has all box styling built in — **do not add border, shadow, or hover classes manually**:

| Property | Classes | Effect |
|---|---|---|
| Border | `border` + `hover:border-primary/20` | Subtle primary tint on hover |
| Shadow | `shadow-sm` → `hover:shadow-lg` | Elevates on hover |
| Transition | `transition-all duration-300` | Smooth shadow + border animation |
| Shape | `rounded-xl` | Consistent corner radius |
| Padding | `py-8` | Top/bottom padding built in |

Every `<Card>` automatically gets hover interaction. No extra classes needed.

### 2. Full Anatomy

A section box has three layers: **main header → subheader description → content**.

```tsx
<Card className="gap-1.5">
  {/* Layer 1 & 2: Header block */}
  <div className="px-8">
    <div className="flex items-start justify-between gap-4 mb-4">
      <div className="space-y-1">
        {/* Layer 1: Main header */}
        <h2 className="text-2xl font-semibold">Section Title</h2>
        {/* Layer 2: Subheader description — include on every card */}
        <p className="text-sm text-muted-foreground">
          Explanatory text below the title. Always include this for consistent visual rhythm.
        </p>
      </div>
      {/* Optional action button aligned right */}
      <ButtonBase variant="green" buttonType="icon-text">
        <Plus className="size-4" /> Add
      </ButtonBase>
    </div>
  </div>
  {/* Layer 3: Content */}
  <CardContent>
    {/* Your content */}
  </CardContent>
</Card>
```

**Two fixed spacing distances (always constant):**
- **Title → description**: `space-y-1` = 4px — the gap between the `h2` and the `p` inside `div.space-y-1`
- **Header block → card content**: `mb-4` = 24px — on the outer `flex` container, giving a fixed gap to `CardContent` whether or not a description is present

**Other spacing:**
- **Top padding**: from `Card`'s built-in `py-8` — no `pt-*` needed on header wrapper
- **Horizontal padding**: `px-8` on header wrapper, `px-8` on `CardContent` (built in)

**⚠️ Anti-pattern — do not add extra wrapper divs:**
```tsx
{/* ❌ Wrong — extra nesting breaks spacing consistency */}
<div className="px-8">
  <div className="mb-4">
    <div className="space-y-1">
      <h2>Title</h2>
    </div>
  </div>
</div>

{/* ✅ Correct — flat: px-8 > flex.mb-4 > space-y-1 */}
<div className="px-8">
  <div className="flex items-start justify-between gap-4 mb-4">
    <div className="space-y-1">
      <h2>Title</h2>
    </div>
  </div>
</div>
```
The `flex items-start justify-between gap-4` wrapper is always used even without a right-side button — it's what carries the `mb-4` gap to content.

### 3. Labelled Field Content Pattern

When card content displays read-only key/value pairs (e.g. Client Details), use a `dl` grid with this label and value style:

```tsx
<CardContent>
  <dl className="grid grid-cols-1 gap-6 sm:grid-cols-2">
    <div>
      <dt className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
        Field Label
      </dt>
      <dd className="text-sm font-medium">
        Field value — or:
        <span className="text-muted-foreground">Not set</span>
      </dd>
    </div>
  </dl>
</CardContent>
```

**Label style**: `text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1`
**Value style**: `text-sm font-medium`
**Empty state**: wrap "Not set" in `<span className="text-muted-foreground">`

This label style matches the same pattern used in the email preview modal (Deadline Type, Deadline Date etc.).

### Future: SectionCard Component

Once this pattern is confirmed stable across the app, extract the header + description structure into a `SectionCard` wrapper component (`components/ui/section-card.tsx`) to reduce boilerplate. Hold off until the pattern is consistent in all existing usages.

### Examples

- Client page: Client Details (header + labelled fields, no description)
- Client page: Filing Management (header + description + custom content)
- Client page: Compliance (header + description + button content)
- Client page: Email Log (header + description + table content)

## Alert Box

A non-interactive inline message block. Unlike badges (single-line pill, text only) and buttons (interactive, always have icons), an **Alert Box** is a read-only container that:

- Is **not fixed to button/badge size** — stretches to fill its container
- Can display **multiple lines** of text or a detailed message
- Has an **icon on the left** that reinforces the sentiment
- **Does nothing when clicked** — purely informational

### Standard Implementation

```tsx
<div className="flex items-center gap-3 p-4 bg-{color}/10 rounded-xl">
  <Icon className="size-5 text-{color} shrink-0" />
  <p className="text-sm text-{color}">Message text here.</p>
</div>
```

For multi-line content with a title:

```tsx
<div className="flex items-start gap-3 p-4 bg-{color}/10 rounded-xl">
  <Icon className="size-5 text-{color} shrink-0 mt-0.5" />
  <div className="space-y-1">
    <p className="text-sm font-medium text-{color}">Alert title</p>
    <p className="text-sm text-{color}/80">Supporting detail text.</p>
  </div>
</div>
```

**Key Values:** `gap-3 p-4 rounded-xl` — `shrink-0` on icon prevents compression, `items-start` + `mt-0.5` for multi-line alignment.

### Colour Palette

Inherits the same colour palette as badges:

| Purpose | Background | Icon / Text |
|---|---|---|
| Success / Green | `bg-green-500/10` | `text-green-600` |
| Info / Blue | `bg-blue-500/10` | `text-blue-500` |
| Pending / Amber | `bg-amber-500/10` | `text-amber-600` |
| Custom / Violet | `bg-violet-500/10` | `text-violet-500` |
| Danger / Red | `bg-red-500/10` | `text-red-500` |

### Icons

Pick an icon that matches the sentiment:
- **Success**: `CheckCircle`
- **Warning**: `AlertTriangle`
- **Error**: `XCircle`
- **Info**: `AlertCircle` or `Info`

### Examples

- Setup wizard Import Complete step: "All rows imported successfully!" (green)
- Setup wizard Import Complete step: "Plan limit reached" warning (amber)

## Future Patterns

As new UI patterns emerge, add them here to ensure consistency across the application.
