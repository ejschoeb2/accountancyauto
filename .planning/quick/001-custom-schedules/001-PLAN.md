---
phase: quick
plan: 001
type: execute
wave: 1
depends_on: []
autonomous: true
files_modified:
  - supabase/migrations/20260209200000_add_custom_schedules.sql
  - lib/types/database.ts
  - lib/validations/schedule.ts
  - app/api/schedules/route.ts
  - app/api/schedules/[id]/route.ts
  - app/(dashboard)/schedules/page.tsx
  - app/(dashboard)/schedules/[id]/edit/page.tsx
  - app/(dashboard)/schedules/components/filing-type-list.tsx
  - app/(dashboard)/schedules/components/custom-schedule-list.tsx
  - lib/reminders/queue-builder.ts
  - lib/reminders/scheduler.ts

must_haves:
  truths:
    - "User can create a custom schedule with a name, target date, and optional recurrence"
    - "User can see custom schedules listed separately from filing type schedules"
    - "User can edit and delete custom schedules"
    - "Custom schedules with target dates generate reminder queue entries"
    - "Filing type schedules continue to work exactly as before"
  artifacts:
    - path: "supabase/migrations/20260209200000_add_custom_schedules.sql"
      provides: "Schema changes: schedule_type, custom_date, recurrence_rule, recurrence_anchor columns; nullable filing_type_id"
    - path: "app/(dashboard)/schedules/components/custom-schedule-list.tsx"
      provides: "Custom schedules listing component"
    - path: "lib/validations/schedule.ts"
      provides: "Discriminated union validation for filing vs custom schedules"
  key_links:
    - from: "app/(dashboard)/schedules/page.tsx"
      to: "custom-schedule-list.tsx"
      via: "renders custom schedules section below filing type cards"
      pattern: "CustomScheduleList"
    - from: "lib/reminders/queue-builder.ts"
      to: "schedules table"
      via: "handles both filing and custom schedule types when building queue"
      pattern: "schedule_type.*custom"
---

<objective>
Add custom schedules - schedules not linked to any HMRC filing type that fire on user-defined dates. This lets the accounting firm create reminders for things like "send client year-end pack", payroll deadlines, or ad-hoc chase reminders.

Purpose: Extend the reminder system beyond the 5 hardcoded HMRC filing types to support arbitrary user-defined reminder schedules.
Output: Schema migration, updated types/validation, API changes, new UI section for custom schedules, and queue builder support.
</objective>

<execution_context>
@C:\Users\ejsch\.claude/get-shit-done/workflows/execute-plan.md
@C:\Users\ejsch\.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@lib/types/database.ts
@lib/validations/schedule.ts
@app/api/schedules/route.ts
@app/api/schedules/[id]/route.ts
@app/(dashboard)/schedules/page.tsx
@app/(dashboard)/schedules/[id]/edit/page.tsx
@app/(dashboard)/schedules/components/filing-type-list.tsx
@app/(dashboard)/schedules/components/schedule-step-editor.tsx
@lib/reminders/queue-builder.ts
@lib/reminders/scheduler.ts
@lib/deadlines/calculators.ts
@supabase/migrations/20260208000001_create_v11_normalized_tables.sql
</context>

<tasks>

<task type="auto">
  <name>Task 1: Schema migration, types, and validation</name>
  <files>
    supabase/migrations/20260209200000_add_custom_schedules.sql
    lib/types/database.ts
    lib/validations/schedule.ts
  </files>
  <action>
**Migration (supabase/migrations/20260209200000_add_custom_schedules.sql):**

1. Add `schedule_type` column to `schedules` table:
   ```sql
   ALTER TABLE schedules ADD COLUMN schedule_type TEXT NOT NULL DEFAULT 'filing'
     CHECK (schedule_type IN ('filing', 'custom'));
   ```

2. Make `filing_type_id` nullable (currently NOT NULL via the REFERENCES + UNIQUE constraint). The column is defined as `TEXT REFERENCES filing_types(id) ON DELETE CASCADE UNIQUE` -- it allows NULL already (no NOT NULL), but the UNIQUE constraint will cause issues with multiple custom schedules having NULL. Fix:
   ```sql
   -- Drop the existing unique constraint on filing_type_id
   ALTER TABLE schedules DROP CONSTRAINT IF EXISTS schedules_filing_type_id_key;
   -- Add a partial unique constraint: only enforce uniqueness for filing schedules
   CREATE UNIQUE INDEX schedules_filing_type_id_unique ON schedules (filing_type_id) WHERE filing_type_id IS NOT NULL;
   ```

