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

For all view/mode toggles across the application, use the **ToggleGroup component** with `variant="muted"`.

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
  variant="muted"
/>
```

**Key Features:**
- Use `variant="muted"` for consistent, subtle styling
- Clean, professional appearance
- Clear visual feedback on selection

**Examples:**
- Clients page: Client Data / Client Deadlines toggle
- Email Logs page: Queued Emails / Sent Emails toggle

## Button Variants

### Action Buttons

- **Add/Create**: `variant="green"`
- **Import/Upload**: `variant="sky"`
- **Edit**: `variant="violet"` (default), `variant="amber"` (when active/editing)
- **Filter**: `variant="violet"` (default), `variant="amber"` (when active)
- **Delete/Remove**: `variant="destructive"`

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
// Example status badge
const statusConfig = {
  red: {
    bg: 'bg-status-danger/10',
    text: 'text-status-danger',
    icon: <XCircle className="h-4 w-4" />,
    label: 'Overdue',
  },
  orange: {
    bg: 'bg-status-critical/10',
    text: 'text-status-critical',
    icon: <AlertCircle className="h-4 w-4" />,
    label: 'Critical',
  },
  amber: {
    bg: 'bg-status-warning/10',
    text: 'text-status-warning',
    icon: <AlertCircle className="h-4 w-4" />,
    label: 'Approaching',
  },
  blue: {
    bg: 'bg-status-info/10',
    text: 'text-status-info',
    icon: <CheckCircle className="h-4 w-4" />,
    label: 'Scheduled',
  },
  green: {
    bg: 'bg-green-500/10',
    text: 'text-green-600',
    icon: <CheckCircle className="h-4 w-4" />,
    label: 'Records Received',
  },
  grey: {
    bg: 'bg-status-neutral/10',
    text: 'text-status-neutral',
    icon: <Minus className="h-4 w-4" />,
    label: 'Inactive',
  },
};
```

## Card Header with Description Pattern

For cards with a title, optional description, and optional action button, use this consistent spacing pattern:

**Standard Implementation:**

```tsx
<Card className="gap-1.5">
  <div className="px-8">  {/* NO pt-* needed! Card has py-8 built-in */}
    <div className="flex items-start justify-between gap-4 mb-6">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold">Section Title</h2>
        <p className="text-sm text-muted-foreground">
          Optional description text explaining this section.
        </p>
      </div>
      {/* Optional action button on the right */}
      <Button>Action</Button>
    </div>
  </div>
  <CardContent>
    {/* Your content */}
  </CardContent>
</Card>
```

**Spacing Breakdown:**

1. **Top Padding**: Inherited from `Card` component's `py-8` = `2rem` / `32px`
   - No extra `pt-*` needed on the header wrapper
2. **Horizontal Padding**: `px-8` = `2rem` / `32px`
   - Matches standard `CardHeader` and `CardContent` padding
3. **Title to Description Gap**: `space-y-1` = `0.25rem` / `4px`
   - Applied to the wrapper div containing both title and description
4. **Description to Content Below**: `mb-6` = `1.5rem` / `24px`
   - Applied to the flex container that holds title/description/button

**Key Values**: `px-8`, `space-y-1`, `mb-6`

**When to Use:**
- Section headers that need explanatory text below the title
- Sections with action buttons aligned to the right
- Anywhere you need a consistent header + description + content layout

**Examples:**
- Reminder Steps section (with Add Step button)
- Applies To section (without action button)
- Client detail page sections

## Future Patterns

As new UI patterns emerge, add them here to ensure consistency across the application.
