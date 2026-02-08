# Phase 7: Schedule Management & Overrides - Research

**Researched:** 2026-02-08
**Domain:** Schedule CRUD UI with step management, React Hook Form field arrays, Supabase relational queries
**Confidence:** HIGH

## Summary

Phase 7 delivers schedule creation and editing UI where accountants create reminder schedules for filing types, add/remove/reorder steps, assign email templates to steps, and configure delay + urgency per step. The phase scope has been reduced - per-client overrides were removed from scope.

The standard approach uses React Hook Form's `useFieldArray` with the `move()` method for reordering steps via up/down buttons (not drag-and-drop), shadcn/ui Select for template selection and urgency dropdowns, and Supabase's foreign key embedding for fetching schedules with their steps and related templates. The database schema already exists from Phase 4 migration.

Key technical considerations include using field.id (not array index) as React keys to prevent re-render bugs, avoiding stacked field array operations by allowing React to complete render cycles between actions, and fetching templates separately when PostgREST FK joins fail (documented project lesson).

**Primary recommendation:** Use React Hook Form `useFieldArray` with `move(index, index + 1)` / `move(index, index - 1)` for up/down reordering. Avoid drag-and-drop libraries which have complex integration issues with useFieldArray. Follow existing template editor patterns for consistency.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Schedule Creation & Editing UI:**
- Navigation location: Combined with Templates tab (e.g., "Templates & Schedules" tab, or sub-tabs within Templates)
- Adding steps: Add button creates new row, then user configures template/delay/urgency inline
- Reordering steps: Up/down arrow buttons to move step up or down in sequence
- Template reuse: Same template CAN appear in multiple steps of a schedule, but show warning message
- Editing: Full page editor (consistent with template editing pattern)

**Step Configuration Details:**
- Delay input: Preset options (7 days, 14 days, 30 days) plus custom number input
- Urgency levels: Manual dropdown/radio selection with 3 levels: Normal / High / Urgent
- Validation: No validation rules — trust user to configure sensible delays and urgency

**Schedule Viewing & Navigation:**
- Schedule list layout: Simple list showing schedule name and filing type
- Upcoming reminders: Do NOT show upcoming reminders from schedule view — schedules show configuration only
- Individual send management: No cancel/reschedule individual sends from schedule view
- Duplicate action: Yes, "Duplicate" button creates copy with "(Copy)" suffix for easy cloning

### Claude's Discretion
- Exact layout of step editor (table, cards, or list)
- Button styling and placement
- Warning message wording for duplicate templates
- Error handling for step operations
- Loading states for schedule list and editor

### Deferred Ideas (OUT OF SCOPE)
- **Per-client overrides** — Originally part of Phase 7, now removed from scope. Accountant uses ad-hoc sending (Phase 8) for client-specific needs instead.
- **Schedule analytics** — Track effectiveness, open rates, etc.
- **Automatic optimization** — Suggest best send times based on historical data
- **Upcoming reminder visibility from schedule view** — Discussed but removed from scope during discussion
</user_constraints>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React Hook Form | 7.x | Form state management with field arrays | Industry standard for complex forms in React - uncontrolled components pattern avoids re-render bottlenecks on large forms |
| @hookform/resolvers | 3.x | Zod integration with React Hook Form | Standard bridge for type-safe validation schemas |
| Zod | 3.x | Schema validation | Already used in project for template validation |
| Supabase PostgREST | via supabase-js | Relational queries with FK embedding | Project standard - supports nested SELECT with foreign keys |
| shadcn/ui | Current | UI component library | Project standard - Radix UI primitives with Tailwind styling |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Radix UI Select | 1.x (via shadcn) | Dropdown for template + urgency selection | Already in project, accessible, keyboard-navigable |
| Radix UI Radio Group | 1.x (via shadcn) | Alternative for urgency selection | If user prefers radio buttons over dropdown |
| Sonner | Latest | Toast notifications | Project standard for save/delete feedback |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| useFieldArray with move() | @dnd-kit or react-beautiful-dnd | Drag-and-drop libraries have complex integration with useFieldArray - field IDs get unstable during drag, causing form state desync. Up/down buttons are simpler and reliable. |
| Select dropdown for urgency | Radio group | Radio shows all options at once (better for 3 choices), but takes more vertical space. User decision locked to dropdown. |
| Preset + custom input | Dropdown only | Custom input allows flexibility (e.g., 15 days), but preset buttons reduce cognitive load for common values. User decision includes both. |

