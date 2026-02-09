---
phase: quick
plan: 002
type: execute
wave: 1
depends_on: []
autonomous: true
files_modified:
  - app/(dashboard)/clients/components/create-client-dialog.tsx
  - app/(dashboard)/clients/components/client-table.tsx
  - app/api/clients/route.ts
  - lib/validations/client.ts

must_haves:
  truths:
    - "User can click an 'Add Client' button in the clients toolbar to open a creation dialog"
    - "User can fill in company name, email, client type, and year end date to create a client"
    - "Validation prevents creation without company name or with invalid email"
    - "After creation, the new client appears in the client table without a full page reload"
    - "New demo client can receive test emails via the existing Send Email flow"
  artifacts:
    - path: "app/(dashboard)/clients/components/create-client-dialog.tsx"
      provides: "Modal dialog with form fields for creating a new client"
    - path: "app/api/clients/route.ts"
      provides: "POST handler for creating a client row in Supabase"
    - path: "lib/validations/client.ts"
      provides: "Zod schema for client creation input validation"
  key_links:
    - from: "app/(dashboard)/clients/components/create-client-dialog.tsx"
      to: "/api/clients"
      via: "fetch POST on form submit"
      pattern: "fetch.*api/clients.*POST"
    - from: "app/(dashboard)/clients/components/client-table.tsx"
      to: "create-client-dialog.tsx"
      via: "Add Client button opens dialog, onCreated callback inserts new row into data state"
      pattern: "CreateClientDialog"
---

<objective>
Add a "Create Demo Client" dialog to the clients page so users can quickly scaffold test clients for email sending verification. The dialog provides a minimal form (company name, email, client type, year end date) and inserts the client row via a new POST endpoint on the existing /api/clients route.

Purpose: Enable rapid creation of demo clients for testing the full email sending pipeline without needing CSV import or external data sources.
Output: Create client dialog component, POST API endpoint with validation, and integration into the client table toolbar.
</objective>

<execution_context>
@C:\Users\ejsch\.claude/get-shit-done/workflows/execute-plan.md
@C:\Users\ejsch\.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@app/actions/clients.ts
@app/api/clients/route.ts
@app/(dashboard)/clients/components/client-table.tsx
@app/(dashboard)/clients/components/send-email-modal.tsx
@lib/validations/client.ts
@lib/types/database.ts
@components/ui/dialog.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create client validation schema and POST API endpoint</name>
  <files>
    lib/validations/client.ts
    app/api/clients/route.ts
  </files>
  <action>
    1. In `lib/validations/client.ts`, add a new `createClientSchema` Zod schema:
       - `company_name`: string, min 1 char, max 200 chars, trimmed (required)
       - `primary_email`: string, valid email format (required - needed for demo email testing)
       - `client_type`: reuse existing `clientTypeSchema` (required)
       - `year_end_date`: ISO date string YYYY-MM-DD format (optional, nullable)
       - `vat_registered`: boolean, default false (optional)
       - `display_name`: string, max 200 chars, trimmed (optional, nullable) - if provided, this is what shows in the table
       Export the schema and its inferred type as `CreateClientInput`.

    2. In `app/api/clients/route.ts`, add a POST handler alongside the existing GET:
       - Parse and validate request body with `createClientSchema`
       - On validation failure, return 400 with `{ error: string }` containing the Zod issue messages
       - Insert into `clients` table using Supabase client. Set these fields:
         - `company_name`, `primary_email`, `client_type`, `year_end_date`, `vat_registered`, `display_name` from validated input
         - `quickbooks_id`: generate a unique placeholder like `DEMO-{timestamp}` (this field is non-nullable in the schema but demo clients are not from QuickBooks)
         - `active`: true
         - `reminders_paused`: false
       - Use `.select().single()` to return the created row
       - On Supabase error, return 500 with `{ error: string }`
       - On success, return 201 with the created client object
  </action>
  <verify>
    Run `npx tsc --noEmit` to confirm no type errors. Verify the validation schema exports correctly by checking the file compiles.
  </verify>
  <done>
    POST /api/clients accepts valid client data and returns 201 with the new client row. Invalid data returns 400 with descriptive error messages. The createClientSchema is exported from lib/validations/client.ts.
  </done>
</task>

