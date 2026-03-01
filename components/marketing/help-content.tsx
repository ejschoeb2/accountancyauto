"use client";

import { useState, useRef } from "react";
import { motion, useInView } from "framer-motion";
import { GettingStartedIllustration }        from "./help-illustrations/getting-started";
import { ManagingClientsIllustration }        from "./help-illustrations/managing-clients";
import { UnderstandingDeadlinesIllustration } from "./help-illustrations/understanding-deadlines";
import { ReminderSchedulesIllustration }      from "./help-illustrations/reminder-schedules";
import { EmailTemplatesIllustration }         from "./help-illustrations/email-templates";
import { UploadPortalIllustration }           from "./help-illustrations/upload-portal";
import { TeamSettingsIllustration }           from "./help-illustrations/team-settings";

type IllustrationComponent = React.ComponentType<{ isHovered: boolean }>;

interface HelpTopic {
  number:       string;
  title:        string;
  description:  string;
  details:      { heading: string; text: string }[];
  Illustration: IllustrationComponent;
}

const helpTopics: HelpTopic[] = [
  {
    number: "01",
    title: "Getting Started",
    description:
      "Setting up Prompt takes just a few minutes. Once you've created your account and organisation, you can import your entire client list and start tracking deadlines immediately.",
    details: [
      {
        heading: "Create your organisation",
        text: "After signing up, you'll be guided through creating your organisation. This is the workspace that holds all your clients, templates, and settings. You can name it after your practice and invite team members later.",
      },
      {
        heading: "Import your clients",
        text: "The fastest way to get started is with a CSV import. Prompt accepts a simple spreadsheet with your client names, company numbers, year-end dates, and VAT details. You can also add clients one at a time from the Clients page.",
      },
      {
        heading: "Deadlines are calculated instantly",
        text: "As soon as a client is added with their year-end date, Prompt automatically calculates every relevant UK filing deadline — Corporation Tax, CT600, Companies House, VAT returns, and Self Assessment. No manual entry required.",
      },
    ],
    Illustration: GettingStartedIllustration,
  },
  {
    number: "02",
    title: "Managing Clients",
    description:
      "Your client list is the heart of Prompt. Each client record holds the information Prompt needs to calculate deadlines and send the right reminders at the right time.",
    details: [
      {
        heading: "Client fields explained",
        text: "Each client has a name, company number, year-end date, and VAT stagger group. The year-end date determines Corporation Tax, CT600, and Companies House deadlines. The VAT stagger group (1, 2, or 3) maps to the three HMRC quarterly cycles and determines when VAT return reminders are sent.",
      },
      {
        heading: "Inline editing",
        text: "You can edit any client field directly from the client table — just click the value you want to change. Updates save automatically and deadlines recalculate in real time. No need to open separate edit pages.",
      },
      {
        heading: "CSV import & bulk actions",
        text: "Import hundreds of clients at once using a CSV file. Prompt validates each row before importing, catching duplicate company numbers, invalid dates, and missing fields. The import preview shows exactly what will be created so you can review before confirming.",
      },
    ],
    Illustration: ManagingClientsIllustration,
  },
  {
    number: "03",
    title: "Understanding Deadlines",
    description:
      "Prompt calculates every major UK filing deadline automatically from your clients' year-end dates. The dashboard uses a traffic-light system so you can see at a glance which deadlines need attention.",
    details: [
      {
        heading: "How deadlines are calculated",
        text: "Corporation Tax is due 9 months and 1 day after the year-end. CT600 returns are due 12 months after. Companies House annual accounts are due 9 months after. VAT returns are due 1 month and 7 days after the quarter-end. Self Assessment is always 31 January following the tax year.",
      },
      {
        heading: "The traffic-light system",
        text: "Deadlines are colour-coded by urgency. Red means overdue. Orange means critical — less than 7 days remaining. Amber means approaching — between 7 and 28 days away. Blue means scheduled — more than 28 days out. Green means records have been received. Grey means the client is paused or inactive.",
      },
      {
        heading: "VAT stagger groups",
        text: "HMRC assigns businesses to one of three VAT stagger groups, each with different quarterly dates. Group 1 covers Mar/Jun/Sep/Dec quarters, Group 2 covers Jan/Apr/Jul/Oct, and Group 3 covers Feb/May/Aug/Nov. Prompt uses your client's stagger group to calculate the correct VAT return deadlines automatically.",
      },
    ],
    Illustration: UnderstandingDeadlinesIllustration,
  },
  {
    number: "04",
    title: "Reminder Schedules",
    description:
      "Reminder schedules are automated email sequences that chase your clients for outstanding documents. Set them up once and Prompt handles the rest — sending reminders on your chosen intervals until the documents arrive.",
    details: [
      {
        heading: "Creating a schedule",
        text: "A reminder schedule defines when and how often Prompt contacts your clients. You choose the filing type (e.g. Corporation Tax, VAT), the number of reminder stages, and the interval between each one. For example: Day 1, Day 7, Day 14, Day 21.",
      },
      {
        heading: "How the pipeline works",
        text: "The automated pipeline runs daily. It checks each client's deadlines, determines which reminder stage they're at, and sends the appropriate email using your configured template. If a client uploads their documents, the pipeline stops chasing them automatically.",
      },
      {
        heading: "Pausing & control",
        text: "You can pause a reminder schedule at any time without losing your place. When you resume, it picks up exactly where it left off. You can also pause individual clients to temporarily exclude them from reminders without affecting the rest of your client list.",
      },
    ],
    Illustration: ReminderSchedulesIllustration,
  },
  {
    number: "05",
    title: "Email Templates",
    description:
      "Every reminder email Prompt sends is fully customisable. Templates support dynamic variables that automatically insert client-specific information — no more copy-pasting names and dates.",
    details: [
      {
        heading: "Template variables",
        text: "Use variables like {{client_name}}, {{deadline_type}}, {{deadline_date}}, and {{upload_link}} in your templates. When an email is sent, Prompt replaces these with the actual values for each client. The upload link is unique to each client and filing, taking them directly to their secure upload portal.",
      },
      {
        heading: "Customising your templates",
        text: "You can create different templates for different reminder stages. A friendly first reminder, a firmer follow-up, and an urgent final chase. Each template can have its own subject line and body. Edit them from the Email Templates page in the dashboard.",
      },
      {
        heading: "Sending from your domain",
        text: "Prompt integrates with Postmark for email delivery. You can configure emails to be sent from your own domain (e.g. reminders@yourpractice.co.uk) so clients recognise the sender. This requires a one-time DNS setup that the settings wizard guides you through.",
      },
    ],
    Illustration: EmailTemplatesIllustration,
  },
  {
    number: "06",
    title: "The Client Portal",
    description:
      "Your clients receive a secure, no-login upload link in every reminder email. They can see exactly which documents are still outstanding and upload them directly — no accounts, no passwords, no friction.",
    details: [
      {
        heading: "How clients use it",
        text: "Each reminder email includes a unique portal link. When a client clicks it, they see a checklist of the documents you need for that filing. They can drag and drop files or browse to upload. No sign-up or login required — the link is their authentication.",
      },
      {
        heading: "Document tracking",
        text: "As clients upload documents, Prompt updates the checklist in real time. You can see from your dashboard which documents have arrived and which are still missing. Once all required documents are received, the status changes to green and chasing stops automatically.",
      },
      {
        heading: "Security & storage",
        text: "All uploaded documents are stored securely in EU-region infrastructure. Downloads use short-lived signed URLs — direct storage access is never exposed. Every upload and download is logged with timestamps for a full audit trail.",
      },
    ],
    Illustration: UploadPortalIllustration,
  },
  {
    number: "07",
    title: "Team & Settings",
    description:
      "Prompt is built for teams. Invite your colleagues, control who can access what, and configure your organisation's preferences from a single settings page.",
    details: [
      {
        heading: "Inviting team members",
        text: "Admins can invite team members by email from the Settings page. Invited members receive a setup link and are guided through a brief onboarding wizard. They join your organisation and can immediately see clients and deadlines.",
      },
      {
        heading: "Roles & permissions",
        text: "There are two roles: Admin and Member. Admins have full access to settings, billing, team management, email templates, and reminder schedules. Members can view and manage clients but cannot change organisation-level configuration.",
      },
      {
        heading: "Organisation settings",
        text: "From Settings, admins can update the organisation name, configure email sending (Postmark integration), manage the subscription, and control which features are enabled. Changes take effect immediately across the entire team.",
      },
    ],
    Illustration: TeamSettingsIllustration,
  },
];

