# Phase 16: Member Setup Wizard — Context

## User Decisions

### Who sees the wizard?
- **Invited members only** — org creators already have onboarding (steps 1-4)
- After invite acceptance, redirect to setup wizard instead of dashboard

### Is it skippable?
- **Not skippable** — must complete all steps before accessing the dashboard

### Wizard Steps

#### Step 1: Import Clients (CSV)
- Full-page version of the existing CSV import dialog (`csv-import-dialog.tsx`)
- Same flow: upload → column mapping → edit/review data → import → results
- NOT inside a popup/dialog — rendered as a full page within the wizard
- Reuse the same server action (`importClientMetadata`) and validation logic

#### Step 2: Configuration
- **Send hour picker** — same pattern as settings page `SendHourPicker` (6am-9pm dropdown)
- **Inbound email configuration** — same pattern as settings page `InboundCheckerCard` (auto/recommend mode)
- **Email settings** — same pattern as `MemberSettingsCard` (sender name, sender email, reply-to)
  - Note: UI built now, backend already wired from Phase 15 (`updateUserSendHour`, `updateUserEmailSettings`)
- Look to settings page for how all of these should look in the wizard

### Post-wizard
- After completing both steps, redirect to dashboard
- Mark setup as complete (prevent re-showing wizard on future logins)

### Design Patterns
- Use existing `WizardStepper` component for progress indication
- Follow card layout patterns from settings page
- Follow DESIGN.md guidelines for all UI components
