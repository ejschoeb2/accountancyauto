# SECTION 1: Setup Wizard QA Report
*Tested: 2026-03-03 | Tester: Antigravity QA Agent | App: http://localhost:3000/setup/wizard*

---

## ISSUES FOUND

| # | Severity | Step | Issue |
|---|----------|------|-------|
| 1 | 🔴 HIGH | Import Clients (Step 3) | **No "Next Step" button in empty state.** When the upload area is shown with no file uploaded, there is only a "Back" button — no way to skip or proceed. The "Import 3 Clients" button only appears after data is uploaded/previewed. Users with no data to import have no escape route. |
| 2 | 🟡 MEDIUM | Plan Selection (Step 2) | **Mobile layout squashes plan cards.** At 375px viewport, all 5 plan cards are forced into a horizontal row and become extremely narrow/hard to read. Cards do not stack vertically on mobile. |
| 3 | 🟡 MEDIUM | Client Portal (Step 5) | **Selection does not persist on Back navigation.** After selecting "Yes, enable the client portal" and clicking Next, then clicking Back to return to Step 5, the dropdown resets to "Select an option…" — the choice is lost. |
| 4 | 🟡 MEDIUM | All Steps (Mobile) | **Horizontal stepper overflows on small screens.** At 375px, the 7-step stepper at the top of the wizard clips/overflows — later steps (Storage, Complete) are cut off and not fully visible. |
| 5 | 🟠 LOW | Email Setup (Step 4) | **Raw Postmark API error exposed to user.** When an invalid/public domain is submitted, the error message surfaces raw backend JSON: `Postmark createDomain failed (422): {"ErrorCode":503,"Message":"You can't use public domains."}`. This should be a friendly, user-readable error message. |
| 6 | 🟠 LOW | All Steps | **"Saving…" state takes 5+ seconds on step transitions**, which may make users believe the page is frozen. No loading skeleton or progress indicator is shown during this delay. |

---

## STEPS VERIFIED

