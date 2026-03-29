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
    description: "The widget shows each approaching deadline with the client name, deadline type, traffic-light status, and due date. Click any row to jump to that client's detail page.",
    tags: ["deadlines", "upcoming", "timeline", "dashboard", "widget", "navigate"],
    category: "Dashboard",
    hasSideEffects: false,
  },
  {
    id: "workload-forecast",
    title: "Read the Workload Forecast",
    description: "Shows deadlines across different time frames split by status into colour-coded bars. As bars shift toward green, that time window is done. Hover to see the exact breakdown.",
    tags: ["workload", "forecast", "chart", "dashboard", "planning", "timeframe"],
    category: "Dashboard",
    hasSideEffects: false,
  },
  {
    id: "todo-list",
    title: "Manage Your To-Do List",
    description: "Ordered by priority: failed emails first, then documents needing review, then clients ready to submit. View and resend emails, accept or reject files, and go straight to HMRC to file.",
    tags: ["todo", "tasks", "checklist", "dashboard", "email", "documents"],
    category: "Dashboard",
    hasSideEffects: true,
  },
  {
    id: "recent-uploads",
    title: "Review Recent Document Uploads",
    description: "See all recently uploaded files from clients through the portal. Reject incorrect files, download files, and pass review on uploads that need it — all from the preview modal.",
    tags: ["uploads", "documents", "recent", "dashboard", "review", "preview"],
    category: "Dashboard",
    hasSideEffects: false,
  },

  // ───────────────────────────────────────────
  // Clients
  // ───────────────────────────────────────────
  {
    id: "add-client-manually",
    title: "Add a Single Client Manually",
    description: "Add a single client via the dialog — enter name, email, company type, year end, and VAT details. Deadline dates are automatically calculated from the information you enter.",
    tags: ["add", "create", "new", "client", "manual"],
    category: "Clients",
    hasSideEffects: true,
  },
  {
    id: "import-clients-csv",
    title: "Import Clients from CSV",
    description: "Import your entire client list via CSV. Clients are automatically rolled forward for past deadlines, and clients with no matching deadline types will have no deadlines until configured.",
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
    id: "client-detail-page",
    title: "View a Client's Detail Page",
    description: "View a client's full detail page — edit details, mark records received, check sent and queued emails, deactivate deadlines, generate portal links, and more.",
    tags: ["client", "detail", "profile", "view", "filings", "overview"],
    category: "Clients",
    hasSideEffects: false,
  },
  {
    id: "edit-client-details",
    title: "Edit Client Details (Detail Page)",
    description: "Switch to edit mode on the client detail page to update name, email, company type, VAT scheme, and other fields. Save all changes in one go.",
    tags: ["edit", "client", "detail", "update", "profile"],
    category: "Clients",
    hasSideEffects: true,
  },
  {
    id: "mark-filing-complete",
    title: "Mark a Filing as Complete",
    description: "Use the link to go to HMRC or Companies House to submit, then mark the filing as complete. After completion, roll over to set up reminders for the next deadline cycle.",
    tags: ["filing", "complete", "done", "mark", "status", "client"],
    category: "Clients",
    hasSideEffects: true,
  },
  {
    id: "mark-records-received",
    title: "Mark Records as Received",
    description: "Records are received automatically when a client submits all documents, or manually via the checkbox. Marking as received stops further reminders to the client for that deadline.",
    tags: ["records", "received", "filing", "status", "client", "paperwork"],
    category: "Clients",
    hasSideEffects: true,
  },
  {
    id: "override-deadline",
    title: "Override a Filing Deadline",
    description: "Set a custom deadline date for a specific filing. Overriding reschedules all reminders so they remain the correctly configured time period before the new deadline.",
    tags: ["deadline", "override", "custom date", "filing", "client"],
    category: "Clients",
    hasSideEffects: true,
  },
  {
    id: "rollover-filing",
    title: "Roll Over a Completed Filing",
    description: "After marking a filing complete, roll it over to create the next period's deadline and schedule all reminders for the next cycle automatically.",
    tags: ["rollover", "filing", "next period", "reset", "client"],
    category: "Clients",
    hasSideEffects: true,
  },
  {
    id: "pause-resume-client",
    title: "Pause & Resume Reminders",
    description: "Temporarily pause all automated reminders for a client without losing any configuration. Resuming picks up exactly where things left off.",
    tags: ["pause", "resume", "reminders", "stop", "client", "inactive"],
    category: "Clients",
    hasSideEffects: true,
  },
  {
    id: "delete-client",
    title: "Delete a Client",
    description: "Delete a client and all associated filings from Prompt, with a confirmation step to ensure nothing is removed by accident.",
    tags: ["delete", "remove", "client"],
    category: "Clients",
    hasSideEffects: true,
  },
  {
    id: "bulk-delete-clients",
    title: "Bulk Delete Clients",
    description: "Select multiple clients from the table and remove them in a single action, with a confirmation step to prevent accidental deletion.",
    tags: ["bulk", "delete", "multiple", "clients", "toolbar"],
    category: "Clients",
    hasSideEffects: true,
  },
  {
    id: "generate-portal-link",
    title: "Generate a Client Portal Link",
    description: "Generate a secure portal link for a client to upload documents. Portal links can also be configured to generate automatically in emails sent to clients.",
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

  // ───────────────────────────────────────────
  // Emails
  // ───────────────────────────────────────────
  {
    id: "adhoc-email",
    title: "Send an Ad-hoc Email",
    description: "Select clients and send a custom email using any template. Template variables update automatically for each selected recipient, so one send goes out personalised to every client.",
    tags: ["email", "send", "ad-hoc", "clients", "bulk", "template"],
    category: "Emails",
    hasSideEffects: true,
  },
  {
    id: "send-email-single-client",
    title: "Send Email to a Single Client",
    description: "Compose and send an email from the client detail page — useful for quick follow-ups with the client's full filing history in context.",
    tags: ["email", "send", "single", "client", "detail"],
    category: "Emails",
    hasSideEffects: true,
  },
  {
    id: "view-email-activity",
    title: "View Sent Email Activity",
    description: "Browse all sent emails with delivery statuses — a complete history of every email Prompt has sent.",
    tags: ["activity", "email", "logs", "sent", "delivery", "status"],
    category: "Emails",
    hasSideEffects: false,
  },
  {
    id: "view-queued-emails",
    title: "Preview & Manage Queued Emails",
    description: "Preview queued emails before they're sent, send them early, cancel them, or let them go out on schedule.",
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
    description: "Create a new email template with subject line, body content, and placeholder variables like client name, deadline date, and portal link that are filled in automatically per recipient.",
    tags: ["template", "create", "new", "email", "custom", "placeholders"],
    category: "Email Templates",
    hasSideEffects: true,
  },
  {
    id: "edit-email-template",
    title: "Edit an Existing Email Template",
    description: "Open any template in the editor to refine wording, update subject lines, and reformat the body. Changes apply to all future emails using the template.",
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
    description: "Remove a template you no longer need. Deletion is not possible if the template is currently in use by a deadline's reminder schedule.",
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
    description: "Choose which deadlines your practice tracks. Configured during setup wizard but editable any time from the deadlines page. Only active types generate reminders.",
    tags: ["filing types", "configure", "select", "deadlines", "setup"],
    category: "Deadlines",
    hasSideEffects: true,
  },
  {
    id: "edit-reminder-schedule",
    title: "Edit a Deadline's Reminder Schedule",
    description: "Open a deadline's schedule editor to adjust timing, change required documents, add steps, and configure which email templates are sent.",
    tags: ["schedule", "reminder", "edit", "steps", "timing", "deadline", "configure"],
    category: "Deadlines",
    hasSideEffects: true,
  },
  {
    id: "activate-deadline-for-client",
    title: "Activate a Deadline for a Client",
    description: "From a client's detail page, activate an inactive deadline for that client. Prompt calculates the deadline date and begins scheduling reminders automatically.",
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
    description: "Create a custom deadline with your own name, date, and recurrence rule. Choose an email template for each step, add as many reminder steps as you need, and assign to clients.",
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
    description: "Preview uploaded documents, see validation results, pass review or reject them, and navigate between uploads without leaving the review modal.",
    tags: ["review", "approve", "reject", "document", "upload", "validation", "portal"],
    category: "Documents",
    hasSideEffects: true,
  },
  {
    id: "view-upload-activity",
    title: "View Upload Activity Log",
    description: "View all document uploads with their validation status. Search for specific uploads, filter by status or filing type, and change the sort order.",
    tags: ["uploads", "activity", "log", "documents", "validation", "status"],
    category: "Documents",
    hasSideEffects: false,
  },

  // ───────────────────────────────────────────
  // Settings
  // ───────────────────────────────────────────
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
    id: "enable-client-portal",
    title: "Enable the Client Portal",
    description: "Turn on the client upload portal so clients can submit documents through a secure link.",
    tags: ["portal", "client", "enable", "upload", "settings"],
    category: "Settings",
    hasSideEffects: true,
  },
  {
    id: "configure-upload-checks",
    title: "Configure Upload Checks",
    description: "Configure how uploads are validated — automatic acceptance, manual review, or document classification. Options include file type/size checks, tax year verification, and more.",
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
    description: "Permanently delete your Prompt account and ALL associated data — clients, filings, emails, templates, documents, and team members.",
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

  // ───────────────────────────────────────────
  // Client Portal
  // ───────────────────────────────────────────
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
