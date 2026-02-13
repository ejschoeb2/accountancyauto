# Peninsula Accounting - UI Design System

> **Version:** 1.0 (Current Production)
> **Last Updated:** 2026-02-13
> **Purpose:** Reference guide for maintaining visual consistency in v2 development

---

## Key Design Patterns (v1 Reference)

These are the signature patterns that define the Peninsula Accounting UI. **Maintain these in v2:**

### 1. **ButtonBase Tags** (Critical Component)
Small, semi-transparent badges used throughout:
- **Top-right of cards**: Status indicators (`Active`, `Custom`) + delete buttons
- **"Applies to" labels**: Blue tags showing client types (`bg-blue-500/10 text-blue-500`)
- **Filter panels**: Grey tags that switch to blue when selected (`variant="muted"` → `isSelected`)
- **Size**: `px-3 py-2 rounded-md` with `text-sm font-medium`

### 2. **Violet Variant** (Special Features)
Violet color (`bg-violet-500/10 text-violet-500`) indicates:
- Custom/special functionality (e.g., "Create Custom Reminder")
- Edit mode toggles
- Non-standard or user-created items

### 3. **Card Box Interaction**
Signature hover behavior for clickable cards:
```tsx
<Card className="cursor-pointer h-full flex flex-col">
// Default:  shadow-sm
// Hover:    shadow-lg + border-primary/20
// Smooth:   transition-shadow duration-300
```

### 4. **Header + Subheader Layout**
Consistent card header structure:
```tsx
<div className="space-y-1 min-w-0">
  <CardTitle className="truncate text-lg">{title}</CardTitle>
  <CardDescription>{subtitle}</CardDescription>
</div>
```

### 5. **Full-Width Table Breakout**
Tables break out of page padding for visual impact:
```tsx
<div className="-mx-8 mb-0 border-y shadow-sm hover:shadow-lg transition-shadow">
  <Table />
</div>
```

### 6. **Filter Tag Selection Behavior**
Muted grey tags switch to blue when selected:
```tsx
<ButtonWithText variant="muted" isSelected={active}>
  // Unselected: bg-status-neutral/10 text-status-neutral
  // Selected:   bg-blue-500/10 text-blue-500
</ButtonWithText>
```

### 7. **Page-Level Spacing**
- Standard pages: `space-y-8 max-w-7xl mx-auto`
- Pages with full-width tables: `space-y-6 pb-0` + `-mx-8` table breakout
- Inner containers: `max-w-7xl mx-auto space-y-4`

---

## Technology Stack

### Core Libraries
- **UI Framework:** shadcn/ui (Radix UI primitives + Tailwind CSS)
- **Styling:** Tailwind CSS v4 (OKLch color space)
- **Icons:** Lucide React
- **Component Variants:** Class Variance Authority (CVA)
- **Tables:** TanStack React Table v8
- **Forms:** React Hook Form + Zod
- **Notifications:** Sonner (toast library)
- **Rich Text:** TipTap (email templates)
- **Calendar:** React Big Calendar
- **Theme:** next-themes (light/dark mode)

### File Structure
```
components/
├── ui/              # shadcn/ui primitives
├── nav-links.tsx    # Main navigation
└── sign-out-button.tsx

app/(dashboard)/
├── clients/         # Client management UI
├── templates/       # Email template editor
├── schedules/       # Schedule management
└── dashboard/       # Dashboard widgets
```

---

## Color System

### Philosophy
Uses **OKLch color space** for perceptually uniform colors across light/dark modes.

### Primary Palette

**Light Mode:**
```css
--primary: #1e3a5f         /* Navy blue - primary actions */
--accent: #3b82f6          /* Light blue - accents/links */
--foreground: #1a1a1a      /* Dark grey - text */
--background: #f5f2e2      /* Warm beige - page background */
--muted: #f1f5f9           /* Light grey - inactive states */
--border: #e2e8f0          /* Subtle borders */
```

**Dark Mode:** Inverted palette with dark blue-grey backgrounds

### Status Colors (Traffic Light System)

Critical for accounting workflows - indicates client progress:

```css
--status-danger: #dc2626   /* Red - overdue/urgent */
--status-warning: #F59E0B  /* Amber - needs attention */
--status-success: #10b981  /* Green - on track/complete */
--status-info: #3b82f6     /* Blue - informational */
--status-neutral: #64748b  /* Grey - not started */
```

