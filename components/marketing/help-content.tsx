"use client";

import { useEffect, useState } from "react";
import { MarketingNav } from "./nav";

// ---------------------------------------------------------------------------
// Section registry
// ---------------------------------------------------------------------------

const SECTIONS = [
  { id: "getting-started", label: "Getting started" },
  { id: "clients",         label: "Clients & deadlines" },
  { id: "reminders",       label: "Reminders & schedules" },
  { id: "templates",       label: "Email templates" },
  { id: "portal",          label: "Client portal" },
  { id: "verdicts",        label: "Document verdicts" },
  { id: "storage",         label: "Storage integration" },
  { id: "team",            label: "Team & settings" },
  { id: "go-further",      label: "Go further" },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

// ---------------------------------------------------------------------------
// Prose helpers
// ---------------------------------------------------------------------------

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="pb-4 border-b border-border/60 mb-8">
      <h2 className="text-2xl font-bold text-foreground tracking-tight">{children}</h2>
    </div>
  );
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return <h3 className="text-base font-semibold text-foreground mt-8 mb-3">{children}</h3>;
}

function Body({ children }: { children: React.ReactNode }) {
  return <p className="text-[14.5px] text-muted-foreground leading-relaxed mb-4">{children}</p>;
}

function Callout({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-5 pl-4 border-l-4 border-violet-400 bg-violet-50 dark:bg-violet-950/30 dark:border-violet-600 rounded-r-md py-3 pr-4">
      <p className="text-[13.5px] text-violet-900 dark:text-violet-300 leading-relaxed">{children}</p>
    </div>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="bg-muted px-1.5 py-0.5 rounded text-[13px] font-mono">{children}</code>
  );
}

// ---------------------------------------------------------------------------
// Section content components
// ---------------------------------------------------------------------------

function GettingStarted() {
  return (
    <>
      <SectionHeading>Getting started</SectionHeading>
      <Body>
        Prompt is an automated reminder system for UK accounting practices. It tracks filing deadlines for every client, sends reminder emails on a schedule you control, and gives clients a simple portal to upload documents — all without manual intervention. This section walks you through setting everything up from scratch.
      </Body>

      <SubHeading>Create your organisation</SubHeading>
      <Body>
        When you first sign up, Prompt guides you through a setup wizard. You'll name your organisation — this is your practice's workspace — and connect an email sending provider (Postmark). The organisation name appears in your dashboard and can be updated later from Settings.
      </Body>
      <Body>
        If you've been invited to an existing organisation by an admin, you'll skip the setup wizard and go straight to the dashboard. Your access level is determined by the role your admin assigned to you.
      </Body>

      <SubHeading>Add your first client</SubHeading>
      <Body>
        Go to the Clients page and click <strong>Add client</strong>. You'll need the client's name, their company registration number (if applicable), their accounting year-end date, and their VAT stagger group if they're VAT-registered. As soon as you save, Prompt calculates all relevant UK filing deadlines automatically — no manual entry required.
      </Body>
      <Body>
        For a quick test, add yourself as a client using your own email address. This lets you see exactly what your clients will receive when reminders go out.
      </Body>

      <SubHeading>Import a client list</SubHeading>
      <Body>
        If you have an existing client list, the fastest way to get started is a CSV import. From the Clients page, click <strong>Import CSV</strong>. The expected columns are: client name, company number, year-end date (DD/MM/YYYY), VAT stagger group (1, 2, or 3), and email address. Prompt validates each row before importing — any rows with missing required fields or unrecognisable formats are flagged in a preview so you can review before confirming.
      </Body>
      <Callout>
        Tip: run a small test import of 5–10 clients first to confirm your column mapping is correct before importing your full list.
      </Callout>

      <SubHeading>Set up reminder schedules and templates</SubHeading>
      <Body>
        Before Prompt will send any emails, you need at least one active reminder schedule. Go to <strong>Reminder Schedules</strong>, create a schedule for the filing type you want to chase (e.g. Corporation Tax), and activate it. Then review the default email templates under <strong>Email Templates</strong> — the default wording is generic, so customise it to match your practice's tone before emails start going out.
      </Body>

      <SubHeading>Send a test email</SubHeading>
      <Body>
        On any client's detail page, you can send an ad hoc reminder email immediately — outside of any schedule. Use your test client (yourself) to do this first. Open the client, find the filing you want to test, and click <strong>Send reminder</strong>. You'll receive the email exactly as your clients would, letting you check the wording, layout, and portal link before going live.
      </Body>
    </>
  );
}