**Installation:**
```bash
# Already installed in project
# No new dependencies needed
```

## Architecture Patterns

### Recommended Project Structure
```
app/(dashboard)/
├── schedules/
│   ├── page.tsx                    # Schedule list view
│   ├── [id]/
│   │   └── edit/
│   │       └── page.tsx            # Schedule editor (new + edit)
│   └── components/
│       ├── schedule-list.tsx       # Schedule cards/table
│       ├── schedule-step-editor.tsx # Step array editor with reorder
│       └── duplicate-warning.tsx   # Warning when template appears twice
```

### Pattern 1: Field Array with Reordering
**What:** React Hook Form's `useFieldArray` with `move()` method for step reordering
**When to use:** Any time you need to manage an ordered list of form fields
**Example:**
```typescript
// Source: https://react-hook-form.com/docs/usefieldarray
import { useFieldArray, UseFormReturn } from "react-hook-form";

interface ScheduleStepEditorProps {
  form: UseFormReturn<ScheduleInput>;
}

export function ScheduleStepEditor({ form }: ScheduleStepEditorProps) {
  const { fields, append, remove, move } = useFieldArray({
    control: form.control,
    name: "steps",
  });

  const moveUp = (index: number) => {
    if (index > 0) {
      move(index, index - 1);
    }
  };

  const moveDown = (index: number) => {
    if (index < fields.length - 1) {
      move(index, index + 1);
    }
  };

  return (
    <div>
      {fields.map((field, index) => (
        <div key={field.id}> {/* CRITICAL: Use field.id, not index */}
          <input {...form.register(`steps.${index}.delay_days`)} />
          <button type="button" onClick={() => moveUp(index)}>↑</button>
          <button type="button" onClick={() => moveDown(index)}>↓</button>
          <button type="button" onClick={() => remove(index)}>Remove</button>
        </div>
      ))}
      <button type="button" onClick={() => append({ template_id: "", delay_days: 7, urgency: "normal" })}>
        Add Step
      </button>
    </div>
  );
}
```

### Pattern 2: Preset + Custom Input
**What:** Preset buttons for common values (7, 14, 30 days) with custom number input
**When to use:** When users need flexibility but common choices exist
**Example:**
```typescript
// Hybrid preset + custom pattern
const PRESET_DELAYS = [7, 14, 30];

<div className="space-y-2">
  <Label>Days before deadline</Label>
  <div className="flex gap-2">
    {PRESET_DELAYS.map((days) => (
      <Button
        key={days}
        type="button"
        variant={form.watch(`steps.${index}.delay_days`) === days ? "default" : "outline"}
        size="sm"
        onClick={() => form.setValue(`steps.${index}.delay_days`, days)}
      >
        {days} days
      </Button>
    ))}
    <Input
      type="number"
      min={1}
      max={365}
      className="w-24"
      {...form.register(`steps.${index}.delay_days`, { valueAsNumber: true })}
    />
  </div>
</div>
```

### Pattern 3: Supabase Nested Queries with FK Embedding
**What:** Fetch schedules with embedded schedule_steps and email_templates in one query
**When to use:** Loading schedule data for display or editing
**Example:**
```typescript
// Source: https://supabase.com/docs/guides/database/joins-and-nesting
const { data: schedules } = await supabase
  .from('schedules')
  .select(`
    *,
    schedule_steps (
      *,
      email_templates (
        id,
        name,
        subject
      )
    )
  `)
  .order('created_at', { ascending: false });

// If FK join fails (PostgREST cache issue - project lesson):
// Fetch reference tables separately and map in application code
const { data: templates } = await supabase
  .from('email_templates')
  .select('id, name, subject');
const templateMap = new Map(templates.map(t => [t.id, t]));

const { data: steps } = await supabase
  .from('schedule_steps')
  .select('*')
  .eq('schedule_id', scheduleId)
  .order('step_number', { ascending: true });

const enrichedSteps = steps.map(step => ({
  ...step,
  template: templateMap.get(step.email_template_id)
}));
```