**Usage Pattern:**
```tsx
// Status badge with semi-transparent background
<div className="bg-status-danger/10 text-status-danger px-3 py-2 rounded-md">
  <span className="text-sm font-medium">Overdue</span>
</div>
```

### Button Color Variants
- **Blue** (`blue`): Primary actions (Add, Create, Save)
- **Violet** (`violet`): Special features (Create Custom Reminder, Edit mode toggles) - **distinguishes custom/special functionality**
- **Green** (`green`): Success/positive actions (Approve, Confirm)
- **Amber** (`amber`): Warning actions (Chase, Remind) and sort indicators
- **Red** (`destructive`): Destructive actions (Delete, Remove)
- **Sky** (`sky`): Import/upload actions
- **Neutral** (`neutral`): Secondary/cancel actions
- **Muted** (`muted`): Filter tags (switches to blue when selected)
- **Ghost** (`ghost`): Tertiary actions (minimal visual weight)

---

## Typography

### Font Families
```css
--font-sans: var(--font-figtree)           /* UI/body text */
--font-display: var(--font-figtree)        /* Headings */
--font-mono: var(--font-jetbrains-mono)    /* Code/technical */
```

### Heading Scale
```tsx
h1: text-5xl font-bold tracking-tight color-#1a1a1a
h2: text-4xl font-bold tracking-tight color-primary
h3: text-3xl font-bold tracking-tight color-primary
h4: text-2xl font-bold tracking-tight color-primary
h5: text-xl font-bold tracking-tight color-primary
h6: text-lg font-bold tracking-tight color-primary
```

### Text Sizes
- **xs:** Labels, captions, metadata
- **sm:** Secondary text, descriptions
- **base:** Body text (default)
- **lg:** Emphasized text
- **xl+:** Headings, hero text

### Weight Classes
- **medium:** Default emphasis (500)
- **semibold:** Important text (600)
- **bold:** Headings, buttons (700)

---

## Layout Patterns

### Container System
```tsx
// Standard page layout
<div className="min-h-screen flex flex-col">
  <header className="bg-background">
    <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
      {/* Logo + Navigation */}
    </div>
  </header>
  <main className="flex-1 px-8 py-10 w-full">
    {children}
  </main>
</div>
```

### Spacing Scale
- **Containers:** `max-w-7xl mx-auto`
- **Horizontal padding:** `px-6` (header), `px-8` (main content)
- **Vertical padding:** `py-8`, `py-10`
- **Element gaps:** `gap-2` (4px), `gap-4` (16px), `gap-6` (24px)

### Grid Patterns
```tsx
// Responsive 2-column layout
<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

// Card grid
<div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
```

### Full-Width Table Pattern
```tsx
// Break out of container padding for visual impact
<div className="-mx-8 mb-0 border-y shadow-sm hover:shadow-lg transition-shadow">
  <Table />
</div>
```

---

## Component Patterns

### ButtonBase Component

**Core Philosophy:** ButtonBase is the foundation for tag-like buttons with semi-transparent backgrounds and interactive states. Critical for filters, labels, and metadata display.

**Variants Available:**
- **blue**: Primary tags/actions
- **violet**: Special categories (custom schedules, edit mode)
- **green**: Success states
- **amber**: Warning/sort indicators
- **destructive/red**: Delete actions
- **muted**: Neutral/unselected state (switches to blue when selected)
- **neutral**: Secondary tags
- **sky**: Import/secondary actions
- **info**: Informational badges
- **ghost**: Minimal visual weight

**Button Types:**
- `icon-only`: 36x36px square (h-9 w-9)
- `icon-text`: Gap-2 with padding (px-4 py-2)
- `text-only`: Text without icon (px-4 py-2)

**Selected State Behavior (Critical Pattern):**
```tsx
// Muted tags switch to BLUE when selected (used in filters)
<ButtonWithText
  variant="muted"
  isSelected={activeFilters.has(value)}
  onClick={() => toggleFilter(value)}
>
  Filter Label
</ButtonWithText>
// Unselected: bg-status-neutral/10 text-status-neutral
// Selected:   bg-blue-500/10 text-blue-500
```

**Usage Examples:**

**Icon-only ButtonBase (delete actions in card headers):**
```tsx
<ButtonBase
  variant="destructive"
  buttonType="icon-only"
  onClick={handleDelete}
>
  <Trash2 className="h-5 w-5" />
</ButtonBase>
```