function ClientsAndDeadlines() {
  return (
    <>
      <SectionHeading>Clients &amp; deadlines</SectionHeading>
      <Body>
        Your client list is the foundation of Prompt. Every deadline, reminder, and portal link flows from the information stored against each client. Understanding what each field does and how deadlines are calculated will help you get accurate results from day one.
      </Body>

      <SubHeading>Client fields explained</SubHeading>
      <Body>
        <strong>Name</strong> — used in reminder emails and displayed throughout the dashboard. <strong>Company number</strong> — optional but recommended; used for reference and displayed in the client detail view. <strong>Year-end date</strong> — the most critical field. Corporation Tax, CT600, and Companies House deadlines are all derived from it. <strong>VAT stagger group</strong> — determines which of the three HMRC quarterly cycles this client falls into. <strong>Email address</strong> — where reminder emails are sent. <strong>Status</strong> — active, paused, or inactive; only active clients are included in reminder pipelines.
      </Body>

      <SubHeading>How deadlines are calculated</SubHeading>
      <Body>
        Prompt calculates the following UK filing deadlines automatically from each client's year-end date:
      </Body>
      <Body>
        <strong>Corporation Tax payment</strong> — 9 months and 1 day after the year-end. <strong>CT600 return</strong> — 12 months after the year-end. <strong>Companies House accounts</strong> — 9 months after the year-end. <strong>VAT return</strong> — 1 month and 7 days after the end of the VAT quarter (determined by stagger group). <strong>Self Assessment</strong> — always 31 January following the end of the relevant tax year.
      </Body>
      <Callout>
        These formulas match HMRC and Companies House official rules. Prompt does not apply business-day adjustments — deadlines reflect the statutory date.
      </Callout>

      <SubHeading>VAT stagger groups</SubHeading>
      <Body>
        HMRC assigns every VAT-registered business to one of three stagger groups, each with different quarter-end dates. <strong>Group 1</strong>: quarters end in March, June, September, December. <strong>Group 2</strong>: quarters end in January, April, July, October. <strong>Group 3</strong>: quarters end in February, May, August, November. Setting the correct stagger group ensures VAT return deadlines are calculated accurately for every quarter.
      </Body>

      <SubHeading>The traffic-light status system</SubHeading>
      <Body>
        Every filing deadline is colour-coded by urgency on the dashboard and client detail pages. <strong>Red</strong> — overdue (past the deadline date). <strong>Orange</strong> — critical (7 days or fewer remaining). <strong>Amber</strong> — approaching (8–28 days remaining). <strong>Blue</strong> — scheduled (more than 28 days remaining). <strong>Green</strong> — complete (all required documents received). <strong>Grey</strong> — paused or inactive.
      </Body>

      <SubHeading>Editing clients</SubHeading>
      <Body>
        You can edit any client field directly from the client table — click any value to edit it inline. Changes save automatically and deadlines recalculate immediately. For bulk changes, use the checkbox column to select multiple clients and apply bulk actions from the toolbar that appears.
      </Body>
    </>
  );
}

function RemindersAndSchedules() {
  return (
    <>
      <SectionHeading>Reminders &amp; schedules</SectionHeading>
      <Body>
        Reminder schedules are automated email sequences that chase clients for outstanding documents. Once configured, the pipeline runs every day without any manual input — sending the right email to the right client at the right stage.
      </Body>

      <SubHeading>Creating a schedule</SubHeading>
      <Body>
        Go to <strong>Reminder Schedules</strong> and click <strong>New schedule</strong>. Choose the filing type this schedule applies to (e.g. Corporation Tax, VAT, Self Assessment), then define the stages. Each stage is a number of days — for example, stages at Day 1, Day 7, Day 14, and Day 21 mean Prompt will send four emails before the deadline arrives. You also assign an email template to each stage, so the tone can escalate from friendly to urgent.
      </Body>

      <SubHeading>How the daily pipeline works</SubHeading>
      <Body>
        At a set time each day, Prompt's pipeline runs across all active clients. For each client with an active deadline, it determines which reminder stage they're at based on how many days remain and which emails have already been sent. If a client is due a reminder, the pipeline sends it automatically using the assigned template.
      </Body>
      <Body>
        The pipeline stops chasing a client as soon as all required documents have been received for that filing. You don't need to manually cancel reminders — receipt of documents automatically marks the filing complete and removes it from the chase queue.
      </Body>
      <Callout>
        The pipeline only sends emails to clients whose status is <strong>Active</strong>. Pausing a client or marking them inactive immediately removes them from future sends.
      </Callout>

      <SubHeading>Pausing and resuming</SubHeading>
      <Body>
        You can pause a reminder schedule at any time from the Reminder Schedules page. When paused, no emails are sent for that filing type across all clients. When you resume, the pipeline picks up where it left off — clients don't lose their reminder history and won't receive duplicate emails.
      </Body>
      <Body>
        You can also pause an individual client without affecting others. Do this from the client's detail page or by changing their status to <strong>Paused</strong> in the client table.
      </Body>

      <SubHeading>Multiple schedules</SubHeading>
      <Body>
        You can have separate schedules for different filing types — one for Corporation Tax, one for VAT, one for Self Assessment. Each schedule runs independently. If a client has multiple active filings, they may receive reminder emails from several schedules concurrently.
      </Body>
    </>
  );
}