| Step | Check |
|------|-------|
| **Step 1: Firm Details** | ✅ Firm name input renders with correct label and placeholder |
| **Step 1: Firm Details** | ✅ URL slug auto-generates from firm name as you type |
| **Step 1: Firm Details** | ✅ Slug availability checker fires after typing stops (shows loading → success/taken) |
| **Step 1: Firm Details** | ✅ Special characters (O'Brien & Co.) are sanitised out of the slug correctly |
| **Step 1: Firm Details** | ✅ Clearing the firm name shows a visual/validation indicator |
| **Step 1: Firm Details** | ✅ "Next" is blocked when firm name is empty — validation fires with clear message |
| **Step 1: Firm Details** | ✅ "Back" button on Step 1 does nothing (no crash, correct behaviour) |
| **Step 2: Plan Selection** | ✅ All 5 plan tiers render: Free (£0), Solo (£19/mo), Starter (£39/mo), Practice (£69/mo), Firm (£109/mo) |
| **Step 2: Plan Selection** | ✅ Selecting a plan visually updates the card (purple border + "Selected" button with checkmark) |
| **Step 2: Plan Selection** | ✅ Each card shows: name, price in £/month, client range, and description copy |
| **Step 2: Plan Selection** | ✅ "All prices exclude VAT" disclaimer present |
| **Step 2: Plan Selection** | ✅ "Next Step" button is disabled until a plan is selected |
| **Step 2: Plan Selection** | ✅ Free plan shows £0 consistently |
| **Step 3: Import Clients** | ✅ Upload area renders with drag-drop zone ("Click to upload or drag and drop") |
| **Step 3: Import Clients** | ✅ Accepted file types listed: CSV or Excel (.csv, .xlsx) — max 1MB |
| **Step 3: Import Clients** | ✅ Required and optional column fields are clearly documented on screen |
| **Step 3: Import Clients** | ✅ "Download Template Table" button present and triggers download |
| **Step 3: Import Clients** | ✅ After uploading data, a review/edit table renders with all expected columns (Company Name, Email, Client Type, Year End, VAT Registered, VAT Stagger, VAT Scheme) |
| **Step 3: Import Clients** | ✅ Each row in the preview table has editable inputs |
| **Step 3: Import Clients** | ✅ "Import 3 Clients" confirm button appears after file upload |
| **Step 4: Email Setup** | ✅ Step renders "Email identity & reminder settings" section |
| **Step 4: Email Setup** | ✅ Sender Name field present (pre-filled with org name "Prompt") |
| **Step 4: Email Setup** | ✅ Sender Email field present (prefix + @domain.accountants format) |
| **Step 4: Email Setup** | ✅ Reply-To Address field present with same format |
| **Step 4: Email Setup** | ✅ Send Hour (UK time) dropdown present, pre-set to 9:00 AM |
| **Step 4: Email Setup** | ✅ Explanatory help text under each field |
| **Step 4: Email Setup** | ✅ "Next Step" and "Back" buttons present and functional |
| **Step 4: Email Setup** | ✅ DNS/domain verify sub-step renders with DKIM and Return-Path records |
| **Step 5: Client Portal** | ✅ Step renders with enable/disable dropdown |
| **Step 5: Client Portal** | ✅ Explanatory text about what the client portal does is present |
| **Step 5: Client Portal** | ✅ Selecting "Yes, enable" visually updates the dropdown |
| **Step 6: Storage Setup** | ✅ All 4 storage options render: Supabase Storage (Active), Google Drive (Connect), Microsoft OneDrive (Connect), Dropbox (Connect) |
| **Step 6: Storage Setup** | ✅ Supabase Storage shown as "Active" by default (built-in fallback) |
| **Step 6: Storage Setup** | ✅ Step is clearly labelled as optional — copy explains documents are held in built-in storage if skipped |
| **Step 6: Storage Setup** | ✅ "Continue" button present — does not require a provider to be connected |
| **Step 6: Storage Setup** | ✅ "Back" button present and navigates back correctly |
| **Step 6: Storage Setup** | ✅ Storage step renders cleanly on mobile (content readable, though stepper clips) |
| **Step 7: Completion** | ✅ "Setup complete!" success message displayed |
| **Step 7: Completion** | ✅ Summary checklist of completed wizard tasks shown |
| **Step 7: Completion** | ✅ "Go to Dashboard" CTA button is present and clearly placed |
| **Stepper / Progress** | ✅ Stepper accurately reflects current step (number highlighted, label bolded) |
| **Stepper / Progress** | ✅ Completed steps show green checkmark circle, clearly distinct from upcoming steps |
| **Stepper / Progress** | ✅ Stepper shows both step numbers AND labels (Firm Details, Plan, Import Clients, etc.) |
| **Navigation** | ✅ "Back" button works correctly on Steps 2, 4, 5, 6 — returns to previous step |

---

## CONSOLE ERRORS

- **Next.js Hydration Warning**: A `data-jetski-tab-id` attribute mismatch was observed, surfacing as a persistent "1 Issue" overlay badge in the bottom-left corner of every wizard step. This appears to be injected by the browser's dev/QA tooling environment, but the overlay itself is visible in the production UI and may confuse users. Worth investigating whether this is a legitimate hydration mismatch in the app code.
- No other JavaScript errors or failed network requests were observed during wizard navigation.

---

## ADDITIONAL OBSERVATIONS

| # | Observation |
|---|-------------|
| 1 | **Email step has no "domain setup" gate.** The wizard allows you to skip the DNS/Postmark setup entirely by clicking "Next Step" without entering a domain — email sending will simply not work until configured later in Settings. This is acceptable UX, but consider a warning indicator (not a blocker). |
| 2 | **Plan cards have no feature list.** The task list checks for a feature list on each plan card — current cards only show: name, price, client range, and a short description. There are no bullet-point feature lists comparing plans. |
| 3 | **The "Free" plan starts at Up to 20 clients** — the Free tier client limit (20) is notably low. Worth confirming this matches the intended product spec. |
| 4 | **Import step is the blocker.** The wizard cannot progress unless a file is uploaded. A "Skip" button in the empty state would unblock users who have no data to import at setup time. |
| 5 | **OAuth redirect on Connect buttons (Storage):** Clicking Dropbox Connect correctly redirects to Dropbox OAuth without a JS crash. The page at `/settings?tab=storage&error=missing_code` is shown after partial OAuth — this error state should show a user-friendly message rather than a raw URL param. |

---

## SCREENSHOTS

| Screenshot | Description |
|-----------|-------------|
| ![Step 3 - Import Clients empty state](file:///C:/Users/ejsch/.gemini/antigravity/brain/8902edef-48c9-4a54-ab98-758500f2d5a7/step3_missing_next_button_1772504117675.png) | Step 3 empty state — no Next button visible |
| ![Step 2 - Plan Selection desktop](file:///C:/Users/ejsch/.gemini/antigravity/brain/8902edef-48c9-4a54-ab98-758500f2d5a7/solo_plan_selected_1772503638382.png) | Step 2 with Solo plan selected |
| ![Step 2 - Mobile layout](file:///C:/Users/ejsch/.gemini/antigravity/brain/8902edef-48c9-4a54-ab98-758500f2d5a7/step2_mobile_squashed_1772504070070.png) | Step 2 at 375px — cards squashed horizontally |
| ![Step 3 - Import data preview](file:///C:/Users/ejsch/.gemini/antigravity/brain/8902edef-48c9-4a54-ab98-758500f2d5a7/step4_email_setup_start_1772504275937.png) | Step 3 after file upload — review table with 3 clients |
| ![Step 4 - Email identity settings](file:///C:/Users/ejsch/.gemini/antigravity/brain/8902edef-48c9-4a54-ab98-758500f2d5a7/step4_email_identity_settings_1772504402739.png) | Step 4 Email Setup — Sender Name, Email, Reply-To, Send Hour |
| ![Step 6 - Storage desktop](file:///C:/Users/ejsch/.gemini/antigravity/brain/8902edef-48c9-4a54-ab98-758500f2d5a7/step6_storage_setup_desktop_1772504616369.png) | Step 6 Storage — all 4 providers shown |
| ![Step 6 - Storage mobile](file:///C:/Users/ejsch/.gemini/antigravity/brain/8902edef-48c9-4a54-ab98-758500f2d5a7/step6_storage_setup_mobile_1772504628048.png) | Step 6 at 375px — content readable, stepper clips |