<task type="auto">
  <name>Task 2: Create client dialog component and integrate into client table toolbar</name>
  <files>
    app/(dashboard)/clients/components/create-client-dialog.tsx
    app/(dashboard)/clients/components/client-table.tsx
  </files>
  <action>
    1. Create `app/(dashboard)/clients/components/create-client-dialog.tsx`:
       - "use client" component
       - Props: `open: boolean`, `onOpenChange: (open: boolean) => void`, `onCreated: (client: Client) => void`
       - Import Dialog/DialogContent/DialogHeader/DialogTitle/DialogDescription/DialogFooter from `@/components/ui/dialog`
       - Import Input from `@/components/ui/input`, Label from `@/components/ui/label`
       - Import Select/SelectContent/SelectItem/SelectTrigger/SelectValue from `@/components/ui/select`
       - Import ButtonBase from `@/components/ui/button-base`
       - Import Client type from `@/app/actions/clients`
       - Import toast from sonner, Loader2 from lucide-react

       Form fields (use controlled state):
       - Company Name (Input, required) - text input
       - Display Name (Input, optional) - text input, placeholder "Optional - shown in table if set"
       - Email (Input, required, type="email") - text input
       - Client Type (Select, required) - options: Limited Company, Sole Trader, Partnership, LLP
       - Year End Date (Input, type="date", optional)
       - VAT Registered (checkbox input, optional, default false)

       On submit:
       - Set loading state, disable submit button, show Loader2 spinner
       - POST to `/api/clients` with JSON body
       - On success (201): call `onCreated(data)`, show toast.success("Client created"), reset form, close dialog via `onOpenChange(false)`
       - On error (4xx/5xx): parse error from response JSON, show toast.error with the message
       - Finally: clear loading state

       Reset all form fields when dialog closes (useEffect on `open` changing to false).

       Style the form with space-y-4 for field spacing. Each field should have a Label above the input. Use the same visual patterns as send-email-modal.tsx (DialogHeader, DialogFooter with Cancel and Create buttons using ButtonBase with buttonType="text-only").

    2. Integrate into `app/(dashboard)/clients/components/client-table.tsx`:
       - Import CreateClientDialog component (use next/dynamic with ssr:false, same pattern as CsvImportDialog)
       - Add state: `const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);`
       - Add an "Add Client" button in the controls toolbar (the `div` with `flex gap-2 sm:ml-auto items-center`), positioned BEFORE the Edit button. Use IconButtonWithText with variant="emerald" (or "sky" if emerald doesn't exist - check the component). Use the `Plus` icon from lucide-react. Button text: "Add Client". onClick opens the dialog.
       - Add the `handleClientCreated` callback: receives the new Client object, adds it to the `data` state array via `setData(prev => [...prev, newClient])`, and calls `router.refresh()` to update status map from server.
       - Render `<CreateClientDialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen} onCreated={handleClientCreated} />` alongside the other modals at the bottom of the component.
  </action>
  <verify>
    Run `npx tsc --noEmit` to confirm no type errors. Run `npm run build` to confirm the build succeeds. Visually verify by running the dev server and confirming the "Add Client" button appears in the toolbar and the dialog opens with all form fields.
  </verify>
  <done>
    An "Add Client" button appears in the clients toolbar. Clicking it opens a dialog with form fields for company name, display name, email, client type, year end date, and VAT registered. Submitting the form creates the client via POST /api/clients. The new client appears in the table immediately. The dialog shows loading state during submission and validation errors on failure.
  </done>
</task>

</tasks>

<verification>
1. `npx tsc --noEmit` passes with no errors
2. `npm run build` completes successfully
3. Navigate to /clients - "Add Client" button visible in toolbar
4. Click "Add Client" - dialog opens with all form fields
5. Submit with empty company name - validation error shown
6. Submit with invalid email - validation error shown
7. Fill valid data and submit - client created, toast shown, dialog closes, client appears in table
8. Click into the new client row - client detail page loads
9. Select the new client, click "Send Email" - email sending flow works with the demo client's email
</verification>

<success_criteria>
- Demo client can be created from the clients page in under 30 seconds
- Created client has a valid email address and can receive test emails
- Form validates required fields before submission
- New client appears in table without page reload
- No TypeScript or build errors introduced
</success_criteria>

<output>
After completion, create `.planning/quick/002-demo-client-creation/002-SUMMARY.md`
</output>