function EmailTemplates() {
  return (
    <>
      <SectionHeading>Email templates</SectionHeading>
      <Body>
        Every reminder email Prompt sends uses a template you define. Templates support dynamic variables that are automatically replaced with client-specific values when the email is sent.
      </Body>

      <SubHeading>Available variables</SubHeading>
      <Body>
        You can include the following variables in any template subject line or body:
      </Body>
      <Body>
        <Code>{"{{client_name}}"}</Code> — the client's full name. <Code>{"{{deadline_type}}"}</Code> — the name of the filing (e.g. "Corporation Tax return"). <Code>{"{{deadline_date}}"}</Code> — the deadline formatted as a readable UK date (e.g. "31 January 2026"). <Code>{"{{upload_link}}"}</Code> — a unique secure link to the client's upload portal for that filing. Always include this in reminder emails so clients can upload directly.
      </Body>

      <SubHeading>Writing effective templates</SubHeading>
      <Body>
        The most effective reminder sequences use different templates at different stages. An early reminder (Day 1 or Day 7) should be light and informative. A mid-sequence reminder (Day 14) can be firmer. A late reminder (Day 21 or beyond) should convey urgency clearly. Assign the appropriate template to each stage when creating your schedule.
      </Body>
      <Body>
        Keep subject lines specific. Generic subjects like "Action required" get ignored. Something like "Action needed: your Corporation Tax records — due 31 March" is far more likely to be opened.
      </Body>

      <SubHeading>Managing templates</SubHeading>
      <Body>
        Go to <strong>Email Templates</strong> to create, edit, or delete templates. You can have as many templates as you like. Changes take effect immediately — the next reminder sent using that template will use the updated content. This won't affect emails that have already been sent.
      </Body>
      <Callout>
        Always test a new template by sending an ad hoc reminder to your test client before assigning it to a live schedule.
      </Callout>
    </>
  );
}

function ClientPortal() {
  return (
    <>
      <SectionHeading>Client portal</SectionHeading>
      <Body>
        The client portal gives your clients a simple, no-login page to upload documents. Every reminder email includes a unique portal link. When clicked, the client sees exactly which documents are still outstanding and can upload them directly from their browser.
      </Body>

      <SubHeading>How portal links work</SubHeading>
      <Body>
        Each portal link is unique to a specific client and a specific filing. The link itself is the client's authentication — no username or password required. Links are valid for a set period and can be regenerated from the client's detail page if needed. Previously uploaded documents remain accessible in the dashboard even after a link expires.
      </Body>
      <Body>
        You can also generate a portal link manually — open a client, expand a filing, and click <strong>Generate portal link</strong>. This lets you share the link directly (e.g. via WhatsApp or your own email) rather than waiting for an automated reminder.
      </Body>

      <SubHeading>The client upload experience</SubHeading>
      <Body>
        When a client opens their portal link, they see a checklist of the documents you need for that filing. They can see which items are still outstanding and which have already been received. They upload by dragging and dropping files or using the file browser — no accounts, no apps, no complexity. The portal works on any device including mobile.
      </Body>
      <Body>
        As documents are uploaded, the checklist updates in real time. Once all required items are received, the filing status in your dashboard automatically changes to green and the reminder pipeline stops chasing the client.
      </Body>

      <SubHeading>Document management in the dashboard</SubHeading>
      <Body>
        On the client's detail page, you can see every document received across all filings, along with the upload timestamp and source (portal or manual). Documents can be downloaded individually. Every upload and download is logged in the audit trail.
      </Body>
      <Body>
        You can also mark documents as received manually — useful when a client sends records by email or post rather than through the portal. Toggle the received status on any checklist item directly from the client detail page.
      </Body>

      <SubHeading>Document checklist configuration</SubHeading>
      <Body>
        Each filing type has a default set of required documents. You can customise this per client — add extra items specific to that client, remove items that don't apply, or add ad hoc items with custom labels. Changes only affect the individual client and don't alter the global defaults.
      </Body>
    </>
  );
}