3. Add custom schedule columns:
   ```sql
   ALTER TABLE schedules ADD COLUMN custom_date DATE;
   ALTER TABLE schedules ADD COLUMN recurrence_rule TEXT CHECK (recurrence_rule IS NULL OR recurrence_rule IN ('monthly', 'quarterly', 'annually'));
   ALTER TABLE schedules ADD COLUMN recurrence_anchor DATE;
   ```

4. Add CHECK constraint for schedule type consistency:
   ```sql
   ALTER TABLE schedules ADD CONSTRAINT schedules_type_check CHECK (
     (schedule_type = 'filing' AND filing_type_id IS NOT NULL)
     OR
     (schedule_type = 'custom' AND filing_type_id IS NULL AND (custom_date IS NOT NULL OR (recurrence_rule IS NOT NULL AND recurrence_anchor IS NOT NULL)))
   );
   ```

5. Add RLS policy for anon access (matching existing pattern):
   ```sql
   -- If there's no existing anon policy on schedules, check first. The v1.1 migration should have one.
   -- Only add if missing.
   ```

**Types (lib/types/database.ts):**

Update the `Schedule` interface:
```typescript
export type ScheduleType = 'filing' | 'custom';
export type RecurrenceRule = 'monthly' | 'quarterly' | 'annually';

export interface Schedule {
  id: string;
  schedule_type: ScheduleType;
  filing_type_id: FilingTypeId | null;  // null for custom schedules
  name: string;
  description: string | null;
  is_active: boolean;
  custom_date: string | null;           // YYYY-MM-DD, for one-off custom schedules
  recurrence_rule: RecurrenceRule | null;
  recurrence_anchor: string | null;     // YYYY-MM-DD, base date for recurrence
  created_at: string;
  updated_at: string;
}
```

**Validation (lib/validations/schedule.ts):**

Replace the single schema with a discriminated union:

```typescript
const baseFields = {
  name: z.string().min(1, "Name is required").max(100, "Name must be 100 characters or less"),
  description: z.string().optional(),
  steps: z.array(scheduleStepSchema),
  is_active: z.boolean(),
};

export const filingScheduleSchema = z.object({
  ...baseFields,
  schedule_type: z.literal('filing'),
  filing_type_id: z.enum([...] as const),  // existing 5 filing types
  custom_date: z.null().optional(),
  recurrence_rule: z.null().optional(),
  recurrence_anchor: z.null().optional(),
});

export const customScheduleSchema = z.object({
  ...baseFields,
  schedule_type: z.literal('custom'),
  filing_type_id: z.null().optional(),
  custom_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD format").nullable().optional(),
  recurrence_rule: z.enum(['monthly', 'quarterly', 'annually']).nullable().optional(),
  recurrence_anchor: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD format").nullable().optional(),
}).refine(
  (data) => data.custom_date || (data.recurrence_rule && data.recurrence_anchor),
  { message: "Custom schedules require either a target date or a recurrence rule with anchor date" }
);

export const scheduleSchema = z.discriminatedUnion('schedule_type', [
  filingScheduleSchema,
  customScheduleSchema,
]);
```

Keep the old `ScheduleInput` type working by deriving from the union: `export type ScheduleInput = z.infer<typeof scheduleSchema>;`

IMPORTANT: The existing `scheduleSchema` is imported by the API routes and the edit page. The new discriminated union must be a drop-in replacement. The old schema had no `schedule_type` field, so the API routes will need updating (Task 2) to handle both shapes. For backward compatibility during the transition, also export `filingScheduleSchema` and `customScheduleSchema` individually.
  </action>
  <verify>
    Run `npx tsc --noEmit` to confirm types compile without errors. Visually inspect the migration SQL for correctness.
  </verify>
  <done>
    - Migration file exists with all ALTER TABLE statements and constraints
    - Schedule interface includes schedule_type, custom_date, recurrence_rule, recurrence_anchor
    - Zod schema is a discriminated union that validates both filing and custom schedules
    - TypeScript compiles cleanly
  </done>
</task>

<task type="auto">
  <name>Task 2: API routes and queue builder updates</name>
  <files>
    app/api/schedules/route.ts
    app/api/schedules/[id]/route.ts
    lib/reminders/queue-builder.ts
    lib/reminders/scheduler.ts
  </files>
  <action>
**API - POST /api/schedules (app/api/schedules/route.ts):**