**Violet for special features:**
```tsx
<IconButtonWithText variant="violet">
  <Plus className="h-5 w-5" />
  Create Custom Reminder
</IconButtonWithText>
```

### Regular Buttons

**Primary Actions (Blue):**
```tsx
<IconButtonWithText variant="blue">
  <Plus className="h-5 w-5" />
  Add Client
</IconButtonWithText>
```

**Success Actions (Green):**
```tsx
<Button variant="green">Approve</Button>
```

**Warning Actions (Amber):**
```tsx
<Button variant="amber">Chase Overdue</Button>
```

**Destructive Actions (Red):**
```tsx
<Button variant="destructive">Delete</Button>
```

**Secondary Actions:**
```tsx
<Button variant="outline">Cancel</Button>
<Button variant="ghost">View Details</Button>
```

### Cards with Tags & Status Indicators

**Standard Card with Header Tags (Schedule/Template Pattern):**
```tsx
<Link href={href}>
  <Card className="cursor-pointer h-full flex flex-col">
    <CardHeader>
      <div className="flex items-start justify-between gap-3">
        {/* Left: Title + Description */}
        <div className="space-y-1 min-w-0">
          <CardTitle className="truncate text-lg">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>

        {/* Right: Tags + Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Status tag */}
          <div className="px-3 py-2 rounded-md inline-flex items-center bg-status-success/10">
            <span className="text-sm font-medium text-status-success">Active</span>
          </div>

          {/* Special category tag (violet for custom) */}
          <div className="px-3 py-2 rounded-md inline-flex items-center bg-violet-500/10">
            <span className="text-sm font-medium text-violet-500">Custom</span>
          </div>

          {/* Delete button */}
          <ButtonBase variant="destructive" buttonType="icon-only" onClick={handleDelete}>
            <Trash2 className="h-5 w-5" />
          </ButtonBase>
        </div>
      </div>
    </CardHeader>

    <CardContent className="space-y-4 flex-1 flex flex-col">
      {/* "Applies to" tags pattern */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-foreground">Applies to:</span>
        {types.map((type) => (
          <Badge
            key={type}
            variant="secondary"
            className="font-normal bg-blue-500/10 text-blue-500 rounded-md px-3 py-1.5 text-sm"
          >
            {type}
          </Badge>
        ))}
      </div>

      <hr />

      {/* Main content */}
    </CardContent>

    <CardFooter>
      {/* Actions or metadata */}
    </CardFooter>
  </Card>
</Link>
```

**Tag Styling Pattern:**
- **Status tags**: `px-3 py-2 rounded-md bg-{color}/10 text-{color}`
- **"Applies to" tags**: Blue badges with `bg-blue-500/10 text-blue-500 px-3 py-1.5`
- **Category tags** (custom, etc.): Violet with `bg-violet-500/10 text-violet-500`
- **Spacing**: `gap-2` between tags, `shrink-0` to prevent tag compression

**Card Box Styling & Interaction:**
- **Default state**: `rounded-xl border shadow-sm`
- **Hover state**: `hover:shadow-lg hover:border-primary/20`
  - Shadow grows from sm → lg
  - Border gains subtle primary color tint
- **Transition**: `transition-shadow duration-300` (smooth shadow animation)
- **Interactive wrapper**: `cursor-pointer` on Link element (not on Card itself)
- **Layout**: `h-full flex flex-col` for equal-height cards in responsive grids
- **Grid spacing**: `grid gap-6 md:grid-cols-2` (24px gap between cards)

**Visual Hierarchy within Cards:**
1. **Header** (CardHeader):
   - Title + description on left (`space-y-1 min-w-0`)
   - Tags + actions on right (`flex items-center gap-2 shrink-0`)
2. **Content** (CardContent):
   - `space-y-4` between sections
   - `flex-1 flex flex-col` to push footer to bottom
   - Horizontal rule (`<hr />`) to separate sections
3. **Footer** (CardFooter):
   - Action buttons or metadata

### Modals (Dialogs)

```tsx
<Dialog open={open} onOpenChange={setOpen}>
  <DialogTrigger asChild>
    <Button>Open Modal</Button>
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Title</DialogTitle>
      <DialogDescription>Description</DialogDescription>
    </DialogHeader>
    {/* Form or content */}
    <DialogFooter>
      <Button variant="outline" onClick={() => setOpen(false)}>
        Cancel
      </Button>
      <Button variant="blue" onClick={handleSubmit}>
        Confirm
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

**Modal Backdrop:** `bg-black/50` with fade animation

### Tables

**Structure:**
```tsx
<Table>
  <TableHeader>
    <TableRow>
      <TableHead>Column Name</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    <TableRow data-state={selected ? "selected" : ""} className="group cursor-pointer">
      <TableCell>Value</TableCell>
    </TableRow>
  </TableBody>