function DocumentVerdicts() {
  return (
    <>
      <SectionHeading>Document verdicts</SectionHeading>
      <Body>
        When a document is uploaded — either through the client portal or manually — Prompt automatically analyses it and assigns a verdict. The verdict tells you at a glance how confident the system is that the document has been correctly identified and is valid for the filing it was uploaded against. Verdicts appear as colour-coded badges in both the Activity uploads table and the filing management section on each client's page.
      </Body>

      <SubHeading>Verdict levels</SubHeading>
      <Body>
        There are four possible verdicts, listed from most to least confident:
      </Body>
      <Body>
        <strong>Verified</strong> (green) — the document was classified with high confidence. The document type was identified reliably, all validation checks passed, and no manual review is needed. This is the ideal outcome for every upload.
      </Body>
      <Body>
        <strong>Likely match</strong> (amber) — the document was classified with medium confidence. The type appears correct but the system's certainty is moderate. You should glance at the extracted details to confirm the classification before treating it as final.
      </Body>
      <Body>
        <strong>Low confidence</strong> (red) — the document could not be reliably classified. This happens when the file content doesn't clearly match any expected document type, or the uploaded file is in a format the system struggles with (e.g. a scanned image with poor text quality). Open the document to verify its type and check whether it belongs to the filing it was uploaded against.
      </Body>
      <Body>
        <strong>Review needed</strong> (amber) — the document has been flagged by Prompt's validation checks. This is different from low confidence — the document may have been classified correctly, but something about it triggered a warning. Common reasons include a tax year mismatch (the document appears to be for a different period than the filing), a PAYE reference that doesn't match the client's records, or a document type that seems unusual for the filing. Open the document to see the specific warnings and decide whether to accept or replace it.
      </Body>

      <SubHeading>How verdicts are determined</SubHeading>
      <Body>
        The verdict is derived from a combination of signals. When a document is uploaded, Prompt extracts text content (using direct text extraction for digital PDFs, or OCR for scanned documents and images), then runs a classification pipeline that matches the content against known document type patterns. The classification confidence (high, medium, or low) is set by how strongly the content matches.
      </Body>
      <Body>
        Separately, a set of validation rules compares extracted data (tax year, employer name, PAYE reference) against the client's records and the filing's expected period. If any rule triggers a warning, the document is flagged for review regardless of classification confidence.
      </Body>
      <Body>
        The verdict displayed is determined by checking these conditions in priority order: review flags take precedence, then low or unclassified confidence, then medium confidence, and finally high confidence results in a Verified verdict.
      </Body>

      <SubHeading>Filtering by verdict</SubHeading>
      <Body>
        On the Activity page's uploads tab, you can filter the table by verdict using the filter panel. This is useful for quickly finding all documents that need attention — filter by "Review needed" or "Low confidence" to see only the uploads that require manual review, rather than scrolling through a list of verified documents.
      </Body>

      <SubHeading>Clearing a review flag</SubHeading>
      <Body>
        When you open a document flagged as "Review needed", the preview panel shows the specific validation warnings. After reviewing, click <strong>Clear review</strong> to remove the flag. This updates the verdict immediately — if the underlying classification confidence is high, the verdict will change to Verified. Clearing a review flag is a manual confirmation that you've checked the document and are satisfied it's correct.
      </Body>
    </>
  );
}