Update the POST handler to accept both filing and custom schedule types:
- Use the new `scheduleSchema` (discriminated union) for validation -- this is already imported, just needs the data to include `schedule_type`.
- When inserting into the `schedules` table, include the new columns:
  - `schedule_type`: from validated data
  - `filing_type_id`: from validated data (null for custom)
  - `custom_date`: from validated data (null for filing)
  - `recurrence_rule`: from validated data (null for filing)
  - `recurrence_anchor`: from validated data (null for filing)
- The unique constraint error handling (code 23505) should still work but update the error message to be more generic: "A schedule already exists for this filing type" (only relevant for filing schedules).

Update the GET handler: no changes needed (it already fetches all schedules with `select("*")`).

**API - PUT /api/schedules/[id] (app/api/schedules/[id]/route.ts):**

Update the PUT handler:
- Use new `scheduleSchema` for validation.
- Include new columns in the update: `schedule_type`, `filing_type_id`, `custom_date`, `recurrence_rule`, `recurrence_anchor`.
- `schedule_type` should NOT be changeable after creation (a filing schedule can't become custom). Add a check: fetch the existing schedule first, compare `schedule_type`, reject with 400 if they differ.

GET and DELETE handlers need no changes.

**Queue Builder (lib/reminders/queue-builder.ts):**

The `buildReminderQueue` function currently only processes filing type schedules via `client_filing_assignments`. Custom schedules need a separate processing path.

Add a new function `buildCustomScheduleQueue`:
```typescript
export async function buildCustomScheduleQueue(supabase: SupabaseClient): Promise<BuildResult> {
  // 1. Fetch all active custom schedules (schedule_type = 'custom')
  // 2. Fetch all active clients (custom schedules apply to ALL clients - they're global)
  // 3. For each custom schedule:
  //    a. Determine the target date:
  //       - If custom_date is set: use it directly
  //       - If recurrence_rule + recurrence_anchor: calculate the NEXT occurrence from today
  //         - 'monthly': find next month's anchor day from today
  //         - 'quarterly': find next quarter's anchor day from today
  //         - 'annually': find next year's anchor day from today
  //    b. For each client (not paused):
  //       - For each step in the schedule:
  //         - Calculate send_date = target_date - delay_days
  //         - Adjust to next working day
  //         - Check idempotency (same client_id + schedule_id + step_index + deadline_date)
  //         - Insert into reminder_queue with filing_type_id = NULL
  // 4. Return { created, skipped }
}
```

For the recurrence date calculation, add a helper:
```typescript
function getNextCustomDate(schedule: { custom_date: string | null; recurrence_rule: string | null; recurrence_anchor: string | null }): Date | null {
  if (schedule.custom_date) {
    return new UTCDate(schedule.custom_date);
  }
  if (!schedule.recurrence_rule || !schedule.recurrence_anchor) return null;

  const anchor = new UTCDate(schedule.recurrence_anchor);
  const today = new UTCDate();

  // Find the next occurrence of the anchor date based on recurrence rule
  // Start from anchor and keep adding intervals until we're past today
  let next = anchor;
  while (next <= today) {
    switch (schedule.recurrence_rule) {
      case 'monthly': next = addMonths(next, 1); break;
      case 'quarterly': next = addMonths(next, 3); break;
      case 'annually': next = addYears(next, 1); break;
    }
  }
  return next;
}
```

IMPORTANT: The `reminder_queue` table has `filing_type_id TEXT REFERENCES filing_types(id)` -- this is a FK constraint. Custom schedule reminders have NO filing type. The current column allows NULL (no NOT NULL constraint), so inserting NULL is fine. But the idempotency check in the queue builder currently uses `filing_type_id` -- for custom schedules, use `template_id` (which stores the schedule ID) instead. Update the idempotency check to handle both cases:
- For filing schedules: check client_id + filing_type_id + step_index + deadline_date (existing)
- For custom schedules: check client_id + template_id + step_index + deadline_date (template_id stores schedule.id)

Call `buildCustomScheduleQueue` from `buildReminderQueue` at the end, or call it separately from the scheduler.

**Scheduler (lib/reminders/scheduler.ts):**

In `processReminders`, after the existing `buildReminderQueue` call (line ~82), also call `buildCustomScheduleQueue`:
```typescript
const customBuildResult = await buildCustomScheduleQueue(supabase);
```

The rest of the scheduler (marking pending, resolving templates) already works generically on `reminder_queue` rows, EXCEPT:
- Line ~125-130: It fetches the schedule by `filing_type_id`. For custom schedule reminders (where `filing_type_id` is NULL), it should instead look up the schedule using `template_id` (which stores the schedule UUID). Update this lookup:
  ```typescript
  // For custom schedules, template_id IS the schedule id
  let schedule;
  if (reminder.filing_type_id) {
    // Filing schedule - lookup by filing_type_id
    const { data } = await supabase.from('schedules').select('*')
      .eq('filing_type_id', reminder.filing_type_id).eq('is_active', true).single();
    schedule = data;
  } else {
    // Custom schedule - lookup by template_id (which stores schedule.id)
    const { data } = await supabase.from('schedules').select('*')
      .eq('id', reminder.template_id).eq('is_active', true).single();
    schedule = data;
  }
  ```

- Line ~88: The query `select('*, clients!inner(*), filing_types!inner(*)')` uses `!inner` join on `filing_types` which will EXCLUDE rows where `filing_type_id` is NULL. Change to a left join for filing_types: `select('*, clients!inner(*), filing_types(*)')` (remove `!inner` from filing_types). Then handle the case where `filing_types` is null in the template rendering context (line ~176): use the schedule name instead of filing type name for the `filing_type` template variable.

- Skip the rollover logic (Step 7) for custom schedule reminders -- rollover only applies to HMRC filing type deadlines.
  </action>
  <verify>
    Run `npx tsc --noEmit` to confirm no type errors. Run `npm run build` (or `npx next build`) to verify the full build succeeds.
  </verify>
  <done>
    - POST /api/schedules accepts both `schedule_type: 'filing'` and `schedule_type: 'custom'`
    - PUT /api/schedules/[id] handles custom schedule fields and prevents type changes
    - Queue builder creates reminder queue entries for custom schedules with correct date calculation
    - Scheduler resolves templates for custom schedule reminders (using schedule name as filing_type placeholder)
    - Existing filing schedule behavior is completely unchanged
  </done>
</task>

<task type="auto">
  <name>Task 3: UI - Custom schedules section and edit form updates</name>
  <files>
    app/(dashboard)/schedules/page.tsx
    app/(dashboard)/schedules/[id]/edit/page.tsx
    app/(dashboard)/schedules/components/custom-schedule-list.tsx
    app/(dashboard)/schedules/components/filing-type-list.tsx
  </files>
  <action>
**Custom Schedule List Component (app/(dashboard)/schedules/components/custom-schedule-list.tsx):**

Create a new client component that displays custom schedules in a card grid similar to `filing-type-list.tsx` but simpler:

Props:
```typescript
interface CustomScheduleListProps {
  schedules: Array<{
    id: string;
    name: string;
    description: string | null;
    is_active: boolean;
    custom_date: string | null;
    recurrence_rule: string | null;
    recurrence_anchor: string | null;
    steps: StepDisplay[];  // reuse StepDisplay from filing-type-list
  }>;
}
```

Each card shows:
- Schedule name as card title
- Description as card description (if present)
- Active/Inactive badge (same styling as filing-type-list)
- Date info: Either "Target: {custom_date}" or "Recurs: {recurrence_rule} from {recurrence_anchor}" in text-muted-foreground
- Steps list (same format as filing-type-list: numbered with template name and delay days)
- Delete button (same pattern as filing-type-list with `confirm()` dialog)
- Clicking card navigates to `/schedules/{id}/edit`
- "Create Custom Schedule" button at the top right of the section (links to `/schedules/new/edit?type=custom`)

Use the same Card, Badge, Button, Icon, toast imports as filing-type-list. Follow the same styling patterns exactly.

Also add an empty state: "No custom schedules yet. Create one to send reminders for anything beyond HMRC filings."

**Schedules Page (app/(dashboard)/schedules/page.tsx):**

Update the page to:
1. After fetching schedules, separate them into filing and custom:
   ```typescript
   const filingSchedules = (schedules as Schedule[] | null)?.filter(s => s.schedule_type !== 'custom') ?? [];
   const customSchedules = (schedules as Schedule[] | null)?.filter(s => s.schedule_type === 'custom') ?? [];
   ```
   Note: Existing schedules won't have `schedule_type` until migration runs, so treat missing/null as 'filing' (`s.schedule_type !== 'custom'`).

2. Build `scheduleMap` only from `filingSchedules` (not custom ones). The existing `for (const s of ...)` loop on line 56 currently iterates all schedules -- filter to filing only.

3. Build custom schedule display data:
   ```typescript
   const customScheduleDisplays = customSchedules.map(s => ({
     id: s.id,
     name: s.name,
     description: s.description,
     is_active: s.is_active,
     custom_date: s.custom_date,
     recurrence_rule: s.recurrence_rule,
     recurrence_anchor: s.recurrence_anchor,
     steps: stepsBySchedule[s.id] ?? [],
   }));
   ```

4. Add the CustomScheduleList below the FilingTypeList:
   ```tsx
   <FilingTypeList ... />

   {/* Custom Schedules section */}
   <div className="space-y-4">
     <div className="flex items-center justify-between">
       <div className="space-y-1">
         <h2>Custom Schedules</h2>
         <p className="text-muted-foreground text-sm">
           Reminders for anything beyond HMRC filing types
         </p>
       </div>
       <Link href="/schedules/new/edit?type=custom">
         <Button variant="outline">
           <Icon name="add" size="sm" className="mr-1.5" />
           Create Custom Schedule
         </Button>
       </Link>
     </div>
     <CustomScheduleList schedules={customScheduleDisplays} />
   </div>
   ```

**Edit Page (app/(dashboard)/schedules/[id]/edit/page.tsx):**

This is the most complex UI change. The form needs to handle both schedule types.

1. Read `type` from searchParams: `const scheduleType = searchParams.get('type') === 'custom' ? 'custom' : 'filing';`

2. Update `useForm` default values to include new fields:
   ```typescript
   defaultValues: {
     schedule_type: isNew ? scheduleType : 'filing',  // will be overwritten on load
     filing_type_id: defaultFilingTypeId,
     name: '',
     description: '',
     steps: [],
     is_active: true,
     custom_date: null,
     recurrence_rule: null,
     recurrence_anchor: null,
   }
   ```

3. Use `form.watch('schedule_type')` to conditionally render fields:
   - If `schedule_type === 'filing'`: Show Filing Type dropdown (existing behavior)
   - If `schedule_type === 'custom'`: Show date configuration instead:
     - Radio/select for "One-off date" vs "Recurring"
     - If one-off: Date input for `custom_date`
     - If recurring: Select for `recurrence_rule` (Monthly/Quarterly/Annually) + Date input for `recurrence_anchor`

4. For the date inputs, use standard `<Input type="date" />` -- the project doesn't have a date picker component, and a native HTML date input is fine for this.

5. When loading an existing schedule, the `form.reset()` call needs to include the new fields from the API response.

6. The schedule_type should be shown but NOT editable when editing (same pattern as filing_type_id being disabled for existing schedules). Show a label like "Type: Custom Schedule" or "Type: Filing Schedule".

7. For new custom schedules, do NOT show the Filing Type dropdown at all. For new filing schedules, do NOT show the date/recurrence fields.

**Filing Type List (app/(dashboard)/schedules/components/filing-type-list.tsx):**

No changes needed to this component itself. The page will simply pass only filing schedules to its `scheduleMap` prop.
  </action>
  <verify>
    Run `npm run build` to verify the full build succeeds with no errors. Then run `npm run dev` and manually verify:
    1. Navigate to /schedules - filing type cards display as before
    2. "Custom Schedules" section appears below with empty state
    3. Click "Create Custom Schedule" - form shows custom schedule fields (date/recurrence), NOT filing type dropdown
    4. Create a custom schedule with a target date and 1 step - saves successfully
    5. Custom schedule appears in the custom schedules section
    6. Click to edit - form loads with correct data
    7. Existing filing type schedules still work (create/edit/delete)
  </verify>
  <done>
    - Custom schedules section appears below filing type cards on /schedules
    - Users can create one-off or recurring custom schedules
    - Edit form adapts based on schedule type
    - Filing type schedules are visually and functionally unchanged
    - Empty state shown when no custom schedules exist
  </done>
</task>

</tasks>

<verification>
1. `npx tsc --noEmit` passes with zero errors
2. `npm run build` succeeds
3. Filing type schedule CRUD works identically to before (regression check)
4. Can create a custom schedule with a one-off date
5. Can create a custom schedule with monthly/quarterly/annually recurrence
6. Custom schedules appear in their own section on /schedules
7. Custom schedule reminder queue entries are created by the queue builder
</verification>

<success_criteria>
- Schema supports both filing and custom schedules with proper constraints
- All existing filing schedule functionality is unchanged (zero regressions)
- Custom schedules can be created, edited, and deleted via UI
- Queue builder generates reminder entries for custom schedules
- Scheduler resolves templates for custom schedule reminders
</success_criteria>

<output>
After completion, create `.planning/quick/001-custom-schedules/001-SUMMARY.md`
</output>
