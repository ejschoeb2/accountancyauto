const STORAGE_BASE = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/videos`;

export type TutorialCategory =
  | "Dashboard"
  | "Clients"
  | "Emails"
  | "Email Templates"
  | "Deadlines"
  | "Documents"
  | "Settings"
  | "Billing"
  | "Client Portal";

export interface Tutorial {
  id: string;
  title: string;
  description: string;
  category: TutorialCategory;
  videoPath: string;
  searchTags: string[];
}

export const tutorialCategories: TutorialCategory[] = [
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

export const categoryColors: Record<TutorialCategory, { bg: string; text: string }> = {
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

export const tutorials: Tutorial[] = [
  // ─── Dashboard ───────────────────────────────────────────
  {
    id: "upcoming-deadlines-widget",
    title: "Use the Upcoming Deadlines Widget",
    description:
      "Your dashboard includes a deadline timeline that gives you an at-a-glance view of what's coming up across your entire client base. This tutorial covers how the widget works, how to page through upcoming dates, and how to jump straight to a client's detail page from a deadline entry.",
    category: "Dashboard",
    videoPath: `${STORAGE_BASE}/tutorials/upcoming-deadlines-widget.mp4`,
    searchTags: ["timeline", "widget", "deadlines", "navigate", "dashboard"],
  },
  {
    id: "workload-forecast",
    title: "Read the Workload Forecast",
    description:
      "The workload forecast chart helps you plan capacity by showing how many deadlines fall in each period. This tutorial explains the different timeframe views available — from weekly to twelve-month — and how to break down the numbers by filing type so you can spot busy periods before they arrive.",
    category: "Dashboard",
    videoPath: `${STORAGE_BASE}/tutorials/workload-forecast.mp4`,
    searchTags: ["chart", "forecast", "workload", "graph", "analytics"],
  },
  {
    id: "todo-list",
    title: "Manage Your To-Do List",
    description:
      "The to-do list on your dashboard surfaces items that need your attention — emails awaiting review, documents that have been uploaded, and records that are still outstanding. This tutorial walks through how the to-do list works, how to act on items directly from the dashboard, and how to mark things as done.",
    category: "Dashboard",
    videoPath: `${STORAGE_BASE}/tutorials/todo-list.mp4`,
    searchTags: ["todo", "tasks", "checklist", "records received"],
  },
  {
    id: "recent-uploads",
    title: "Review Recent Document Uploads",
    description:
      "When clients upload documents through the portal, they appear in the recent uploads section of your dashboard. This tutorial covers how to quickly review what's come in, preview documents without leaving the page, and stay on top of incoming files as they arrive.",
    category: "Dashboard",
    videoPath: `${STORAGE_BASE}/tutorials/recent-uploads.mp4`,
    searchTags: ["uploads", "documents", "preview", "recent"],
  },

  // ─── Clients ─────────────────────────────────────────────
  {
    id: "add-client-manually",
    title: "Add a Client Manually",
    description:
      "When you need to bring a new client into Prompt one at a time, the add client dialog lets you capture everything up front — company name, contact email, entity type, year end, and VAT registration details. This tutorial shows the full process from opening the dialog to having the client ready in your system.",
    category: "Clients",
    videoPath: `${STORAGE_BASE}/tutorials/add-client-manually.mp4`,
    searchTags: ["add", "create", "new client", "onboard"],
  },
  {
    id: "import-clients-csv",
    title: "Import Clients from CSV",
    description:
      "If you're migrating from a spreadsheet or another tool, the CSV import lets you bring your entire client list into Prompt in one go. This tutorial covers the import flow including file upload, column mapping, and how Prompt handles validation so you can onboard hundreds of clients without entering them individually.",
    category: "Clients",
    videoPath: `${STORAGE_BASE}/tutorials/import-clients-csv.mp4`,
    searchTags: ["import", "csv", "bulk", "upload", "spreadsheet"],
  },
  {
    id: "search-and-filter-clients",
    title: "Search & Filter the Client Table",
    description:
      "As your client list grows, finding the right person quickly becomes essential. The client table supports full-text search, status filtering, filing type filtering, and column sorting — making it easy to narrow down exactly who you're looking for, whether that's all overdue VAT clients or a single company by name.",
    category: "Clients",
    videoPath: `${STORAGE_BASE}/tutorials/search-and-filter-clients.mp4`,
    searchTags: ["search", "filter", "sort", "find", "table"],
  },
  {
    id: "edit-client-inline",
    title: "Edit Client Details Inline",
    description:
      "Sometimes you just need to fix a year end date or update a detail without navigating away from the client list. Inline editing lets you change client information directly in the table — just click a cell, make the change, and move on. This tutorial shows which fields are editable and how the save works.",
    category: "Clients",
    videoPath: `${STORAGE_BASE}/tutorials/edit-client-inline.mp4`,
    searchTags: ["edit", "inline", "table", "year end", "quick edit"],
  },
  {
    id: "client-detail-page",
    title: "View a Client's Detail Page",
    description:
      "Every client in Prompt has a dedicated detail page that brings together their contact information, active filings, deadline history, and compliance status in one place. This tutorial gives you a full tour of the page layout and explains what each section is for, so you always know where to find what you need.",
    category: "Clients",
    videoPath: `${STORAGE_BASE}/tutorials/client-detail-page.mp4`,
    searchTags: ["detail", "profile", "overview", "client page"],
  },
  {
    id: "edit-client-details",
    title: "Edit Client Details (Detail Page)",
    description:
      "Client information changes — companies re-register, email addresses get updated, entity types shift. The detail page edit mode lets you update any of a client's core information and save the changes in one go. This tutorial covers the editing flow and what fields are available.",
    category: "Clients",
    videoPath: `${STORAGE_BASE}/tutorials/edit-client-details.mp4`,
    searchTags: ["edit", "update", "modify", "client details"],
  },
  {
    id: "mark-filing-complete",
    title: "Mark a Filing as Complete",
    description:
      "When a filing has been submitted to HMRC or Companies House, marking it as complete in Prompt stops any further reminders for that period and updates the client's compliance status. This tutorial covers how completion tracking works and what happens to the reminder schedule once a filing is marked done.",
    category: "Clients",
    videoPath: `${STORAGE_BASE}/tutorials/mark-filing-complete.mp4`,
    searchTags: ["complete", "done", "filing", "checkbox", "status"],
  },
  {
    id: "mark-records-received",
    title: "Mark Records as Received",
    description:
      "Before you can file on behalf of a client, you typically need their records first. The records received toggle lets you track which clients have sent their documents and which are still outstanding — giving you a clear picture of where things stand across your practice at any point in the year.",
    category: "Clients",
    videoPath: `${STORAGE_BASE}/tutorials/mark-records-received.mp4`,
    searchTags: ["records", "received", "documents", "toggle"],
  },
  {
    id: "override-deadline",
    title: "Override a Filing Deadline",
    description:
      "Sometimes a deadline doesn't follow the standard formula — maybe HMRC has granted an extension, or a client's circumstances have changed. Deadline overrides let you set a custom date for any individual filing, complete with a reason for the change, so the reminder schedule adjusts accordingly while keeping a clear audit trail.",
    category: "Clients",
    videoPath: `${STORAGE_BASE}/tutorials/override-deadline.mp4`,
    searchTags: ["override", "deadline", "custom date", "extend"],
  },
  {
    id: "rollover-filing",
    title: "Roll Over a Completed Filing",
    description:
      "Once a filing period is complete, rollover creates the next period's filing automatically — carrying forward the client's details and resetting the reminder schedule for the new deadline. This is how Prompt keeps things moving year after year without you having to manually set up each new period.",
    category: "Clients",
    videoPath: `${STORAGE_BASE}/tutorials/rollover-filing.mp4`,
    searchTags: ["rollover", "next period", "renew", "new year"],
  },
  {
    id: "pause-resume-client",
    title: "Pause & Resume Reminders",
    description:
      "There are times when you need to temporarily stop reminders for a client — maybe they're switching accountants, on a payment hold, or going through a restructure. Pausing puts all automated emails on hold without losing any configuration, and resuming picks up exactly where things left off.",
    category: "Clients",
    videoPath: `${STORAGE_BASE}/tutorials/pause-resume-client.mp4`,
    searchTags: ["pause", "resume", "stop", "reminders", "hold"],
  },
  {
    id: "delete-client",
    title: "Delete a Client",
    description:
      "When a client leaves your practice for good, deleting them removes their record and all associated filings from Prompt. This tutorial covers the deletion process including the confirmation step, so you understand what's permanent and what to consider before removing a client.",
    category: "Clients",
    videoPath: `${STORAGE_BASE}/tutorials/delete-client.mp4`,
    searchTags: ["delete", "remove", "client"],
  },
  {
    id: "bulk-delete-clients",
    title: "Bulk Delete Clients",
    description:
      "If you need to clean up multiple client records at once — after a migration, a practice split, or end-of-year housekeeping — bulk delete lets you select several clients from the table and remove them in a single action, with a confirmation step to make sure nothing is removed by accident.",
    category: "Clients",
    videoPath: `${STORAGE_BASE}/tutorials/bulk-delete-clients.mp4`,
    searchTags: ["bulk", "delete", "multiple", "select", "mass"],
  },
  {
    id: "generate-portal-link",
    title: "Generate a Client Portal Link",
    description:
      "Portal links give your clients a secure, branded way to upload documents directly to Prompt without needing their own login. Each link is tied to a specific filing, so uploads land in the right place automatically. This tutorial covers how to generate a link and what the client sees when they use it.",
    category: "Clients",
    videoPath: `${STORAGE_BASE}/tutorials/generate-portal-link.mp4`,
    searchTags: ["portal", "link", "share", "upload", "secure"],
  },
  {
    id: "dsar-export",
    title: "Export Client Data (DSAR)",
    description:
      "Under GDPR, clients have the right to request a copy of all data you hold on them. The DSAR export bundles everything Prompt stores for a given client — contact details, filing history, email logs, and uploaded documents — into a single downloadable package, making compliance straightforward.",
    category: "Clients",
    videoPath: `${STORAGE_BASE}/tutorials/dsar-export.mp4`,
    searchTags: ["gdpr", "export", "data", "dsar", "download", "privacy"],
  },
  {
    id: "bulk-edit-filing-status",
    title: "Bulk Update Filing Status",
    description:
      "During busy periods like the January Self Assessment rush, you may need to update filing statuses for many clients at once. Bulk status editing lets you select a group of clients and mark their filings as received or completed in one action, saving significant time compared to updating each one individually.",
    category: "Clients",
    videoPath: `${STORAGE_BASE}/tutorials/bulk-edit-filing-status.mp4`,
    searchTags: ["bulk", "edit", "status", "received", "completed", "mass update"],
  },

  // ─── Emails ──────────────────────────────────────────────
  {
    id: "adhoc-email",
    title: "Send an Ad-hoc Email",
    description:
      "Beyond automated reminders, there are times you need to send a one-off email to one or more clients — a policy update, a seasonal notice, or a follow-up. Ad-hoc emails let you select recipients, choose a template or write from scratch, and preview the final message before it goes out.",
    category: "Emails",
    videoPath: `${STORAGE_BASE}/tutorials/adhoc-email.mp4`,
    searchTags: ["send", "compose", "ad-hoc", "email", "manual"],
  },
  {
    id: "send-email-single-client",
    title: "Send Email to a Single Client",
    description:
      "When you're already looking at a client's detail page, you can compose and send an email without leaving the context. This is useful for quick follow-ups or chasing a specific document — you have the client's full filing history right there while you write.",
    category: "Emails",
    videoPath: `${STORAGE_BASE}/tutorials/send-email-single-client.mp4`,
    searchTags: ["send", "email", "single", "client", "compose"],
  },
  {
    id: "view-email-activity",
    title: "View Email Activity & Delivery Logs",
    description:
      "The email activity log gives you full visibility into what Prompt has sent and when. You can see delivery statuses, bounce information, and a complete history of every email that's gone out — which is invaluable for answering client queries about whether they received a reminder or for auditing your communication trail.",
    category: "Emails",
    videoPath: `${STORAGE_BASE}/tutorials/view-email-activity.mp4`,
    searchTags: ["activity", "logs", "delivery", "sent", "history"],
  },
  {
    id: "view-queued-emails",
    title: "Preview & Manage Queued Emails",
    description:
      "Before automated reminders are sent, they sit in a queue where you can review them. This gives you a chance to preview the exact content each client will receive, and to intervene if needed — sending an email early, cancelling it, or letting it go out on schedule.",
    category: "Emails",
    videoPath: `${STORAGE_BASE}/tutorials/view-queued-emails.mp4`,
    searchTags: ["queued", "pending", "preview", "send now", "cancel"],
  },

  // ─── Email Templates ────────────────────────────────────
  {
    id: "create-email-template",
    title: "Create a Custom Email Template",
    description:
      "Email templates let you define reusable message formats that maintain a consistent tone across your practice. This tutorial covers creating a new template from scratch — setting the name, subject line, and body content, including how to use placeholder variables that get filled in automatically for each recipient.",
    category: "Email Templates",
    videoPath: `${STORAGE_BASE}/tutorials/create-email-template.mp4`,
    searchTags: ["create", "template", "new", "custom"],
  },
  {
    id: "edit-email-template",
    title: "Edit an Existing Email Template",
    description:
      "As your practice evolves, your email tone and content should too. The template editor lets you refine existing templates — adjusting wording, updating subject lines, and reformatting the body — without having to recreate them from scratch. Changes apply to all future emails that use the template.",
    category: "Email Templates",
    videoPath: `${STORAGE_BASE}/tutorials/edit-email-template.mp4`,
    searchTags: ["edit", "modify", "template", "update"],
  },
  {
    id: "use-placeholder-pills",
    title: "Use Placeholder Pills in Templates",
    description:
      "Placeholder pills are dynamic variables — like client name, deadline date, or filing type — that you can drop into any email template. When the email is sent, each pill is automatically replaced with the correct value for that specific client. This is what makes a single template work for your entire client base.",
    category: "Email Templates",
    videoPath: `${STORAGE_BASE}/tutorials/use-placeholder-pills.mp4`,
    searchTags: ["placeholder", "pills", "variables", "dynamic", "merge fields"],
  },
  {
    id: "delete-email-template",
    title: "Delete an Email Template",
    description:
      "If a template is no longer needed — perhaps it was replaced by an updated version or was only used for a one-off campaign — you can remove it to keep your template library clean. This tutorial covers the deletion process and the confirmation safeguard that prevents accidental removal.",
    category: "Email Templates",
    videoPath: `${STORAGE_BASE}/tutorials/delete-email-template.mp4`,
    searchTags: ["delete", "remove", "template"],
  },

  // ─── Deadlines ───────────────────────────────────────────
  {
    id: "configure-filing-types",
    title: "Choose Active Filing Types",
    description:
      "Not every practice handles every type of filing. The filing type configuration lets you choose which deadlines Prompt tracks for your practice — Corporation Tax, VAT, Self Assessment, Companies House, and more. Only active filing types generate reminders, so this keeps your dashboard focused on what matters to you.",
    category: "Deadlines",
    videoPath: `${STORAGE_BASE}/tutorials/configure-filing-types.mp4`,
    searchTags: ["filing types", "configure", "active", "toggle", "deadlines"],
  },
  {
    id: "edit-reminder-schedule",
    title: "Edit a Reminder Schedule",
    description:
      "Each filing type has a reminder schedule that controls when and how often clients are chased. The schedule editor lets you adjust the timing between reminders, add extra steps for more persistent follow-ups, or simplify the sequence — so the cadence matches how your practice actually works.",
    category: "Deadlines",
    videoPath: `${STORAGE_BASE}/tutorials/edit-reminder-schedule.mp4`,
    searchTags: ["schedule", "reminder", "edit", "delay", "steps"],
  },
  {
    id: "activate-deadline-for-client",
    title: "Activate a Deadline for Clients",
    description:
      "When you add a new filing type or bring on clients who need a deadline they weren't previously tracked for, you can activate that deadline for specific clients. This tutorial covers how to find inactive deadlines and assign them to the right clients so reminders start flowing.",
    category: "Deadlines",
    videoPath: `${STORAGE_BASE}/tutorials/activate-deadline-for-client.mp4`,
    searchTags: ["activate", "deadline", "assign", "clients"],
  },
  {
    id: "exclude-clients-from-deadline",
    title: "Exclude Clients from a Deadline",
    description:
      "Some clients may not need reminders for a particular filing — perhaps they handle it themselves or it doesn't apply to their entity type. Client exclusions let you opt specific clients out of a deadline's reminder schedule without affecting anyone else, keeping your communications targeted and relevant.",
    category: "Deadlines",
    videoPath: `${STORAGE_BASE}/tutorials/exclude-clients-from-deadline.mp4`,
    searchTags: ["exclude", "remove", "deadline", "opt out"],
  },
  {
    id: "create-custom-schedule",
    title: "Create a Custom Deadline",
    description:
      "Beyond the standard UK filing deadlines, your practice may track internal deadlines, client-specific obligations, or non-standard filings. Custom deadlines let you create your own deadline type with a name, date, full reminder schedule, and client assignments — so Prompt can chase anything that has a due date.",
    category: "Deadlines",
    videoPath: `${STORAGE_BASE}/tutorials/create-custom-schedule.mp4`,
    searchTags: ["create", "custom", "deadline", "new", "schedule"],
  },

  // ─── Documents ───────────────────────────────────────────
  {
    id: "review-document-upload",
    title: "Review & Approve an Upload",
    description:
      "When a client uploads a document through the portal, Prompt can run automatic validation checks before you even open it. This tutorial covers the review workflow — previewing the document, seeing the validation results, and deciding whether to approve or request a replacement.",
    category: "Documents",
    videoPath: `${STORAGE_BASE}/tutorials/review-document-upload.mp4`,
    searchTags: ["review", "approve", "upload", "preview", "validation"],
  },
  {
    id: "view-upload-activity",
    title: "View Upload Activity Log",
    description:
      "The upload activity log provides a complete record of every document that's been submitted through the portal — who uploaded it, when, for which filing, and its current status. This is useful for tracking outstanding documents across your client base and for keeping an audit trail of what was received.",
    category: "Documents",
    videoPath: `${STORAGE_BASE}/tutorials/view-upload-activity.mp4`,
    searchTags: ["activity", "uploads", "log", "search", "filter"],
  },

  // ─── Settings ────────────────────────────────────────────
  {
    id: "setup-custom-domain",
    title: "Set Up a Custom Sending Domain",
    description:
      "By default, emails are sent from a Prompt address, but setting up a custom sending domain means your clients see emails coming from your own practice domain. This improves deliverability and builds trust. The setup involves adding a few DNS records, and this tutorial walks through the entire configuration.",
    category: "Settings",
    videoPath: `${STORAGE_BASE}/tutorials/setup-custom-domain.mp4`,
    searchTags: ["domain", "dns", "email", "custom", "sending"],
  },
  {
    id: "change-member-role",
    title: "Change a Team Member's Role",
    description:
      "As your team structure evolves, you may need to adjust who has access to what. Changing a team member's role updates their permissions across Prompt — for example, promoting someone from viewer to editor, or adjusting admin access. This tutorial covers where to find role management and what each role level means.",
    category: "Settings",
    videoPath: `${STORAGE_BASE}/tutorials/change-member-role.mp4`,
    searchTags: ["team", "role", "member", "permissions", "change"],
  },
  {
    id: "remove-team-member",
    title: "Remove a Team Member",
    description:
      "When someone leaves your practice or no longer needs access to Prompt, removing them revokes their login and removes them from the team. This tutorial covers the removal process and what happens to any activity associated with their account.",
    category: "Settings",
    videoPath: `${STORAGE_BASE}/tutorials/remove-team-member.mp4`,
    searchTags: ["team", "remove", "member", "delete"],
  },
  {
    id: "connect-storage",
    title: "Connect Cloud Storage",
    description:
      "Prompt integrates with Google Drive, OneDrive, and Dropbox so that client documents uploaded through the portal can be automatically synced to your existing cloud storage. This tutorial covers how to connect your preferred provider and what the sync looks like once it's set up.",
    category: "Settings",
    videoPath: `${STORAGE_BASE}/tutorials/connect-storage.mp4`,
    searchTags: ["storage", "cloud", "google drive", "onedrive", "dropbox"],
  },
  {
    id: "enable-client-portal",
    title: "Enable the Client Portal",
    description:
      "The client portal gives your clients a simple, branded page where they can upload documents directly to your practice. Enabling it is a single toggle, but this tutorial also covers what the portal looks like from the client's perspective and how uploaded files flow into your review queue.",
    category: "Settings",
    videoPath: `${STORAGE_BASE}/tutorials/enable-client-portal.mp4`,
    searchTags: ["portal", "enable", "client", "upload"],
  },
  {
    id: "configure-upload-checks",
    title: "Configure Upload Checks",
    description:
      "Upload checks let Prompt automatically validate documents as they come in — checking file types, sizes, and other criteria before they reach your review queue. This tutorial covers the different validation modes available and how to choose the right level of strictness for your practice.",
    category: "Settings",
    videoPath: `${STORAGE_BASE}/tutorials/configure-upload-checks.mp4`,
    searchTags: ["upload", "checks", "validation", "configure"],
  },
  {
    id: "invite-team-member",
    title: "Invite a Team Member",
    description:
      "Growing your team on Prompt is straightforward — enter their email address, assign them a role, and they'll receive an invitation to join. This tutorial covers the invitation process and explains the different role options so you can give each team member the right level of access from the start.",
    category: "Settings",
    videoPath: `${STORAGE_BASE}/tutorials/invite-team-member.mp4`,
    searchTags: ["invite", "team", "member", "add", "new"],
  },
  {
    id: "delete-account",
    title: "Delete Your Account",
    description:
      "If you ever need to close your Prompt account entirely, the account deletion option is available in settings. This tutorial covers what the process looks like, what data is affected, and the confirmation safeguards in place — so you know exactly what to expect if you ever need to use it.",
    category: "Settings",
    videoPath: `${STORAGE_BASE}/tutorials/delete-account.mp4`,
    searchTags: ["delete", "account", "remove", "close"],
  },

  // ─── Billing ─────────────────────────────────────────────
  {
    id: "view-billing-plan",
    title: "View Your Plan & Usage",
    description:
      "The billing page shows your current subscription tier, what's included, and how much of your plan limits you're using — including client count and team seats. This tutorial covers where to find this information and how to read the usage indicators so you always know where you stand.",
    category: "Billing",
    videoPath: `${STORAGE_BASE}/tutorials/view-billing-plan.mp4`,
    searchTags: ["billing", "plan", "usage", "subscription"],
  },
  {
    id: "upgrade-plan",
    title: "Upgrade Your Plan",
    description:
      "As your practice grows, you may need more clients, more team seats, or access to features on a higher tier. The upgrade flow lets you compare plans side by side and switch to a new tier directly from the billing page. This tutorial walks through the available options and the upgrade process.",
    category: "Billing",
    videoPath: `${STORAGE_BASE}/tutorials/upgrade-plan.mp4`,
    searchTags: ["upgrade", "plan", "billing", "pricing"],
  },

  // ─── Client Portal ──────────────────────────────────────
  {
    id: "client-portal-upload",
    title: "Upload via Client Portal",
    description:
      "This tutorial shows the portal experience from the client's perspective — what they see when they open a portal link, the upload checklist that guides them through what's needed, and how the drag-and-drop upload area works. Useful for understanding what your clients will experience when you send them a link.",
    category: "Client Portal",
    videoPath: `${STORAGE_BASE}/tutorials/client-portal-upload.mp4`,
    searchTags: ["portal", "upload", "client", "documents", "submit"],
  },
];