/* ───────────────── Card component ───────────────── */

const HelpCard = ({ topic, index }: { topic: HelpTopic; index: number }) => {
  const [isHovered, setIsHovered] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-60px" });
  const { Illustration } = topic;

  return (
    <motion.div
      ref={ref}
      className="rounded-2xl bg-card border border-border/60 shadow-lg overflow-hidden transition-shadow duration-500 hover:shadow-2xl"
      initial={{ opacity: 0, y: 40 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay: index * 0.06 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Illustration area — full width, taller than features section */}
      <div className="h-48 sm:h-56 border-b border-border/30 bg-muted/20">
        <Illustration isHovered={isHovered} />
      </div>

      {/* Content area */}
      <div className="p-6 sm:p-8 lg:p-10">
        {/* Number + Title */}
        <div className="flex items-baseline gap-3 mb-3">
          <span className="text-xs font-semibold text-muted-foreground/40 tabular-nums tracking-wider">
            {topic.number}
          </span>
          <h3 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">
            {topic.title}
          </h3>
        </div>

        {/* Main description */}
        <p className="text-[15px] text-muted-foreground leading-relaxed mb-8 max-w-2xl">
          {topic.description}
        </p>

        {/* Detail cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {topic.details.map((detail, i) => (
            <motion.div
              key={detail.heading}
              className="space-y-2"
              initial={{ opacity: 0, y: 12 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: index * 0.06 + i * 0.1 + 0.3, duration: 0.4 }}
            >
              <h4 className="text-sm font-semibold text-foreground">
                {detail.heading}
              </h4>
              <p className="text-[13px] text-muted-foreground leading-relaxed">
                {detail.text}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
};

/* ───────────────── Page section ───────────────── */

export const HelpContent = () => {
  return (
    <section className="py-16 lg:py-24">
      <div className="max-w-screen-xl mx-auto px-4">

        {/* Page header */}
        <div className="text-center mb-16 lg:mb-24">
          <p className="text-[13px] font-semibold tracking-[0.25em] uppercase text-muted-foreground mb-5">
            Help Centre
          </p>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground tracking-tight leading-[1.1] mb-5">
            Learn how to use Prompt
          </h1>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
            Everything you need to know about managing clients, tracking deadlines, and automating your practice.
          </p>
        </div>

        {/* Help topic cards — full-width, stacked vertically */}
        <div className="space-y-8 lg:space-y-12">
          {helpTopics.map((topic, i) => (
            <HelpCard key={topic.number} topic={topic} index={i} />
          ))}
        </div>

      </div>
    </section>
  );
};