</Table>
```

**Row States:**
- Selected: `data-[state=selected]:bg-blue-500/10`
- Hover: `[&_tr:hover]:text-[#1a1a1a]`

### Status Indicators

**Traffic Light Badge:**
```tsx
const getStatusColor = (status: string) => {
  switch (status) {
    case 'overdue': return { bg: 'bg-status-danger/10', text: 'text-status-danger' };
    case 'chasing': return { bg: 'bg-status-warning/10', text: 'text-status-warning' };
    case 'complete': return { bg: 'bg-status-success/10', text: 'text-status-success' };
    default: return { bg: 'bg-status-neutral/10', text: 'text-status-neutral' };
  }
};

<div className={`px-3 py-2 rounded-md ${colors.bg} inline-flex items-center gap-2`}>
  <div className={`w-2 h-2 rounded-full ${colors.text.replace('text-', 'bg-')}`} />
  <span className={`text-sm font-medium ${colors.text}`}>{label}</span>
</div>
```

**Badge Component:**
```tsx
<Badge variant="default">Active</Badge>
<Badge variant="outline">Inactive</Badge>
<Badge variant="destructive">Error</Badge>
```

### Filter Panel Pattern (Collapsible Card with Tag Selection)

**Critical Pattern:** Filter panels use ButtonWithText with `variant="muted"` that switches to blue when selected:

```tsx
{showFilters && (
  <Card>
    <CardContent className="space-y-4">
      {/* Status filters with clear button */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2 flex-1">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Status
          </span>
          <div className="flex flex-wrap gap-2">
            {statusOptions.map((status) => (
              <ButtonWithText
                key={status}
                onClick={() => toggleStatusFilter(status)}
                isSelected={activeStatusFilters.has(status)}
                variant="muted"
              >
                {status}
              </ButtonWithText>
            ))}
          </div>
        </div>

        {/* Clear all button */}
        <div className="space-y-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide invisible">
            Clear
          </span>
          <IconButtonWithText variant="destructive" onClick={clearAllFilters}>
            <X className="h-5 w-5" />
            Clear all filters
          </IconButtonWithText>
        </div>
      </div>

      {/* Additional filter groups */}
      <div className="space-y-2">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Client Type
        </span>
        <div className="flex flex-wrap gap-2">
          {typeOptions.map((type) => (
            <ButtonWithText
              key={type.value}
              onClick={() => toggleTypeFilter(type.value)}
              isSelected={activeTypeFilters.has(type.value)}
              variant="muted"
            >
              {type.label}
            </ButtonWithText>
          ))}
        </div>
      </div>
    </CardContent>
  </Card>
)}
```

**Filter Tag Behavior:**
- **Unselected**: Grey/muted appearance (`bg-status-neutral/10 text-status-neutral`)
- **Selected**: Switches to blue (`bg-blue-500/10 text-blue-500`)
- **Spacing**: `gap-2` for tags, `flex-wrap` for responsive layout
- **Label style**: `text-xs font-semibold text-muted-foreground uppercase tracking-wide`

### Forms

**Input Pattern:**
```tsx
<div className="space-y-2">
  <Label htmlFor="name">Client Name</Label>
  <Input
    id="name"
    placeholder="Enter name..."
    {...register('name')}
  />
  {errors.name && (
    <p className="text-sm text-status-danger">{errors.name.message}</p>
  )}
</div>
```

**Input States:**
- Hover: `hover:shadow-md hover:border-primary/20`
- Focus: `focus-visible:border-2 focus-visible:border-primary`
- Error: `border-status-danger`

### Navigation

**Header Navigation:**
```tsx
<nav className="flex gap-6">
  <Link href="/clients" className="text-foreground hover:text-primary transition-colors">
    Clients
  </Link>
  <Link href="/templates" className="text-foreground hover:text-primary transition-colors">
    Templates
  </Link>
</nav>
```

**Active State:** Underline or bold text

### Tabs

**Default (Pill Style):**
```tsx
<Tabs defaultValue="overview">
  <TabsList>
    <TabsTrigger value="overview">Overview</TabsTrigger>
    <TabsTrigger value="details">Details</TabsTrigger>
  </TabsList>
  <TabsContent value="overview">Content</TabsContent>
</Tabs>
```

**Line Style (Underline):**
```tsx
<TabsList variant="line">
  <TabsTrigger value="tab1">Tab 1</TabsTrigger>
</TabsList>
```

---

## Border Radius Scale

```css
--radius-sm: 0.25rem   /* 4px - small elements */
--radius-md: 0.5rem    /* 8px - inputs, buttons */
--radius-lg: 0.75rem   /* 12px - cards (default) */
--radius-xl: 1rem      /* 16px - large cards */
--radius-2xl: 1.25rem  /* 20px - modals */
--radius-full: 9999px  /* Fully rounded (badges, pills) */
```

---

## Shadow Hierarchy

```css
shadow-xs   /* Subtle borders (inputs) */
shadow-sm   /* Cards, tables (default) */
shadow-md   /* Hover states, elevated elements */
shadow-lg   /* Modals, dropdowns, popovers */
```

**Usage:**
- Default state: `shadow-sm`
- Hover state: `hover:shadow-lg`
- Transition: `transition-shadow duration-300`

---

## Animation & Transitions

### Standard Transitions
```tsx
transition-all duration-200        // General state changes
transition-colors                   // Color-only transitions
transition-shadow duration-300      // Shadow changes
```

### Interactive Feedback
```tsx
active:scale-[0.97]                // Click feedback on buttons
hover:scale-105                     // Hover growth (cards, icons)
```

### Modal/Dialog Animations
```tsx
// Fade in/out with zoom
data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0
data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95
```

### Custom Keyframes
```css
@keyframes pulse-scale {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.1); opacity: 0.9; }
}

@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
```

---

## Accessibility Guidelines

### Focus States
```tsx
focus-visible:ring-ring/50 focus-visible:ring-[3px]
focus-visible:outline-none
```

### ARIA Patterns
- Always use semantic HTML (`<button>`, `<nav>`, `<main>`)
- Add `aria-label` for icon-only buttons
- Use `role` attributes for custom components
- Include `aria-expanded`, `aria-selected` for interactive states

### Keyboard Navigation
- All interactive elements must be keyboard-accessible
- Dropdowns/menus support arrow keys
- Modals trap focus and support Escape to close

---

## Page Layout & Spacing Standards

### Page Container Pattern

**Standard page wrapper:**
```tsx
<div className="space-y-8 max-w-7xl mx-auto">
  {/* Page header */}
  {/* Content sections */}
</div>
```

**Alternate pattern (for full-width tables):**
```tsx
<div className="space-y-6 pb-0">
  <div className="max-w-7xl mx-auto space-y-4">
    {/* Page header and controls */}
  </div>

  {/* Break out of container for full-width table */}
  <div className="-mx-8 mb-0 border-y shadow-sm hover:shadow-lg transition-shadow duration-300">
    <Table />
  </div>
</div>
```

**Key Spacing Values:**
- Page sections: `space-y-8` (schedules) or `space-y-6` (clients)
- Header elements: `space-y-4` within max-w-7xl container
- Title/description: `space-y-1` or `space-y-2`
- Tag groups: `gap-2` or `gap-3`
- Action buttons: `gap-2`

### Page Header Pattern

Standard pattern used across dashboard pages:

```tsx
<div className="flex items-start justify-between">
  {/* Left: Title + Description */}
  <div className="space-y-1">
    <h1>Page Title</h1>
    <p className="text-muted-foreground mt-1">
      Brief description of page purpose
    </p>
  </div>

  {/* Right: Actions */}
  <div className="flex gap-2 items-center">
    <IconButtonWithText variant="green">
      <Plus className="h-5 w-5" />
      Add New
    </IconButtonWithText>
    <IconButtonWithText variant="violet">
      <Plus className="h-5 w-5" />
      Create Custom Reminder
    </IconButtonWithText>
  </div>
</div>
```

---

## Data Visualization Patterns

### Client Status Display
Uses traffic light colors (red/amber/green) for at-a-glance status:

```tsx
const getClientStatus = (metrics: ClientMetrics) => {
  if (metrics.overdueCount > 0) return 'red';
  if (metrics.chasingCount > 0) return 'amber';
  return 'green';
};
```

### Progress Indicators
```tsx
<Progress value={percentComplete} className="h-2" />
```

### Empty States
```tsx
<div className="flex flex-col items-center justify-center py-12 text-center">
  <Icon className="h-12 w-12 text-muted-foreground mb-4" />
  <h3 className="text-lg font-semibold">No items found</h3>
  <p className="text-sm text-muted-foreground">
    Get started by creating your first item
  </p>
  <Button variant="blue" className="mt-4">
    <Plus className="h-4 w-4 mr-2" />
    Create Item
  </Button>
</div>
```

---

## Responsive Design

### Breakpoints
```css
sm: 640px   /* Mobile landscape */
md: 768px   /* Tablet portrait */
lg: 1024px  /* Tablet landscape / small desktop */
xl: 1280px  /* Desktop */
2xl: 1536px /* Large desktop */
```

### Mobile-First Approach
```tsx
// Default: mobile, then add larger breakpoints
<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
```

### Hide/Show Patterns
```tsx
<div className="hidden md:block">Desktop only</div>
<div className="md:hidden">Mobile only</div>
```

---

## Common Anti-Patterns to Avoid

### Don't:
- ❌ Use arbitrary color values (`text-[#123456]`) - use theme variables
- ❌ Mix multiple border radius styles on same page
- ❌ Use `important` flags to override styles
- ❌ Create custom components for existing shadcn/ui components
- ❌ Hardcode spacing values - use Tailwind scale
- ❌ Skip hover/focus states on interactive elements

### Do:
- ✅ Use semantic color names (`text-primary`, `bg-status-danger`)
- ✅ Maintain consistent spacing scale (4px increments)
- ✅ Add transitions to all interactive elements
- ✅ Use existing components from `components/ui/`
- ✅ Test light/dark mode before committing
- ✅ Include empty states for all data views

---

## Quick Reference

### Most Common Classes
```tsx
// Page containers
space-y-8 max-w-7xl mx-auto              // Standard page wrapper (schedules)
space-y-6 pb-0                            // Alternate wrapper (clients with full-width table)
max-w-7xl mx-auto space-y-4               // Inner content container

// Full-width table breakout
-mx-8 mb-0 border-y shadow-sm hover:shadow-lg transition-shadow duration-300

// Card header with tags
flex items-start justify-between gap-3    // Header layout
space-y-1 min-w-0                         // Title/description container
flex items-center gap-2 shrink-0          // Tag container (top-right of cards)

// Tag styling (status/category badges)
px-3 py-2 rounded-md inline-flex items-center bg-{color}-500/10
text-sm font-medium text-{color}-500

// "Applies to" badges
bg-blue-500/10 text-blue-500 rounded-md px-3 py-1.5 text-sm

// Filter tags (muted -> blue when selected)
variant="muted" isSelected={active}       // ButtonWithText pattern

// Interactive elements
hover:shadow-lg transition-shadow duration-300
focus-visible:ring-ring/50 focus-visible:ring-[3px]
active:scale-[0.97]

// Card states
cursor-pointer h-full flex flex-col       // Interactive card wrapper
rounded-xl border shadow-sm hover:shadow-lg hover:border-primary/20
```

### Spacing Standards
- **Page level**: `space-y-8` (schedules) or `space-y-6` (clients)
- **Header level**: `space-y-4` (within containers)
- **Title/subtitle**: `space-y-1` or `space-y-2`
- **Tag groups**: `gap-2` or `gap-3`
- **CardContent sections**: `space-y-4`

### Icon Sizing
- `h-4 w-4` - Small icons (in buttons, badges)
- `h-5 w-5` - Standard icons (buttons, navigation, ButtonBase icon-only)
- `h-6 w-6` - Large icons (headers, emphasis)
- `h-12 w-12` - Extra large (empty states, features)

---

## Changelog

### v1.0 (Current)
- Initial design system documentation
- OKLch color space implementation
- Traffic light status system
- shadcn/ui component library
- Responsive grid patterns
- Dark mode support

---

## Notes for v2 Development

When building v2 features:

1. **Always reference this document** before creating new components
2. **Reuse existing components** from `components/ui/` wherever possible
3. **Maintain color consistency** - use traffic light system for status
4. **Test responsive behavior** at all breakpoints
5. **Verify dark mode** appearance
6. **Add hover/focus states** to all interactive elements
7. **Follow spacing scale** - no arbitrary values
8. **Document new patterns** here as they emerge

---

**Questions or need to extend this system?** Update this document and create corresponding examples in Storybook (if implemented in v2).
