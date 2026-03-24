# Guide Article Screenshots — Plan

## Goal

Every article card in `/guides` currently shows a dashed placeholder where an image should be. We need to fill these with either:

- **Screenshots** — captured from the live app using Playwright (reusing the existing `helpers.ts` infrastructure)
- **Custom illustrations** — hand-crafted SVG/React components rendered as images, for conceptual articles where a screenshot wouldn't add value

## Articles needing images (13 total)

### Group A: Screenshots from the app

These articles describe specific UI pages/features — a real screenshot is the best fit.

| # | ID | Title | What to capture |
|---|---|---|---|
| 1 | `getting-started-with-prompt` | Getting Started with Prompt | Dashboard overview — freshly set up state, top of page showing metrics + welcome |
| 2 | `understanding-client-fields` | Understanding Client Fields | Client detail page — showing all the fields (name, company number, year-end, VAT, email, status) |
| 5 | `managing-portal-documents-and-checklists` | Managing Portal Documents & Checklists | Client detail page → Documents tab showing checklist items with mixed states |
| 7 | `managing-your-team-and-settings` | Managing Your Team & Settings | Settings page → Team section showing members with roles |

### Group B: Custom illustrations

These articles are conceptual/educational — a screenshot wouldn't really add value. Better served by a clean illustration.

| # | ID | Title | Illustration idea |
|---|---|---|---|
| 3 | `traffic-light-status-system` | The Traffic-Light Status System | Client table filtered to show a mix of red/orange/amber/blue/green/grey statuses | MOVED FROM GROUP A
| 4 | `how-the-client-portal-works` | How the Client Portal Works | The client portal upload page (public-facing, no auth needed) | MOVED FROM GROUP A, TAKE INSPIRATION FROM CLIENT UPLOAD PORTAL ON MARKETING SITE
| 6 | `understanding-document-verdicts` | Understanding Document Verdicts | Client detail page → Documents tab showing uploads with different verdict badges (Verified, Likely match, Low confidence, Review needed) | MOVED FROM GROUP A
| 8 | `connecting-cloud-storage` | Connecting Cloud Storage | Settings page → Storage/Integrations section showing provider options | MOVED FROM GROUP A, INSPIRATION FROM CLOUD STORAGE SYNC ILLUSTRATION ON MARKETING SITE
| 9 | `how-uk-filing-deadlines-are-calculated` | How UK Filing Deadlines Are Calculated | Timeline/calendar graphic showing year-end → deadline arrows for each filing type (Corp Tax 9m+1d, CT600 12m, etc.) |
| 10 | `vat-stagger-groups-explained` | VAT Stagger Groups Explained | Three-column layout showing the 3 stagger groups with their quarter months highlighted on a mini calendar |
| 11 | `how-the-reminder-pipeline-works` | How the Reminder Pipeline Works | Flow diagram: Daily cron → Check stages → Send/Skip → Completion check, with icons at each step |
| 12 | `writing-effective-email-templates` | Writing Effective Email Templates | Mock email template with placeholder pills highlighted ({client_name}, {deadline_date}, etc.) — could be a stylised email preview | TAKE INSPIRATION FROM ILLUSTRATION IN EMAIL MANAGEMENT PART OF MARKETING SITE
| 13 | `document-guide` | Document Guide | This one has `href` and links to a full sub-page — could use a collage/grid of document type icons, or skip the image entirely since users click through |

## Approach

### Screenshots (Group A)

**Script:** `scripts/demo/capture-guide-screenshots.ts`

- Reuses existing `helpers.ts` — `startRecording` for browser launch, `login()`, `navigateTo()`, etc.
- But instead of recording video, we use `page.screenshot()` directly (much simpler)
- No cursor injection or animation needed — just navigate, wait for content, screenshot
- Output: `public/guides/screenshots/<id>.png` at 1920×1080, 2x device scale
- Each screenshot definition: `{ id, navigate, setup?, selector? }`
  - `navigate` — URL path to go to
  - `setup` — optional actions before capture (click tabs, scroll, filter)
  - `selector` — optional CSS selector to clip to a specific region (otherwise full page)

**Example flow for one screenshot:**
```
1. Launch browser (headless, 1920×1080, 2x scale)
2. Login
3. Navigate to /dashboard
4. Wait for networkidle
5. page.screenshot({ path: "public/guides/screenshots/getting-started-with-prompt.png" })
6. Navigate to /clients/[some-id]
7. Screenshot → understanding-client-fields.png
8. ... etc
9. Close browser
```

Single browser session, sequential navigation — keeps it simple and fast.

### Illustrations (Group B)

**Two options — pick one:**

**Option 1: React components rendered to PNG** (recommended)
- Create React illustration components (e.g. `DeadlineTimelineIllustration`, `VATStaggerIllustration`)
- Use the app's existing design tokens (violet-600, border colours, etc.)
- Render to static PNG via a script (e.g. using `@react-pdf/renderer` or a headless browser rendering a `/dev/illustrations` page)
- Clean, on-brand, reusable

**Option 2: SVG files**
- Hand-craft SVG illustrations matching the app's colour palette
- Simpler tooling but less flexible for future changes

### Data file update

After images are captured, update `data.ts` to add `imagePath` to each article:

```ts
{
  id: "getting-started-with-prompt",
  // ...existing fields...
  imagePath: "/guides/screenshots/getting-started-with-prompt.png",
}
```

## Questions before proceeding

1. **Group A vs B split** — Does the grouping above feel right? Any articles you'd move between groups?
2. **Illustrations approach** — Option 1 (React→PNG) or Option 2 (raw SVG)?
3. **Client portal screenshot (#4)** — Do you have a working portal link to capture, or should we skip this / use an illustration instead?
4. **Document guide (#13)** — Worth adding an image given it already links to a sub-page, or leave it as-is?
5. **Screenshot regions** — Full-page screenshots or cropped to the main content area (no sidebar)?

## Run command

Once the script is built:
```bash
npm run capture:guide-screenshots
```

Prerequisites: same as `record:shortlist` — dev server running, `DEMO_EMAIL`/`DEMO_PASSWORD` in `.env.local`, seeded test data.