### Pattern 4: Duplicate Template Warning (Non-blocking)
**What:** Show warning message when same template appears in multiple steps, but allow save
**When to use:** User can use same template multiple times (valid but potentially confusing)
**Example:**
```typescript
// Check for duplicate templates
const templateIds = form.watch("steps").map(s => s.email_template_id);
const duplicates = templateIds.filter((id, index) =>
  templateIds.indexOf(id) !== index && id !== ""
);

{duplicates.length > 0 && (
  <div className="rounded-lg border border-status-warning/20 bg-status-warning/10 p-4">
    <p className="text-sm text-status-warning">
      ⚠️ Some templates are used in multiple steps. This is allowed but may confuse recipients.
    </p>
  </div>
)}
```

### Anti-Patterns to Avoid
- **Using array index as React key:** Causes form state to desync when items are reordered. Always use `field.id` from useFieldArray.
- **Stacking field array operations:** Calling `move()` or `remove()` multiple times in rapid succession can cause state conflicts. Allow React to complete render cycles between operations.
- **Drag-and-drop for reordering:** Complex integration with useFieldArray - field IDs become unstable during drag operations. Up/down buttons are simpler and more reliable.
- **Blocking save on duplicate templates:** User decision allows duplicate templates with warning only. Don't prevent save.
- **Manual array manipulation:** Don't use `setValue("steps", [...])` to reorder. Use `move()` method to maintain form state integrity.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Form field array management | Custom array state + manual re-indexing | React Hook Form `useFieldArray` | Handles key management, form registration, validation, and dirty state automatically. Custom solutions break on reorder. |
| Step number recalculation | Manual step_number update logic | Database-side or API-side renumbering | After reorder, step_number should be recalculated when saving. Don't track it in form state - derive from array index. |
| Template selection dropdown | Custom <select> with styling | shadcn/ui Select (Radix UI) | Handles keyboard nav, typeahead search, screen reader support, and positioning automatically. |
| Duplicate detection | Manual loop comparison | Array methods (indexOf vs lastIndexOf) | Built-in methods are optimized and handle edge cases (empty strings, null values). |
| Transaction handling for multi-step save | Custom BEGIN/COMMIT logic | Database foreign key cascade + Supabase RPC | ON DELETE CASCADE handles orphaned schedule_steps automatically. Supabase RPC functions run in transactions. |

**Key insight:** Form state management for ordered lists is deceptively complex. React Hook Form's `useFieldArray` handles edge cases (reordering, removal, validation state, dirty tracking) that are easy to miss in custom implementations. The existing codebase uses this pattern successfully in template step editor.

## Common Pitfalls

### Pitfall 1: React Key Stability on Reorder
**What goes wrong:** Using array index as key causes form inputs to swap values when items are reordered. Step 1 moves down but displays Step 2's data.
**Why it happens:** React reconciliation uses keys to identify components. When key is index, React thinks the component at key=0 is the same before and after reorder, so it doesn't update the input value.
**How to avoid:** Always use `field.id` from useFieldArray as the key. This unique ID follows the item through reorders.
**Warning signs:** After reordering, input values don't match their labels, or form submission sends wrong data order.