function StorageIntegration() {
  return (
    <>
      <SectionHeading>Storage integration</SectionHeading>
      <Body>
        By default, documents uploaded through the client portal are stored securely within Prompt's infrastructure. If your practice uses cloud storage, you can connect Prompt to your storage provider so that uploaded documents are automatically saved there as well.
      </Body>

      <SubHeading>Supported providers</SubHeading>
      <Body>
        Prompt currently supports <strong>Dropbox</strong>, <strong>Google Drive</strong>, and <strong>Microsoft OneDrive</strong>. Connecting a provider requires an admin account with the appropriate permissions on your organisation's storage workspace.
      </Body>

      <SubHeading>Connecting your storage</SubHeading>
      <Body>
        Go to <strong>Settings</strong> and select the <strong>Storage</strong> tab. Choose your provider and click <strong>Connect</strong>. You'll be redirected to your provider's authorisation page — sign in with the account you want Prompt to use and grant the requested permissions. Once connected, a status indicator confirms the link is active.
      </Body>
      <Callout>
        Storage connections occasionally need to be reauthorised — for example if your admin changes their password or revokes app permissions. If documents stop syncing, check the storage tab in Settings for a reconnect prompt.
      </Callout>

      <SubHeading>How documents are organised</SubHeading>
      <Body>
        When a document is uploaded, Prompt creates a folder structure in your connected storage: one folder per client, then subfolders per filing type. Documents are named to include the filing type and upload timestamp, making them easy to locate. Prompt only writes files — it never deletes anything from your storage.
      </Body>

      <SubHeading>Storage and default hosting</SubHeading>
      <Body>
        Connecting an external storage provider does not remove documents from Prompt's internal storage. Documents remain accessible from the dashboard regardless of whether a storage integration is active. The integration is additive — it syncs a copy to your provider while keeping the original in Prompt.
      </Body>
    </>
  );
}

function TeamAndSettings() {
  return (
    <>
      <SectionHeading>Team &amp; settings</SectionHeading>
      <Body>
        Prompt supports multi-user teams. Admins can invite colleagues, manage access levels, and control organisation-wide configuration from the Settings page.
      </Body>

      <SubHeading>Inviting team members</SubHeading>
      <Body>
        Go to <strong>Settings → Team</strong> and click <strong>Invite member</strong>. Enter their email address and choose their role. They'll receive an invitation email with a link to create their account and join your organisation. You can see pending invitations and resend or cancel them from the same page.
      </Body>

      <SubHeading>Roles and permissions</SubHeading>
      <Body>
        There are two roles: <strong>Admin</strong> and <strong>Member</strong>. Admins have full access — they can manage settings, billing, team members, email templates, reminder schedules, and all client data. Members can view and manage clients and documents, send ad hoc reminder emails, and view the dashboard — but cannot change organisation-level settings, templates, or schedules.
      </Body>
      <Callout>
        Only admins can invite or remove team members, change billing details, or connect and disconnect storage providers.
      </Callout>

      <SubHeading>Organisation settings</SubHeading>
      <Body>
        From <strong>Settings → General</strong>, admins can update the organisation name and configure the email sender identity (the name and domain your clients see in their inbox). From <strong>Settings → Billing</strong>, you can manage your subscription, upgrade or downgrade your plan, and view invoices.
      </Body>

      <SubHeading>Removing team members</SubHeading>
      <Body>
        To remove a member, go to <strong>Settings → Team</strong>, find the member, and click <strong>Remove</strong>. Their account is immediately deactivated and they lose access. Any clients, documents, or reminder history they were associated with is retained — nothing is deleted when a team member is removed.
      </Body>
    </>
  );
}

