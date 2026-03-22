/**
 * Demo video manifest — the complete list of all recordings.
 *
 * Each entry defines metadata for one demo video. The `record` function
 * is loaded lazily from scripts/demo/recordings/{id}.ts when running.
 */

export interface DemoEntry {
  /** Unique ID — used as filename: demo-{id}.webm */
  id: string;
  /** Title shown in the help page */
  title: string;
  /** Short description */
  description: string;
  /** Search keywords */
  tags: string[];
  /** Category for grouping */
  category: string;
  /** Whether the demo triggers real side effects */
  hasSideEffects: boolean;
}

export const demos: DemoEntry[] = [
  // ───────────────────────────────────────────
  // Dashboard
  // ───────────────────────────────────────────
  {
    id: "upcoming-deadlines-widget",
    title: "Use the Upcoming Deadlines Widget",
    description: "View the upcoming deadlines timeline, use next/previous buttons to paginate, and click to jump to a client.",
    tags: ["deadlines", "upcoming", "timeline", "dashboard", "widget", "navigate"],
    category: "Dashboard",
    hasSideEffects: false,
  },
  {
    id: "workload-forecast",
    title: "Read the Workload Forecast",
    description: "View the workload forecast chart, toggle timeframes (week/4wk/6mo/12mo), and hover over bars to see the deadline split.",
    tags: ["workload", "forecast", "chart", "dashboard", "planning", "timeframe"],
    category: "Dashboard",
    hasSideEffects: false,
  },
  {
    id: "todo-list",
    title: "Manage Your To-Do List",
    description: "Open an email row to preview it, open a document row to preview it, paginate through items, check off a records received item, and revert.",
    tags: ["todo", "tasks", "checklist", "dashboard", "email", "documents"],
    category: "Dashboard",
    hasSideEffects: true,
  },
  {
    id: "recent-uploads",
    title: "Review Recent Document Uploads",
    description: "See recently uploaded documents, click a row to open the document preview modal, and close it.",
    tags: ["uploads", "documents", "recent", "dashboard", "review", "preview"],
    category: "Dashboard",
    hasSideEffects: false,
  },

  // ───────────────────────────────────────────
  // Clients
  // ───────────────────────────────────────────
  {
    id: "add-client-manually",
    title: "Add a Client Manually",
    description: "Open the 'Add Client' dialog and fill in client details — name, email, company type, year end, VAT details.",
    tags: ["add", "create", "new", "client", "manual"],
    category: "Clients",
    hasSideEffects: true,
  },
  {
    id: "import-clients-csv",
    title: "Import Clients from CSV",
    description: "Open the import dialog, drag-and-drop a CSV file, and complete the remaining import steps.",
    tags: ["import", "csv", "bulk", "upload", "clients", "spreadsheet"],
    category: "Clients",
    hasSideEffects: true,
  },
  {
    id: "search-and-filter-clients",
    title: "Search & Filter the Client Table",
    description: "Switch to data view, then use the search bar, status filter, filing type filter, and sort options.",
    tags: ["search", "filter", "find", "clients", "table", "sort", "data view"],
    category: "Clients",
    hasSideEffects: false,
  },
  {
    id: "edit-client-inline",
    title: "Edit Client Details Inline",
    description: "Switch to data view, then click on an editable cell in the table to change a year end date directly.",
    tags: ["edit", "inline", "client", "table", "update", "quick edit", "data view"],
    category: "Clients",
    hasSideEffects: true,
  },
  {
    id: "client-detail-page",
    title: "View a Client's Detail Page",
    description: "Open a client's detail page to see their full profile, filing assignments, document uploads, and email history.",
    tags: ["client", "detail", "profile", "view", "filings", "overview"],
    category: "Clients",
    hasSideEffects: false,
  },
  {
    id: "edit-client-details",
    title: "Edit Client Details from the Detail Page",
    description: "Switch to edit mode on the client detail page to update name, email, company type, VAT scheme, and other fields.",
    tags: ["edit", "client", "detail", "update", "profile"],
    category: "Clients",
    hasSideEffects: true,
  },
  {
    id: "mark-filing-complete",
    title: "Mark a Filing as Complete",
    description: "On the client detail page, click the 'Complete' button on a filing to mark it as done for the current period.",
    tags: ["filing", "complete", "done", "mark", "status", "client"],
    category: "Clients",
    hasSideEffects: true,
  },
  {
    id: "mark-records-received",
    title: "Mark Records as Received",
    description: "Toggle the 'Records Received' status on a filing to indicate the client has sent their paperwork.",
    tags: ["records", "received", "filing", "status", "client", "paperwork"],
    category: "Clients",
    hasSideEffects: true,
  },
  {
    id: "override-deadline",
    title: "Override a Filing Deadline",
    description: "Set a custom deadline date for a specific filing, overriding the auto-calculated date.",
    tags: ["deadline", "override", "custom date", "filing", "client"],
    category: "Clients",
    hasSideEffects: true,
  },
  {
    id: "rollover-filing",
    title: "Roll Over a Completed Filing",
    description: "After marking a filing complete, roll it over to start tracking the next period's deadline.",
    tags: ["rollover", "filing", "next period", "reset", "client"],
    category: "Clients",
    hasSideEffects: true,
  },
  {
    id: "pause-resume-client",
    title: "Pause & Resume a Client's Reminders",
    description: "Pause all automated reminders for a client, then resume them later.",
    tags: ["pause", "resume", "reminders", "stop", "client", "inactive"],
    category: "Clients",
    hasSideEffects: true,
  },
  {
    id: "delete-client",
    title: "Delete a Client",
    description: "Delete a client from the system — shows the confirmation dialog and what data will be removed.",
    tags: ["delete", "remove", "client"],
    category: "Clients",
    hasSideEffects: true,
  },
  {
    id: "bulk-delete-clients",
    title: "Bulk Delete Clients",
    description: "Select multiple clients from the table and delete them all at once using the bulk actions toolbar.",
    tags: ["bulk", "delete", "multiple", "clients", "toolbar"],
    category: "Clients",
    hasSideEffects: true,
  },
  {
    id: "generate-portal-link",
    title: "Generate a Client Portal Link",
    description: "Generate a secure, time-limited portal link for a client so they can upload documents directly.",
    tags: ["portal", "link", "upload", "client", "share", "secure"],
    category: "Clients",
    hasSideEffects: true,
  },
  {
    id: "dsar-export",
    title: "Export Client Data (DSAR)",
    description: "Download all data held for a client as a JSON export for GDPR data subject access requests.",
    tags: ["dsar", "export", "gdpr", "data", "download", "client", "privacy"],
    category: "Clients",
    hasSideEffects: false,
  },
  {
    id: "bulk-edit-filing-status",
    title: "Bulk Update Filing Status",
    description: "Select multiple clients and mark records as received or filings as completed in bulk.",
    tags: ["bulk", "status", "received", "completed", "filing", "clients"],
    category: "Clients",
    hasSideEffects: true,
  },

  // ───────────────────────────────────────────
  // Emails
  // ───────────────────────────────────────────
  {
    id: "adhoc-email",
    title: "Send an Ad-hoc Email",
    description: "Select clients from the client list and send them a custom email with filing type and template.",
    tags: ["email", "send", "ad-hoc", "clients", "bulk", "template"],
    category: "Emails",
    hasSideEffects: true,
  },
  {
    id: "send-email-single-client",
    title: "Send Email to a Single Client",
    description: "From the client detail page, compose and send an email to one specific client.",
    tags: ["email", "send", "single", "client", "detail"],
    category: "Emails",
    hasSideEffects: true,
  },
  {
    id: "view-email-activity",
    title: "View Email Activity & Delivery Logs",
    description: "Navigate to the Activity page and browse sent emails, queued emails, and delivery statuses.",
    tags: ["activity", "email", "logs", "sent", "queued", "delivery", "status"],
    category: "Emails",
    hasSideEffects: false,
  },
  {
    id: "view-queued-emails",
    title: "Preview & Manage Queued Emails",
    description: "View emails scheduled to be sent, preview their content, and optionally cancel them.",
    tags: ["queued", "scheduled", "preview", "cancel", "email", "pending"],
    category: "Emails",
    hasSideEffects: true,
  },

  // ───────────────────────────────────────────
  // Email Templates
  // ───────────────────────────────────────────
  {
    id: "create-email-template",
    title: "Create a Custom Email Template",
    description: "Create a new email template with subject line, body content, and dynamic placeholders like {{client_name}}.",
    tags: ["template", "create", "new", "email", "custom", "placeholders"],
    category: "Email Templates",
    hasSideEffects: true,
  },
  {
    id: "edit-email-template",
    title: "Edit an Existing Email Template",
    description: "Open a template in the editor, modify the subject and body, and use placeholder pills for dynamic content.",
    tags: ["template", "edit", "modify", "email", "placeholders", "editor"],
    category: "Email Templates",
    hasSideEffects: true,
  },
  {
    id: "use-placeholder-pills",
    title: "Use Placeholder Pills in Templates",
    description: "Insert dynamic placeholders like {{client_name}}, {{deadline}}, and {{filing_type}} into an email template body.",
    tags: ["placeholders", "pills", "dynamic", "template", "merge fields", "variables"],
    category: "Email Templates",
    hasSideEffects: false,
  },
  {
    id: "delete-email-template",
    title: "Delete an Email Template",
    description: "Remove a custom email template that is no longer needed.",
    tags: ["template", "delete", "remove", "email"],
    category: "Email Templates",
    hasSideEffects: true,
  },

  // ───────────────────────────────────────────
  // Deadlines & Schedules
  // ───────────────────────────────────────────
  {
    id: "configure-filing-types",
    title: "Choose Active Filing Types",
    description: "Select which filing types your practice handles — Corporation Tax, CT600, Companies House, VAT, Self Assessment, and custom schedules.",
    tags: ["filing types", "configure", "select", "deadlines", "setup"],
    category: "Deadlines",
    hasSideEffects: true,
  },
  {
    id: "edit-reminder-schedule",
    title: "Edit a Deadline's Reminder Schedule",
    description: "Open a filing type's schedule editor to configure which email templates are sent and how many days before the deadline.",
    tags: ["schedule", "reminder", "edit", "steps", "timing", "deadline", "configure"],
    category: "Deadlines",
    hasSideEffects: true,
  },
  {
    id: "activate-deadline-for-client",
    title: "Activate a Deadline for Specific Clients",
    description: "Use the 'Activate for clients' modal to assign a filing type to individual clients and preview their calculated deadlines.",
    tags: ["activate", "deadline", "client", "assign", "filing type"],
    category: "Deadlines",
    hasSideEffects: true,
  },
  {
    id: "exclude-clients-from-deadline",
    title: "Exclude Clients from a Deadline",
    description: "Remove specific clients from a filing type so they don't receive reminders for it.",
    tags: ["exclude", "client", "deadline", "remove", "filing type", "exemption"],
    category: "Deadlines",
    hasSideEffects: true,
  },
  {
    id: "create-custom-schedule",
    title: "Create a Custom Deadline Schedule",
    description: "Set up a custom recurring deadline with your own name, date, recurrence rule, and reminder steps.",
    tags: ["custom", "schedule", "create", "deadline", "recurring", "new"],
    category: "Deadlines",
    hasSideEffects: true,
  },

  // ───────────────────────────────────────────
  // Documents & Uploads
  // ───────────────────────────────────────────
  {
    id: "review-document-upload",
    title: "Review & Approve a Document Upload",
    description: "When a document is uploaded via the client portal, review the validation result and approve or reject it.",
    tags: ["review", "approve", "reject", "document", "upload", "validation", "portal"],
    category: "Documents",
    hasSideEffects: true,
  },
  {
    id: "view-upload-activity",
    title: "View Upload Activity Log",
    description: "Switch to the 'Uploads' tab on the Activity page to see all document uploads with their validation status.",
    tags: ["uploads", "activity", "log", "documents", "validation", "status"],
    category: "Documents",
    hasSideEffects: false,
  },

  // ───────────────────────────────────────────
  // Settings
  // ───────────────────────────────────────────
  {
    id: "setup-custom-domain",
    title: "Set Up a Custom Sending Domain",
    description: "Configure a custom email domain with DNS records (DKIM, SPF) so emails are sent from your practice's domain.",
    tags: ["domain", "custom", "dns", "dkim", "spf", "email", "settings", "branding"],
    category: "Settings",
    hasSideEffects: true,
  },
  {
    id: "change-member-role",
    title: "Change a Team Member's Role",
    description: "View team members and change a member's role between admin and member.",
    tags: ["team", "members", "role", "admin", "member", "change", "settings"],
    category: "Settings",
    hasSideEffects: true,
  },
  {
    id: "remove-team-member",
    title: "Remove a Team Member",
    description: "Remove a team member from your organisation — shows the confirmation and what happens to their data.",
    tags: ["team", "members", "remove", "delete", "settings"],
    category: "Settings",
    hasSideEffects: true,
  },
  {
    id: "connect-storage",
    title: "Connect Cloud Storage (Google Drive / OneDrive / Dropbox)",
    description: "Link a cloud storage provider so client document uploads are automatically saved to your preferred service.",
    tags: ["storage", "google drive", "onedrive", "dropbox", "connect", "cloud", "settings"],
    category: "Settings",
    hasSideEffects: true,
  },
  {
    id: "enable-client-portal",
    title: "Enable the Client Portal",
    description: "Turn on the client upload portal so clients can submit documents through a secure link.",
    tags: ["portal", "client", "enable", "upload", "settings"],
    category: "Settings",
    hasSideEffects: true,
  },
  {
    id: "configure-upload-checks",
    title: "Configure Upload Validation Checks",
    description: "Set how document uploads are validated — automatic acceptance, manual review, or rejection of mismatched files.",
    tags: ["upload", "validation", "checks", "settings", "auto", "manual", "review"],
    category: "Settings",
    hasSideEffects: true,
  },
  {
    id: "invite-team-member",
    title: "Invite a Team Member",
    description: "Send an email invitation for a colleague to join your organisation, choosing their role (admin or member).",
    tags: ["invite", "team", "member", "add", "colleague", "organisation"],
    category: "Settings",
    hasSideEffects: true,
  },
  {
    id: "delete-account",
    title: "Delete Your Account",
    description: "Walk through the account deletion flow — shows the confirmation dialog and what data will be removed.",
    tags: ["delete", "account", "remove", "settings", "danger"],
    category: "Settings",
    hasSideEffects: true,
  },

  // ───────────────────────────────────────────
  // Billing
  // ───────────────────────────────────────────
  {
    id: "view-billing-plan",
    title: "View Your Current Plan & Usage",
    description: "Check your current subscription tier, client usage, and billing status.",
    tags: ["billing", "plan", "subscription", "usage", "tier", "pricing"],
    category: "Billing",
    hasSideEffects: false,
  },
  {
    id: "upgrade-plan",
    title: "Upgrade Your Plan",
    description: "Browse available plans and upgrade to a higher tier for more clients and features.",
    tags: ["upgrade", "plan", "billing", "pricing", "subscription"],
    category: "Billing",
    hasSideEffects: true,
  },

  // ───────────────────────────────────────────
  // Client Portal
  // ───────────────────────────────────────────
  {
    id: "client-portal-upload",
    title: "Upload Documents via the Client Portal",
    description: "Open a portal link as a client and upload documents — shows the checklist, drag-and-drop upload, progress, and validation feedback.",
    tags: ["portal", "upload", "client", "documents", "checklist", "drag drop"],
    category: "Client Portal",
    hasSideEffects: true,
  },
];

/** Get all unique categories in display order */
export function getCategories(): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const d of demos) {
    if (!seen.has(d.category)) {
      seen.add(d.category);
      ordered.push(d.category);
    }
  }
  return ordered;
}

/** Get demos by category */
export function getDemosByCategory(category: string): DemoEntry[] {
  return demos.filter((d) => d.category === category);
}