**Source:** [React Hook Form useFieldArray Issue #3132](https://github.com/react-hook-form/react-hook-form/issues/3132)

### Pitfall 2: Stacked Field Array Operations
**What goes wrong:** Calling `move(0, 1)` immediately followed by `remove(0)` causes unpredictable state updates or throws errors.
**Why it happens:** React Hook Form batches state updates. If you queue multiple operations, they may execute against stale array state.
**How to avoid:** Separate operations across render cycles using `useEffect`, or ensure only one operation happens per user interaction. For up/down buttons, each button click is already separated.
**Warning signs:** Console errors like "Cannot read property of undefined", or operations silently fail.

**Source:** [React Hook Form useFieldArray documentation](https://react-hook-form.com/docs/usefieldarray) - "avoid stacked actions"

### Pitfall 3: PostgREST Foreign Key Join Cache Issues
**What goes wrong:** Supabase query with nested `schedule_steps ( email_templates (...) )` returns PGRST200 error or null data even though FK constraints exist.
**Why it happens:** PostgREST schema cache may not recognize FK relationships even after `NOTIFY pgrst, 'reload schema'`. This is a documented project lesson from audit log implementation.
**How to avoid:** Fetch reference tables separately and map in application code. Don't rely on nested FK joins for critical paths.
**Warning signs:** Query works in SQL but fails via Supabase client. Nested data is null despite valid foreign keys.

**Source:** Project MEMORY.md - "PostgREST FK join cache issue (PGRST200)"

### Pitfall 4: Step Number Out of Sync After Reorder
**What goes wrong:** User reorders steps in UI, but database `step_number` column doesn't update, causing reminders to send in wrong order.
**Why it happens:** `step_number` is stored in database but form only tracks array order. After `move()`, the array order changes but step_number values don't automatically recalculate.
**How to avoid:** On save, recalculate `step_number` from array index (1-based). Don't include `step_number` in form state - derive it when serializing for API.
**Warning signs:** Schedule saves successfully but reminders send in wrong sequence. Database shows step_number = [1, 3, 2] after reorder.

### Pitfall 5: Cascading Deletes Without User Confirmation
**What goes wrong:** User deletes a schedule, and all schedule_steps are silently deleted via ON DELETE CASCADE. Or deletes an email_template and schedule_steps fail with ON DELETE RESTRICT error.
**Why it happens:** Database schema has `schedules -> schedule_steps` as CASCADE and `email_templates -> schedule_steps` as RESTRICT (Phase 4 decision). Users may not understand cascading behavior.
**How to avoid:**
- For schedule deletion: Show confirmation dialog stating "This will delete X steps" before DELETE.
- For template deletion: Check if template is used in any schedule_steps before allowing delete. Show error message listing schedules that use it.
**Warning signs:** User deletes schedule and is confused why steps disappeared. User tries to delete template and gets cryptic FK constraint error.

**Source:** [Supabase Cascade Deletes](https://supabase.com/docs/guides/database/postgres/cascade-deletes)

### Pitfall 6: Warning Message as Validation Error
**What goes wrong:** Duplicate template warning is implemented as Zod validation error, preventing form submission even though duplicates are allowed.
**Why it happens:** Conflating warnings (non-blocking) with errors (blocking). User decision states duplicates are allowed with warning message.
**How to avoid:** Keep duplicate check separate from Zod schema. Check for duplicates in render logic and display warning UI, but don't use `setError()` or validation schema.
**Warning signs:** User can't submit form even though all fields are valid. Form errors show "duplicate template" message.

**Source:** [React Hook Form Issue #1761 - Support warnings instead of just errors](https://github.com/react-hook-form/react-hook-form/issues/1761)

## Code Examples

### Example 1: Schedule List Page
```typescript
// app/(dashboard)/schedules/page.tsx
// Pattern: Server component fetching schedules with filing type
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default async function SchedulesPage() {
  const supabase = await createClient();

  const { data: schedules } = await supabase
    .from("schedules")
    .select(`
      *,
      filing_types (
        id,
        name
      ),
      schedule_steps (
        id
      )
    `)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-10">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <h1 className="text-foreground">Reminder Schedules</h1>
          <p className="text-muted-foreground mt-1">
            Configure when reminders are sent for each filing type
          </p>
        </div>
        <Link href="/schedules/new/edit">
          <Button className="active:scale-[0.97]">Create Schedule</Button>
        </Link>
      </div>

      {schedules && schedules.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {schedules.map((schedule) => (
            <Link
              key={schedule.id}
              href={`/schedules/${schedule.id}/edit`}
              className="block"
            >
              <div className="rounded-lg border bg-card p-6 hover:shadow-md hover:border-accent/30 transition-all duration-200">
                <div className="space-y-3">
                  <h3 className="font-semibold text-lg">{schedule.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {schedule.filing_types.name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {schedule.schedule_steps?.length || 0} steps
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <h3 className="text-lg font-medium">No schedules yet</h3>
          <p className="text-sm text-muted-foreground mt-2">
            Create your first reminder schedule to get started.
          </p>
          <Link href="/schedules/new/edit">
            <Button className="mt-4">Create Schedule</Button>
          </Link>
        </div>
      )}
    </div>
  );
}
```

### Example 2: Schedule Step Editor with Reordering
```typescript
// app/(dashboard)/schedules/components/schedule-step-editor.tsx
"use client";

import { useFieldArray, UseFormReturn } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Icon } from "@/components/ui/icon";
import type { ScheduleInput } from "@/lib/validations/schedule";

interface ScheduleStepEditorProps {
  form: UseFormReturn<ScheduleInput>;
  templates: Array<{ id: string; name: string; subject: string }>;
}

const PRESET_DELAYS = [7, 14, 30];
const URGENCY_LEVELS = [
  { value: "low", label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

export function ScheduleStepEditor({ form, templates }: ScheduleStepEditorProps) {
  const { fields, append, remove, move } = useFieldArray({
    control: form.control,
    name: "steps",
  });

  const moveUp = (index: number) => {
    if (index > 0) {
      move(index, index - 1);
    }
  };

  const moveDown = (index: number) => {
    if (index < fields.length - 1) {
      move(index, index + 1);
    }
  };

  const addStep = () => {
    append({
      email_template_id: "",
      delay_days: 7,
      urgency_level: "normal",
    });
  };

  // Check for duplicate templates
  const templateIds = form.watch("steps").map(s => s.email_template_id);
  const duplicates = new Set(
    templateIds.filter((id, index) =>
      templateIds.indexOf(id) !== index && id !== ""
    )
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-base font-semibold">Schedule Steps</Label>
        <Button type="button" variant="outline" size="sm" onClick={addStep}>
          <Icon name="add" size="sm" className="mr-2" />
          Add Step
        </Button>
      </div>

      {duplicates.size > 0 && (
        <div className="rounded-lg border border-status-warning/20 bg-status-warning/10 p-4">
          <p className="text-sm text-status-warning">
            <Icon name="warning" size="sm" className="inline mr-2" />
            Some templates are used in multiple steps. This is allowed but may confuse recipients.
          </p>
        </div>
      )}

      {fields.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No steps yet. Click "Add Step" to create your first reminder.
        </p>
      )}

      <div className="space-y-4">
        {fields.map((field, index) => (
          <div
            key={field.id}
            className="rounded-lg border p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Step {index + 1}</h3>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => moveUp(index)}
                  disabled={index === 0}
                >
                  <Icon name="arrow_upward" size="sm" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => moveDown(index)}
                  disabled={index === fields.length - 1}
                >
                  <Icon name="arrow_downward" size="sm" />
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => remove(index)}
                >
                  <Icon name="delete" size="sm" />
                </Button>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor={`steps.${index}.email_template_id`}>
                  Email Template
                </Label>
                <Select
                  value={form.watch(`steps.${index}.email_template_id`)}
                  onValueChange={(value) =>
                    form.setValue(`steps.${index}.email_template_id`, value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select template" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.steps?.[index]?.email_template_id && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.steps[index].email_template_id?.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor={`steps.${index}.urgency_level`}>
                  Urgency Level
                </Label>
                <Select
                  value={form.watch(`steps.${index}.urgency_level`)}
                  onValueChange={(value) =>
                    form.setValue(`steps.${index}.urgency_level`, value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select urgency" />
                  </SelectTrigger>
                  <SelectContent>
                    {URGENCY_LEVELS.map((level) => (
                      <SelectItem key={level.value} value={level.value}>
                        {level.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Days before deadline</Label>
              <div className="flex gap-2 items-center">
                {PRESET_DELAYS.map((days) => (
                  <Button
                    key={days}
                    type="button"
                    variant={
                      form.watch(`steps.${index}.delay_days`) === days
                        ? "default"
                        : "outline"
                    }
                    size="sm"
                    onClick={() => form.setValue(`steps.${index}.delay_days`, days)}
                  >
                    {days} days
                  </Button>
                ))}
                <span className="text-sm text-muted-foreground">or</span>
                <Input
                  type="number"
                  min={1}
                  max={365}
                  className="w-24"
                  {...form.register(`steps.${index}.delay_days`, {
                    valueAsNumber: true,
                  })}
                />
              </div>
              {form.formState.errors.steps?.[index]?.delay_days && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.steps[index].delay_days?.message}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {form.formState.errors.steps && (
        <p className="text-sm text-destructive">
          {form.formState.errors.steps.message}
        </p>
      )}
    </div>
  );
}
```

### Example 3: Schedule Duplication API Handler
```typescript
// app/api/schedules/[id]/duplicate/route.ts
// Pattern: Server Action for duplicating schedule with all steps
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const scheduleId = params.id;

  try {
    // Fetch original schedule
    const { data: originalSchedule, error: fetchError } = await supabase
      .from("schedules")
      .select("*")
      .eq("id", scheduleId)
      .single();

    if (fetchError) throw fetchError;

    // Fetch original steps
    const { data: originalSteps, error: stepsError } = await supabase
      .from("schedule_steps")
      .select("*")
      .eq("schedule_id", scheduleId)
      .order("step_number", { ascending: true });

    if (stepsError) throw stepsError;

    // Create new schedule with "(Copy)" suffix
    const { data: newSchedule, error: createError } = await supabase
      .from("schedules")
      .insert({
        filing_type_id: originalSchedule.filing_type_id,
        name: `${originalSchedule.name} (Copy)`,
        description: originalSchedule.description,
        is_active: false, // Duplicates start as inactive
      })
      .select()
      .single();

    if (createError) throw createError;

    // Create steps for new schedule
    const newSteps = originalSteps.map((step) => ({
      schedule_id: newSchedule.id,
      email_template_id: step.email_template_id,
      step_number: step.step_number,
      delay_days: step.delay_days,
      urgency_level: step.urgency_level,
    }));

    const { error: stepsInsertError } = await supabase
      .from("schedule_steps")
      .insert(newSteps);

    if (stepsInsertError) throw stepsInsertError;

    return NextResponse.json({ schedule: newSchedule });
  } catch (error) {
    console.error("Failed to duplicate schedule:", error);
    return NextResponse.json(
      { error: "Failed to duplicate schedule" },
      { status: 500 }
    );
  }
}
```

### Example 4: Validation Schema for Schedule
```typescript
// lib/validations/schedule.ts
// Pattern: Zod schema for schedule with nested steps
import { z } from "zod";
import { UrgencyLevel } from "@/lib/types/database";

export const scheduleStepSchema = z.object({
  email_template_id: z.string().uuid("Select an email template"),
  delay_days: z.number().int().min(1).max(365),
  urgency_level: z.enum(["low", "normal", "high", "urgent"]),
});

export const scheduleSchema = z.object({
  filing_type_id: z.enum([
    "corporation_tax_payment",
    "ct600_filing",
    "companies_house",
    "vat_return",
    "self_assessment",
  ] as const),
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().optional(),
  steps: z
    .array(scheduleStepSchema)
    .min(1, "At least 1 step is required")
    .max(10, "Maximum 10 steps allowed"),
  is_active: z.boolean(),
});

export type ScheduleStepInput = z.infer<typeof scheduleStepSchema>;
export type ScheduleInput = z.infer<typeof scheduleSchema>;
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| JSONB-embedded reminder steps in template | Normalized schedule_steps table with FK to email_templates | Phase 4 (v1.1 migration) | Allows template reuse across schedules, cleaner data model, easier to query |
| Auto-derived urgency from step_number | Manual urgency dropdown per step | Phase 7 (user decision) | User has full control, no magical behavior |
| Drag-and-drop reordering | Up/down arrow buttons | Industry shift (2024-2026) | Simpler implementation, fewer bugs, better mobile support |
| react-beautiful-dnd for reordering | @dnd-kit or no drag-and-drop | 2024+ | react-beautiful-dnd has poor useFieldArray integration, @dnd-kit is better but still complex |
| Server Actions with useFormStatus | Server Actions with useActionState | React 19 (2024) | useActionState provides built-in pending and error states |

**Deprecated/outdated:**
- **Drag-and-drop for form field reordering:** Complex integration with React Hook Form, unstable field IDs during drag. Up/down buttons are simpler and more reliable for small lists (5-10 items).
- **react-beautiful-dnd:** Maintenance has slowed, poor integration with React 18+. If drag-and-drop is needed, use @dnd-kit instead.

## Open Questions

1. **Template usage tracking**
   - What we know: ON DELETE RESTRICT prevents deleting templates used in schedule_steps
   - What's unclear: Should we show "used in X schedules" badge on template list page?
   - Recommendation: Not required for Phase 7. Can add in future if users request it. For now, error message on delete attempt is sufficient.

2. **Schedule activation**
   - What we know: Schedules have `is_active` boolean
   - What's unclear: Does activating a schedule automatically create reminder_queue entries? Or is that Phase 9 (queue generation)?
   - Recommendation: Phase 7 only handles schedule CRUD. Queue generation is separate phase. `is_active` is just a flag for now.

3. **Step number gaps after deletion**
   - What we know: User can delete step 2, leaving steps [1, 3, 4]
   - What's unclear: Should we automatically renumber on save? Or allow gaps?
   - Recommendation: Renumber on save to maintain sequential 1-N ordering. Derive step_number from array index when serializing for API.

4. **Migration from old reminder_templates**
   - What we know: Phase 4 created v1.1 tables, Phase 4 migration script copied data
   - What's unclear: Are old reminder_templates still in use, or fully migrated?
   - Recommendation: Check with planner. If migration is complete, Phase 7 only touches v1.1 tables (schedules, schedule_steps, email_templates).

## Sources

### Primary (HIGH confidence)
- [React Hook Form useFieldArray](https://react-hook-form.com/docs/usefieldarray) - API reference for field arrays and reordering
- [Supabase Joins and Nesting](https://supabase.com/docs/guides/database/joins-and-nesting) - Foreign key embedding patterns
- [shadcn/ui Select](https://ui.shadcn.com/docs/components/select) - Dropdown component
- [shadcn/ui Radio Group](https://ui.shadcn.com/docs/components/radio-group) - Radio button component
- Project codebase: `app/(dashboard)/templates/components/template-step-editor.tsx` - Existing field array pattern

### Secondary (MEDIUM confidence)
- [Mastering forms in Next.js 15 and React 19](https://engineering.udacity.com/mastering-forms-in-next-js-15-and-react-19-e3d2d783946b) - Modern form patterns with Server Actions
- [Next.js Server Actions: Complete Guide (2026)](https://medium.com/@saad.minhas.codes/next-js-15-server-actions-complete-guide-with-real-examples-2026-6320fbfa01c3) - Server Actions with useActionState
- [Supabase Cascade Deletes](https://supabase.com/docs/guides/database/postgres/cascade-deletes) - ON DELETE CASCADE behavior
- [Designing Better Error Messages UX](https://www.smashingmagazine.com/2022/08/error-messages-ux-design/) - Warning message best practices
- [Good Defaults design pattern](https://ui-patterns.com/patterns/GoodDefaults) - Preset options UX pattern

### Tertiary (LOW confidence - unverified)
- [React Hook Form Issue #3132](https://github.com/react-hook-form/react-hook-form/issues/3132) - Key stability during reorder (community report, not official docs)
- [Implement useOrderedFieldArray Hook](https://dev.to/rexebin/implement-useorderedfieldarray-hook-for-forms-using-react-hook-form-4fgk) - Custom hook for reordering (blog post, not official pattern)
- [React beautiful drag and drop and useFieldArray issues](https://github.com/orgs/react-hook-form/discussions/3998) - Integration challenges (community discussion)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - React Hook Form, Zod, shadcn/ui are all established in project codebase
- Architecture: HIGH - Patterns verified in official docs and existing codebase (template editor)
- Pitfalls: MEDIUM/HIGH - Key stability and FK join issues verified from official docs + project lessons; stacked actions verified in RHF docs
- Reordering approach: HIGH - move() method is official RHF API; drag-and-drop issues documented in community discussions

**Research date:** 2026-02-08
**Valid until:** 30 days (stable technologies, no fast-moving changes expected)
