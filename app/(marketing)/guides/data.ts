const STORAGE_BASE = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/videos`;

export type GuideCategory =
  | "Getting Started"
  | "Dashboard"
  | "Clients"
  | "Emails"
  | "Email Templates"
  | "Deadlines"
  | "Documents"
  | "Settings"
  | "Billing"
  | "Client Portal";

export type GuideType = "tutorial" | "article" | "guide";

export interface Guide {
  id: string;
  title: string;
  description: string;
  category: GuideCategory;
  type: GuideType;
  /** Video path for tutorials */
  videoPath?: string;
  /** Screenshot path for articles */
  imagePath?: string;
  /** Link for special cards (e.g. document guide) */
  href?: string;
  searchTags: string[];
}

export const guideCategories: GuideCategory[] = [
  "Getting Started",
  "Dashboard",
  "Clients",
  "Emails",
  "Email Templates",
  "Deadlines",
  "Documents",
  "Settings",
  "Billing",
  "Client Portal",
];

export const guideTypes: GuideType[] = ["tutorial", "article", "guide"];

export const guideTypeLabels: Record<GuideType, string> = {
  tutorial: "Tutorial",
  article: "Article",
  guide: "Guide",
};

export const categoryColors: Record<GuideCategory, { bg: string; text: string }> = {
  "Getting Started": { bg: "bg-emerald-100", text: "text-emerald-700" },
  Dashboard: { bg: "bg-violet-100", text: "text-violet-700" },
  Clients: { bg: "bg-blue-100", text: "text-blue-700" },
  Emails: { bg: "bg-green-100", text: "text-green-700" },
  "Email Templates": { bg: "bg-amber-100", text: "text-amber-700" },
  Deadlines: { bg: "bg-red-100", text: "text-red-700" },
  Documents: { bg: "bg-cyan-100", text: "text-cyan-700" },
  Settings: { bg: "bg-gray-100", text: "text-gray-700" },
  Billing: { bg: "bg-orange-100", text: "text-orange-700" },
  "Client Portal": { bg: "bg-pink-100", text: "text-pink-700" },
};

export const guides: Guide[] = [
  // ═══════════════════════════════════════════════════════════
  // ARTICLES
  // ═══════════════════════════════════════════════════════════

  // ─── Getting Started ────────────────────────────────────
  {
    id: "getting-started-with-prompt",
    title: "Getting Started with Prompt",
    description:
      "Prompt is an automated reminder system built for UK accounting practices. It tracks filing deadlines for every client, sends reminder emails on a schedule you control, and gives clients a simple portal to upload documents — all without manual intervention. This guide covers the initial setup, from creating your organisation through the setup wizard to connecting your email sending provider and getting your dashboard ready.",
    category: "Getting Started",
    type: "guide",
    href: "/guides/getting-started-with-prompt",
    searchTags: ["setup", "onboarding", "organisation", "wizard", "getting started", "new"],
  },

  // ─── Clients & Deadlines ────────────────────────────────
  {
    id: "understanding-client-fields",
    title: "Understanding Client Fields",
    description:
      "Every deadline, reminder, and portal link in Prompt flows from the information stored against each client. The year-end date is the most important field — Corporation Tax, CT600, and Companies House deadlines are all calculated directly from it, so an incorrect year end means every deadline for that client will be wrong. The VAT stagger group determines which quarterly cycle a client follows and must match the group assigned by HMRC. Other fields like company number, email address, entity type, and status each affect how Prompt generates reminders and portal links. Getting these right from the start ensures accurate deadline calculations and reliable reminder delivery.",
    category: "Clients",
    type: "article",
    searchTags: ["fields", "client", "year end", "company number", "email", "status", "vat"],
  },
  {
    id: "how-uk-filing-deadlines-are-calculated",
    title: "How UK Filing Deadlines Are Calculated",
    description:
      "Prompt calculates Corporation Tax (9 months and 1 day after year-end), CT600 returns (12 months), Companies House accounts (9 months), VAT returns (1 month and 7 days after the quarter), and Self Assessment (31 January) automatically from each client's year-end date. Each formula matches HMRC and Companies House official rules exactly. This article breaks down every available deadline type, how its date is measured, and the edge cases you should be aware of.",
    category: "Deadlines",
    type: "article",
    searchTags: ["deadlines", "calculation", "formula", "hmrc", "companies house", "corporation tax", "ct600", "vat", "self assessment"],
  },
  {
    id: "vat-stagger-groups-explained",
    title: "VAT Stagger Groups Explained",
    description:
      "HMRC assigns every VAT-registered business to one of three stagger groups, each with different quarter-end dates. Group 1 ends in March, June, September, and December. Group 2 ends in January, April, July, and October. Group 3 ends in February, May, August, and November. HMRC uses stagger groups to spread the volume of VAT returns across the year rather than having every business file at the same time, which helps both HMRC's processing capacity and the accounting profession's workload distribution.",
    category: "Deadlines",
    type: "article",
    searchTags: ["vat", "stagger", "groups", "quarters", "hmrc", "return dates"],
  },
  {
    id: "traffic-light-status-system",
    title: "The Traffic-Light Status System",
    description:
      "Every filing deadline in Prompt is colour-coded by urgency. Red means overdue, orange means critical (7 days or fewer), amber means approaching (8–28 days), blue means on track (more than 28 days), green means complete, and grey means paused or inactive. This article explains each status level, where the colours appear across the dashboard and client pages, and how they help you prioritise your workload at a glance.",
    category: "Clients",
    type: "article",
    href: "/guides/the-traffic-light-status-system",
    searchTags: ["traffic light", "status", "colours", "urgency", "overdue", "critical", "complete"],
  },

  // ─── Email Templates ────────────────────────────────────
  {
    id: "writing-effective-email-templates",
    title: "Writing Effective Email Templates",
    description:
      "The most effective reminder sequences use different templates at different stages — light and informative early on, firmer in the middle, and clearly urgent near the deadline. This guide covers the available template variables (client name, deadline type, deadline date, upload link), strategies for escalating tone across a sequence, and best practices for subject lines that actually get opened.",
    category: "Email Templates",
    type: "guide",
    href: "/guides/writing-effective-email-templates",
    searchTags: ["templates", "writing", "variables", "tone", "subject lines", "best practices", "effective"],
  },

  // ─── Client Portal ──────────────────────────────────────
  {
    id: "how-the-client-portal-works",
    title: "How the Client Portal Works",
    description:
      "The client portal gives your clients a simple, no-login page to upload documents. Every reminder email includes a unique portal link tied to a specific client and filing. When clicked, the client sees exactly which documents are still outstanding and can upload them directly from their browser — on any device, no account required. Portal links are time-limited — each link's expiry is set automatically based on the reminder schedule, typically lasting until the next reminder step or 30 days if it's the final step. Links can also be revoked manually at any time.",
    category: "Client Portal",
    type: "article",
    href: "/guides/how-the-client-portal-works",
    videoPath: `${STORAGE_BASE}/tutorials/enable-client-portal.mp4`,
    searchTags: ["portal", "upload", "link", "client experience", "no login", "secure", "enable"],
  },
  {
    id: "managing-portal-documents-and-checklists",
    title: "Managing Portal Documents & Checklists",
    description:
      "Every document uploaded through the portal is tracked against the client and filing it belongs to. You can view, download, and manage uploads from the client detail page, and mark documents as received manually when clients send records by email or post. Each filing type has a default document checklist, but you can customise it per client — adding, removing, or relabelling items to match that client's specific requirements.",
    category: "Client Portal",
    type: "guide",
    href: "/guides/managing-portal-documents-and-checklists",
    videoPath: `${STORAGE_BASE}/tutorials/generate-portal-link.mp4`,
    searchTags: ["documents", "checklist", "manage", "customise", "manual", "received", "portal link", "generate"],
  },

  // ─── Documents ──────────────────────────────────────────
  {
    id: "document-guide",
    title: "Document Guide",
    description:
      "A comprehensive reference for every document your practice may request from clients — what it is, where to find it, and why it's needed. Covers all filing types including Self Assessment, CT600, Companies House, VAT, and more. Share this guide directly with clients who are unsure what to upload.",
    category: "Documents",
    type: "article",
    href: "/guides/documents",
    searchTags: ["document", "guide", "reference", "what to upload", "filing types", "required documents"],
  },
  {
    id: "understanding-document-verdicts",
    title: "Understanding Document Verdicts",
    description:
      "When a document is uploaded and the practice has configured upload checks to run automatic analysis, Prompt assigns a verdict — Verified (green), Likely match (amber), Low confidence (red), or Review needed (amber). Verdicts are determined by a classification pipeline that extracts text content and matches it against known document type patterns, combined with validation rules that check tax years, employer names, and PAYE references. Each verdict level indicates how confidently the system matched the document to what was requested. You can filter by verdict in the activity log and clear review flags after manual inspection.",
    category: "Documents",
    type: "article",
    href: "/guides/understanding-document-verdicts",
    searchTags: ["verdicts", "verified", "review needed", "low confidence", "classification", "validation"],
  },

  // ─── Settings ───────────────────────────────────────────
  {
    id: "managing-your-team-and-settings",
    title: "Managing Your Team & Settings",
    description:
      "Prompt supports multi-user teams with role-based access. Admins have full access to settings, billing, templates, and deadlines, while Members can manage clients and documents but can't change organisation-level configuration. This guide covers inviting team members, understanding the Admin and Member roles, updating organisation settings like your practice name and sender identity, and removing team members when they leave.",
    category: "Settings",
    type: "guide",
    href: "/guides/managing-your-team-and-settings",
    videoPath: `${STORAGE_BASE}/tutorials/invite-team-member.mp4`,
    searchTags: ["team", "roles", "admin", "member", "permissions", "organisation", "settings", "invite"],
  },
  {
    id: "connecting-cloud-storage",
    title: "Connecting Cloud Storage",
    description:
      "Prompt integrates with Dropbox, Google Drive, and Microsoft OneDrive so that uploaded documents are automatically synced to your existing cloud storage. Documents are organised into client and filing subfolders, and Prompt only writes files — it never deletes from your storage. This guide covers the connection process, how re-authorisation works, and how the integration sits alongside Prompt's built-in document hosting.",
    category: "Settings",
    type: "guide",
    href: "/guides/connecting-cloud-storage",
    searchTags: ["storage", "cloud", "dropbox", "google drive", "onedrive", "sync", "integration"],
  },

  // ═══════════════════════════════════════════════════════════
  // TUTORIALS (video)
  // ═══════════════════════════════════════════════════════════

  // ─── Dashboard ──────────────────────────────────────────
  {
    id: "upcoming-deadlines-widget",
    title: "Use the Upcoming Deadlines Widget",
    description:
      "The Upcoming Deadlines widget on your dashboard shows each approaching deadline with the client name, deadline type, traffic-light status, and due date. You can page through upcoming dates using the next/previous buttons, and clicking any row takes you straight to that client's detail page, scrolled to the relevant deadline.",
    category: "Dashboard",
    type: "tutorial",
    videoPath: `${STORAGE_BASE}/tutorials/upcoming-deadlines-widget.mp4`,
    searchTags: ["timeline", "widget", "deadlines", "navigate", "dashboard"],
  },
  {
    id: "workload-forecast",
    title: "Read the Workload Forecast",
    description:
      "The workload forecast shows your deadlines across different time frames — week, four weeks, six months, and twelve months — split by status into colour-coded bars. Each bar represents your progress for that window: as you work through deadlines, the bars shift toward green, so an all-green bar means everything in that time period is done. Hover over any bar to see the exact breakdown by status.",
    category: "Dashboard",
    type: "tutorial",
    videoPath: `${STORAGE_BASE}/tutorials/workload-forecast.mp4`,
    searchTags: ["chart", "forecast", "workload", "graph", "analytics"],
  },
  {
    id: "todo-list",
    title: "Manage Your To-Do List",
    description:
      "The to-do list on your dashboard is ordered by priority: failed emails appear first, then documents that need review, then clients who need submitting. You can view failed emails and resend them directly, view uploaded files and accept or reject them, and for clients ready to submit, be taken straight to HMRC to file the records you've received. Items are cleared as you act on them.",
    category: "Dashboard",
    type: "tutorial",
    videoPath: `${STORAGE_BASE}/tutorials/todo-list.mp4`,
    searchTags: ["todo", "tasks", "checklist", "records received"],
  },
  {
    id: "recent-uploads",
    title: "Review Recent Document Uploads",
    description:
      "The recent uploads section on your dashboard shows all files recently uploaded by clients through the client portal. You can see each file's status badge — some may need review if they didn't pass verification checks. Click any upload to open a preview modal where you can download the file, reject incorrect uploads, or pass review directly without leaving the dashboard.",
    category: "Dashboard",
    type: "tutorial",
    videoPath: `${STORAGE_BASE}/tutorials/recent-uploads.mp4`,
    searchTags: ["uploads", "documents", "preview", "recent"],
  },

  // ─── Clients ────────────────────────────────────────────
  {
    id: "add-client-manually",
    title: "Add a Single Client Manually",
    description:
      "The add client dialog lets you bring a single client into Prompt by entering their company name, contact email, entity type, year end, and VAT registration details. Deadline dates are automatically calculated from the information you enter — so as soon as you save, the client's filing schedule is ready to go.",
    category: "Clients",
    type: "tutorial",
    videoPath: `${STORAGE_BASE}/tutorials/add-client-manually.mp4`,
    searchTags: ["add", "create", "new client", "onboard"],
  },
  {
    id: "import-clients-csv",
    title: "Import Clients from CSV",
    description:
      "The CSV import lets you bring your entire client list into Prompt in one go — upload your file, map the columns, and Prompt handles validation and onboarding. Clients will automatically be rolled forward for any deadlines where you're already past the current deadline date, so they start tracking the next period. If a client's business type doesn't have any active deadlines configured, that client will be imported with no deadlines until you set them up.",
    category: "Clients",
    type: "tutorial",
    videoPath: `${STORAGE_BASE}/tutorials/import-clients-csv.mp4`,
    searchTags: ["import", "csv", "bulk", "upload", "spreadsheet"],
  },
  {
    id: "search-and-filter-clients",
    title: "Search & Filter the Client Table",
    description:
      "As your client list grows, finding the right person quickly becomes essential. The client table supports full-text search, status filtering, filing type filtering, and column sorting — making it easy to narrow down exactly who you're looking for, whether that's all overdue VAT clients or a single company by name.",
    category: "Clients",
    type: "tutorial",
    videoPath: `${STORAGE_BASE}/tutorials/search-and-filter-clients.mp4`,
    searchTags: ["search", "filter", "sort", "find", "table"],
  },
  {
    id: "client-detail-page",
    title: "View a Client's Detail Page",
    description:
      "Every client in Prompt has a dedicated detail page that brings together everything about them in one place. From here you can edit their details, mark records as received, mark filings as complete, check sent and queued emails for that client, view and manage uploaded documents, override deadline dates, deactivate deadlines that don't apply, generate portal links, and see the full history of email and filing activity.",
    category: "Clients",
    type: "tutorial",
    videoPath: `${STORAGE_BASE}/tutorials/client-detail-page.mp4`,
    searchTags: ["detail", "profile", "overview", "client page"],
  },
  {
    id: "edit-client-details",
    title: "Edit Client Details (Detail Page)",
    description:
      "Client information changes — companies re-register, email addresses get updated, entity types shift. The detail page edit mode lets you update any of a client's core information and save the changes in one go. Switch to edit mode, update the fields you need, and save — all without leaving the client's page.",
    category: "Clients",
    type: "tutorial",
    videoPath: `${STORAGE_BASE}/tutorials/edit-client-details.mp4`,
    searchTags: ["edit", "update", "modify", "client details"],
  },
  {
    id: "mark-filing-complete",
    title: "Mark a Filing as Complete",
    description:
      "When you're ready to file, a button takes you directly to HMRC or Companies House so you can submit. After submitting, mark the filing as complete in Prompt to update the client's compliance status. Once marked complete, you're given the option to roll over, which sets up the reminders and deadlines for the next filing cycle automatically.",
    category: "Clients",
    type: "tutorial",
    videoPath: `${STORAGE_BASE}/tutorials/mark-filing-complete.mp4`,
    searchTags: ["complete", "done", "filing", "checkbox", "status"],
  },
  {
    id: "mark-records-received",
    title: "Mark Records as Received",
    description:
      "Records are marked as received automatically when a client submits all required documents through the portal, or you can do it manually by ticking the records received checkbox or by ticking all individual document checkboxes. Once records are marked as received, Prompt stops sending further reminder emails to that client for that deadline — so they won't be chased for documents they've already provided. This gives you a clear picture of which clients have sent their paperwork and which are still outstanding.",
    category: "Clients",
    type: "tutorial",
    videoPath: `${STORAGE_BASE}/tutorials/mark-records-received.mp4`,
    searchTags: ["records", "received", "documents", "toggle"],
  },
  {
    id: "override-deadline",
    title: "Override a Filing Deadline",
    description:
      "Sometimes a deadline doesn't follow the standard formula — maybe HMRC has granted an extension, or a client's circumstances have changed. Overriding a deadline lets you set a custom date for any individual filing, complete with a reason for the change. All reminders for that deadline are automatically rescheduled so they remain the correctly configured time period before the new deadline date, keeping the full reminder sequence intact.",
    category: "Clients",
    type: "tutorial",
    videoPath: `${STORAGE_BASE}/tutorials/override-deadline.mp4`,
    searchTags: ["override", "deadline", "custom date", "extend"],
  },
  {
    id: "rollover-filing",
    title: "Roll Over a Completed Filing",
    description:
      "Once a filing period is complete, rollover creates the next period's deadline automatically — carrying forward the client's details, calculating the new deadline date, and scheduling all reminders for the next cycle. This is how Prompt keeps things moving year after year without you having to manually set up each new period.",
    category: "Clients",
    type: "tutorial",
    videoPath: `${STORAGE_BASE}/tutorials/rollover-filing.mp4`,
    searchTags: ["rollover", "next period", "renew", "new year"],
  },
  {
    id: "pause-resume-client",
    title: "Pause & Resume Reminders",
    description:
      "Sometimes you need to temporarily stop reminders for a client — maybe they're switching accountants, on a payment hold, or going through a restructure. Pausing puts all automated emails on hold without losing any configuration, and resuming picks up exactly where things left off.",
    category: "Clients",
    type: "tutorial",
    videoPath: `${STORAGE_BASE}/tutorials/pause-resume-client.mp4`,
    searchTags: ["pause", "resume", "stop", "reminders", "hold"],
  },
  {
    id: "delete-client",
    title: "Delete a Client",
    description:
      "When a client leaves your practice for good, deleting them removes their record and all associated filings from Prompt. The deletion process includes a confirmation step so you understand what's permanent and what to consider before removing a client.",
    category: "Clients",
    type: "tutorial",
    videoPath: `${STORAGE_BASE}/tutorials/delete-client.mp4`,
    searchTags: ["delete", "remove", "client"],
  },
  {
    id: "bulk-delete-clients",
    title: "Bulk Delete Clients",
    description:
      "Select multiple clients from the table and remove them in a single action — useful after a migration, a practice split, or end-of-year housekeeping. A confirmation step ensures nothing is removed by accident.",
    category: "Clients",
    type: "tutorial",
    videoPath: `${STORAGE_BASE}/tutorials/bulk-delete-clients.mp4`,
    searchTags: ["bulk", "delete", "multiple", "select", "mass"],
  },
  {
    id: "dsar-export",
    title: "Export Client Data (DSAR)",
    description:
      "Under GDPR, clients have the right to request a copy of all data you hold on them. The DSAR export bundles everything Prompt stores for a given client — contact details, filing history, email logs, and uploaded documents — into a single downloadable package, making compliance straightforward.",
    category: "Clients",
    type: "tutorial",
    videoPath: `${STORAGE_BASE}/tutorials/dsar-export.mp4`,
    searchTags: ["gdpr", "export", "data", "dsar", "download", "privacy"],
  },
  // ─── Emails ─────────────────────────────────────────────
  {
    id: "adhoc-email",
    title: "Send an Ad-hoc Email",
    description:
      "Select one or more clients from the client list and send them a custom email using any of your templates. Template variables like client name, deadline date, and portal link update automatically for each selected recipient, so a single send can go out personalised to every client. You can also preview the final message before it goes out.",
    category: "Emails",
    type: "tutorial",
    videoPath: `${STORAGE_BASE}/tutorials/adhoc-email.mp4`,
    searchTags: ["send", "compose", "ad-hoc", "email", "manual"],
  },
  {
    id: "send-email-single-client",
    title: "Send Email to a Single Client",
    description:
      "From a client's detail page, compose and send an email without leaving the context. Useful for quick follow-ups or chasing a specific document — you have the client's full filing history right there while you write.",
    category: "Emails",
    type: "tutorial",
    videoPath: `${STORAGE_BASE}/tutorials/send-email-single-client.mp4`,
    searchTags: ["send", "email", "single", "client", "compose"],
  },
  {
    id: "view-email-activity",
    title: "View Sent Email Activity",
    description:
      "The email activity log gives you full visibility into every email Prompt has sent. Browse delivery statuses, see when each email was delivered, and check for bounces — invaluable for answering client queries about whether they received a reminder or for auditing your communication trail.",
    category: "Emails",
    type: "tutorial",
    videoPath: `${STORAGE_BASE}/tutorials/view-email-activity.mp4`,
    searchTags: ["activity", "logs", "delivery", "sent", "history"],
  },
  {
    id: "view-queued-emails",
    title: "Preview & Manage Queued Emails",
    description:
      "Before automated reminders are sent, they sit in a queue where you can review them. Preview the exact content each client will receive and intervene if needed — send an email early, cancel it, or let it go out on schedule.",
    category: "Emails",
    type: "tutorial",
    videoPath: `${STORAGE_BASE}/tutorials/view-queued-emails.mp4`,
    searchTags: ["queued", "pending", "preview", "send now", "cancel"],
  },

  // ─── Email Templates ────────────────────────────────────
  {
    id: "create-email-template",
    title: "Create a Custom Email Template",
    description:
      "Create a new email template from scratch — set the name, subject line, and body content, and use placeholder variables like client name, deadline date, and portal link that get filled in automatically for each recipient. Well-structured templates with the right variables ensure your automated reminders are personal and effective.",
    category: "Email Templates",
    type: "tutorial",
    videoPath: `${STORAGE_BASE}/tutorials/create-email-template.mp4`,
    searchTags: ["create", "template", "new", "custom"],
  },
  {
    id: "edit-email-template",
    title: "Edit an Existing Email Template",
    description:
      "As your practice evolves, your email tone and content should too. Open any template in the editor to refine the wording, update subject lines, and reformat the body — without recreating from scratch. Changes apply to all future emails that use the template.",
    category: "Email Templates",
    type: "tutorial",
    videoPath: `${STORAGE_BASE}/tutorials/edit-email-template.mp4`,
    searchTags: ["edit", "modify", "template", "update"],
  },
  {
    id: "use-placeholder-pills",
    title: "Use Placeholder Pills in Templates",
    description:
      "Placeholder pills are dynamic variables — like client name, deadline date, or filing type — that you drop into any email template. When the email is sent, each pill is automatically replaced with the correct value for that specific client. This is what makes a single template work for your entire client base.",
    category: "Email Templates",
    type: "tutorial",
    videoPath: `${STORAGE_BASE}/tutorials/use-placeholder-pills.mp4`,
    searchTags: ["placeholder", "pills", "variables", "dynamic", "merge fields"],
  },
  {
    id: "delete-email-template",
    title: "Delete an Email Template",
    description:
      "Remove a template you no longer need to keep your template library clean. Deletion is not possible if the template is currently in use by a deadline's reminder schedule — you'll need to reassign it first. A confirmation safeguard prevents accidental removal.",
    category: "Email Templates",
    type: "tutorial",
    videoPath: `${STORAGE_BASE}/tutorials/delete-email-template.mp4`,
    searchTags: ["delete", "remove", "template"],
  },

  // ─── Deadlines ──────────────────────────────────────────
  {
    id: "configure-filing-types",
    title: "Choose Active Filing Types",
    description:
      "Choose which deadlines Prompt tracks for your practice — Corporation Tax, VAT, Self Assessment, Companies House, and more. This is configured during the setup wizard but can be edited at any time from the deadlines page. Only active filing types generate reminders, so this keeps your dashboard focused on what matters to you.",
    category: "Deadlines",
    type: "tutorial",
    videoPath: `${STORAGE_BASE}/tutorials/configure-filing-types.mp4`,
    searchTags: ["filing types", "configure", "active", "toggle", "deadlines"],
  },
  {
    id: "edit-reminder-schedule",
    title: "Edit a Deadline's Reminder Schedule",
    description:
      "Each deadline has a reminder schedule that controls when and how often clients are chased. Open the schedule editor to adjust the timing between reminders, add extra steps for more persistent follow-ups, change required documents, or simplify the sequence — so the cadence matches how your practice actually works.",
    category: "Deadlines",
    type: "tutorial",
    videoPath: `${STORAGE_BASE}/tutorials/edit-reminder-schedule.mp4`,
    searchTags: ["schedule", "reminder", "edit", "delay", "steps"],
  },
  {
    id: "activate-deadline-for-client",
    title: "Activate a Deadline for a Client",
    description:
      "From a client's detail page, you can activate any inactive deadline for that specific client. Find the deadline in their filing list, activate it, and Prompt will calculate the deadline date and begin scheduling reminders automatically.",
    category: "Deadlines",
    type: "tutorial",
    videoPath: `${STORAGE_BASE}/tutorials/activate-deadline-for-client.mp4`,
    searchTags: ["activate", "deadline", "assign", "clients"],
  },
  {
    id: "exclude-clients-from-deadline",
    title: "Exclude Clients from a Deadline",
    description:
      "Some clients may not need reminders for a particular filing — perhaps they handle it themselves or it doesn't apply to their entity type. Client exclusions let you opt specific clients out of a deadline's reminder schedule without affecting anyone else, keeping your communications targeted and relevant.",
    category: "Deadlines",
    type: "tutorial",
    videoPath: `${STORAGE_BASE}/tutorials/exclude-clients-from-deadline.mp4`,
    searchTags: ["exclude", "remove", "deadline", "opt out"],
  },
  {
    id: "create-custom-schedule",
    title: "Create a Custom Deadline",
    description:
      "Beyond the standard UK filing deadlines, your practice may track internal deadlines, client-specific obligations, or non-standard filings. Create a custom deadline with your own name, date, and recurrence rule, choose an email template for each reminder step, add as many steps as you need, and assign it to clients — so Prompt can chase anything that has a due date.",
    category: "Deadlines",
    type: "tutorial",
    videoPath: `${STORAGE_BASE}/tutorials/create-custom-schedule.mp4`,
    searchTags: ["create", "custom", "deadline", "new", "schedule"],
  },

  // ─── Documents ──────────────────────────────────────────
  {
    id: "review-document-upload",
    title: "Review & Approve an Upload",
    description:
      "When a client uploads a document through the portal, you can preview it directly, see the validation results from any automatic checks, and decide whether to pass review or reject it and request a replacement. Navigate between uploads without leaving the review modal to work through your queue efficiently.",
    category: "Documents",
    type: "tutorial",
    videoPath: `${STORAGE_BASE}/tutorials/review-document-upload.mp4`,
    searchTags: ["review", "approve", "upload", "preview", "validation"],
  },
  {
    id: "view-upload-activity",
    title: "View Upload Activity Log",
    description:
      "The upload activity log provides a complete record of every document that's been submitted through the portal — who uploaded it, when, for which filing, and its current status. Search for specific uploads, filter by status or filing type, and change the sort order to find what you need quickly.",
    category: "Documents",
    type: "tutorial",
    videoPath: `${STORAGE_BASE}/tutorials/view-upload-activity.mp4`,
    searchTags: ["activity", "uploads", "log", "search", "filter"],
  },

  // ─── Settings ───────────────────────────────────────────
  {
    id: "setup-custom-domain",
    title: "Setting Up a Custom Sending Domain",
    description:
      "By default, emails are sent from a Prompt address, but setting up a custom sending domain means your clients see emails coming from your own practice domain. This improves deliverability and builds trust. The settings page includes step-by-step DNS setup instructions for the main domain providers, covering the DKIM and SPF records you need to add.",
    category: "Settings",
    type: "guide",
    href: "/guides/setting-up-a-custom-sending-domain",
    searchTags: ["domain", "dns", "email", "custom", "sending", "dkim", "spf"],
  },
  {
    id: "change-member-role",
    title: "Change a Team Member's Role",
    description:
      "As your team structure evolves, you may need to adjust who has access to what. Changing a team member's role updates their permissions across Prompt — for example, promoting someone from viewer to editor, or adjusting admin access. This tutorial covers where to find role management and what each role level means.",
    category: "Settings",
    type: "tutorial",
    videoPath: `${STORAGE_BASE}/tutorials/change-member-role.mp4`,
    searchTags: ["team", "role", "member", "permissions", "change"],
  },
  {
    id: "remove-team-member",
    title: "Remove a Team Member",
    description:
      "When someone leaves your practice or no longer needs access to Prompt, removing them revokes their login and removes them from the team. This tutorial covers the removal process and what happens to any activity associated with their account.",
    category: "Settings",
    type: "tutorial",
    videoPath: `${STORAGE_BASE}/tutorials/remove-team-member.mp4`,
    searchTags: ["team", "remove", "member", "delete"],
  },
  {
    id: "configure-upload-checks",
    title: "Configure Upload Checks",
    description:
      "Upload checks control how Prompt validates documents as they come in. You can configure whether uploads are automatically accepted, require manual review, or are analysed using document classification that extracts text and matches against known document patterns. Options include checking file types and sizes, verifying tax years and employer names, matching PAYE references, and setting whether unverified documents are held for review or accepted with a warning. Choose the right combination for your practice's risk tolerance.",
    category: "Settings",
    type: "tutorial",
    videoPath: `${STORAGE_BASE}/tutorials/configure-upload-checks.mp4`,
    searchTags: ["upload", "checks", "validation", "configure"],
  },
  {
    id: "delete-account",
    title: "Delete Your Account",
    description:
      "The account deletion option in settings lets you permanently close your Prompt account. This permanently deletes ALL data — clients, filings, email history, templates, uploaded documents, and team members. Confirmation safeguards are in place so you know exactly what to expect before proceeding.",
    category: "Settings",
    type: "tutorial",
    videoPath: `${STORAGE_BASE}/tutorials/delete-account.mp4`,
    searchTags: ["delete", "account", "remove", "close"],
  },

  // ─── Billing ────────────────────────────────────────────
  {
    id: "view-billing-plan",
    title: "View Your Plan & Usage",
    description:
      "The billing page shows your current subscription tier, what's included, and how much of your plan limits you're using — including client count and team seats. This tutorial covers where to find this information and how to read the usage indicators so you always know where you stand.",
    category: "Billing",
    type: "tutorial",
    videoPath: `${STORAGE_BASE}/tutorials/view-billing-plan.mp4`,
    searchTags: ["billing", "plan", "usage", "subscription"],
  },

];
