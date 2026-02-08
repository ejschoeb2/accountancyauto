# Peninsula Accounting - Design System

Quick reference for styling conventions used across the app. Consult this before making UI changes.

---

## Color Palette

All colors are defined as CSS custom properties in `app/globals.css` using OKLCH.

| Token | Light Mode | Usage |
|-------|-----------|-------|
| `primary` | Navy `#1e3a5f` | Buttons, nav accents, headings |
| `accent` | Light Blue `#3b82f6` | Links, focus rings, highlights |
| `foreground` | Off-black `#1a1a2e` | Body text |
| `background` | White `#ffffff` | Page background, cards |
| `muted` | Slate `#f1f5f9` | Table headers, secondary areas |
| `muted-foreground` | `#64748b` | Labels, secondary text |
| `border` | `#e2e8f0` | All borders/dividers |
| `secondary` | `#eff6ff` | Secondary button bg, tags |
| `destructive` | Red `#dc2626` | Delete/remove actions |

### Semantic Status Colors

Use these instead of hardcoded Tailwind colors (no `text-red-600`, `bg-green-100`, etc.):

| Token | Approx Color | Usage |
|-------|-------------|-------|
| `status-danger` | Red | Overdue, errors, failed states |
| `status-warning` | Amber | Chasing, caution, paused |
| `status-success` | Green | On track, completed, received |
| `status-info` | Blue | Informational, sent today |
| `status-neutral` | Slate | Inactive, paused, grey states |

**Usage examples:**
```tsx
// Text
className="text-status-danger"
className="text-status-success"

// Backgrounds with opacity
className="bg-status-warning/10"
className="bg-status-success/10"

// Borders with opacity
className="border-status-warning/20"
```

---

## Typography

| Role | Font | CSS Variable |
|------|------|-------------|
| Primary (UI) | Figtree | `--font-figtree` / `font-sans` |
| Headers (Display) | Outfit | `--font-outfit` / `font-display` |
| Monospace | JetBrains Mono | `--font-jetbrains-mono` / `font-mono` |

Loaded via `next/font/google` in `app/layout.tsx`.

---

## Icons

**Library:** `@material-symbols/font-400` (Material Symbols Outlined, weight 400)

**Component:** `components/ui/icon.tsx`

```tsx
import { Icon } from "@/components/ui/icon";

<Icon name="search" />              // default md (20px)
<Icon name="check" size="sm" />     // 16px
<Icon name="warning" size="lg" />   // 24px
<Icon name="error" size="xl" />     // 32px
<Icon name="star" filled />         // filled variant
```

**Sizes:** `sm` (16px) | `md` (20px) | `lg` (24px) | `xl` (32px)

**Finding icon names:** Browse [fonts.google.com/icons](https://fonts.google.com/icons) - use `snake_case` names.

**Common icons used in the app:**
| Purpose | Icon Name |
|---------|-----------|
| Search | `search` |
| Close/Clear | `close` |
| Edit | `edit` |
| Delete | `delete` |
| Upload | `upload` |
| Download | `download` |
| File | `description` |
| Check | `check` |
| Check circle | `check_circle` |
| Error/Alert | `error` |
| Warning | `warning` |
| Info | `info` |
| Back arrow | `arrow_back` |
| Expand | `keyboard_arrow_down` |
| Collapse/Right | `chevron_right` |
| Play | `play_arrow` |
| Pause | `pause` |
| Spinner | `progress_activity` (add `className="animate-spin"`) |
| Cancel | `cancel` |

> `lucide-react` has been fully removed. Do not re-add it.

---

## Spacing Standards

| Element | Value |
|---------|-------|
| Page content padding | `px-8 py-10` |
| Card padding | `py-8 px-8` |
| Table cell padding | `p-3` |
| Table header height | `h-12` |
| Grid gaps | `gap-6` |
| Border radius (`--radius`) | `0.75rem` |

---

## Interaction Patterns

| Element | Effect |
|---------|--------|
| Buttons | `active:scale-[0.97]` click feedback, `hover:shadow-md` on primary |
| Table rows | `hover:bg-accent/5` subtle blue tint |
| Cards | `hover:shadow-md transition-shadow duration-200` |
| Nav links | `hover:text-accent transition-colors duration-200` |
| Inputs | `hover:border-foreground/20` on hover |

---

## Component Conventions

- **Links** use `text-accent hover:underline` (not hardcoded `text-blue-600`)
- **Destructive text buttons** use `text-destructive hover:text-destructive/80`
- **Override/custom badges** use `border-accent text-accent`
- **Paused/warning badges** use `border-status-warning text-status-warning`
- **Badge variants:** `default`, `secondary`, `destructive`, `outline`, `ghost`, `link`, `info`
- **shadcn config** (`components.json`): `iconLibrary: "material-symbols"`