function GoFurther() {
  return (
    <>
      <SectionHeading>Go further</SectionHeading>
      <Body>
        Once you're up and running with the basics, these features let you get significantly more out of Prompt — from manual control over individual reminders to a fully custom email identity for your practice.
      </Body>

      <SubHeading>Ad hoc email sending</SubHeading>
      <Body>
        Every filing on a client's detail page has a <strong>Send reminder</strong> button. This sends an immediate one-off email to the client for that filing, outside of any schedule. Use this when you want to chase a client personally, respond to a specific situation, or test a template without waiting for the automated pipeline.
      </Body>
      <Body>
        Ad hoc sends are logged in the client's email history alongside scheduled sends — you can see the template used, the send timestamp, and whether delivery was confirmed.
      </Body>

      <SubHeading>Document checklist customisation</SubHeading>
      <Body>
        The default document checklist for each filing type applies to all clients. For clients with different requirements, you can customise the checklist at the individual client level — enabling or disabling standard document types, or adding completely custom items with your own label (e.g. "Signed director's declaration" or "Bank statements for subsidiary account").
      </Body>
      <Body>
        Open the client, expand a filing, and click <strong>Configure checklist</strong>. These changes are stored per-client and don't affect other clients or the global defaults.
      </Body>

      <SubHeading>Connecting cloud storage</SubHeading>
      <Body>
        Prompt can automatically sync uploaded documents to Dropbox, Google Drive, or OneDrive. Every document your clients upload appears in your practice's cloud storage automatically — no manual downloading and re-uploading. Files are organised into client and filing subfolders. See the Storage integration section for setup instructions.
      </Body>

      <SubHeading>Sending from your own domain</SubHeading>
      <Body>
        By default, Prompt sends reminder emails from a shared Prompt address. For a more professional appearance — and to improve deliverability — you can configure your own sending domain so emails arrive from an address like <Code>reminders@yourpractice.co.uk</Code>.
      </Body>
      <Body>
        This requires a one-time DNS setup. Go to <strong>Settings → Email</strong> and follow the Postmark domain configuration steps. You'll add DKIM and SPF records to your domain registrar. Once verified, all outgoing emails will be sent from your domain. The process takes around 5–10 minutes and Prompt guides you through each step.
      </Body>
      <Callout>
        Using your own domain significantly reduces the chance of reminder emails landing in spam, as they're authenticated against your domain's DNS records.
      </Callout>

      <SubHeading>Audit trail and DSAR export</SubHeading>
      <Body>
        Every significant action in Prompt is recorded in an audit log — client changes, document uploads and downloads, email sends, team member changes, and settings updates. You can view the audit log from a client's detail page or from Settings.
      </Body>
      <Body>
        For GDPR compliance, Prompt supports Data Subject Access Request (DSAR) exports. From a client's detail page, admins can export all data held about that client — contact details, filing history, email history, and uploaded documents — as a structured export, satisfying a DSAR without any manual data gathering.
      </Body>
    </>
  );
}

// ---------------------------------------------------------------------------
// Section map
// ---------------------------------------------------------------------------

const SECTION_CONTENT: Record<SectionId, React.ComponentType> = {
  "getting-started": GettingStarted,
  "clients":         ClientsAndDeadlines,
  "reminders":       RemindersAndSchedules,
  "templates":       EmailTemplates,
  "portal":          ClientPortal,
  "verdicts":        DocumentVerdicts,
  "storage":         StorageIntegration,
  "team":            TeamAndSettings,
  "go-further":      GoFurther,
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export const HelpContent = () => {
  const [active, setActive] = useState<SectionId>("getting-started");

  // Read hash on mount for deep-link support (/help#go-further etc.)
  useEffect(() => {
    const hash = window.location.hash.replace("#", "") as SectionId;
    if (hash && SECTIONS.some((s) => s.id === hash)) {
      setActive(hash);
    }
  }, []);

  function handleSelect(id: SectionId) {
    setActive(id);
    history.replaceState(null, "", `#${id}`);
    window.scrollTo({ top: 0 });
  }

  const ActiveContent = SECTION_CONTENT[active];

  return (
    <div className="min-h-screen flex flex-col bg-background">

      {/* Marketing nav */}
      <MarketingNav hideLogin hideSignup />

      {/* ── Body: sidebar + content ── */}
      <div className="flex-1 flex max-w-screen-xl mx-auto w-full px-4 md:px-6 gap-10 py-10">

        {/* Sidebar — desktop */}
        <aside className="hidden md:block w-56 shrink-0">
          <nav className="sticky top-6">
            <p className="text-[11px] font-semibold text-muted-foreground/60 uppercase tracking-widest mb-3 px-3">
              Contents
            </p>
            <ul className="space-y-0.5">
              {SECTIONS.map((s) => (
                <li key={s.id}>
                  <button
                    onClick={() => handleSelect(s.id)}
                    className={`w-full text-left px-3 py-2 rounded-md text-[13.5px] font-medium transition-colors ${
                      active === s.id
                        ? "bg-violet-600/10 text-violet-700 dark:text-violet-400"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                    }`}
                  >
                    {s.label}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        {/* Mobile nav strip */}
        <div className="md:hidden w-full mb-6">
          <div className="overflow-x-auto">
            <div className="flex gap-1 min-w-max pb-2">
              {SECTIONS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => handleSelect(s.id)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                    active === s.id
                      ? "bg-violet-600 text-white"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Content */}
        <main className="flex-1 min-w-0 pb-24">
          <ActiveContent />
        </main>

      </div>
    </div>
  );
};
