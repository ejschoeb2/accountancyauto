"use client";

import { useState } from "react";
import { DeadlineTrackingIllustration }    from "./feature-illustrations/deadline-tracking";
import { AutomatedRemindersIllustration }  from "./feature-illustrations/automated-reminders";
import { ClientUploadPortalIllustration }  from "./feature-illustrations/client-upload-portal";
import { DocumentIntelligenceIllustration } from "./feature-illustrations/document-intelligence";
import { DocumentAwareEmailsIllustration } from "./feature-illustrations/document-aware-emails";
import { EmailManagementIllustration }     from "./feature-illustrations/email-management";

type IllustrationComponent = React.ComponentType<{ isHovered: boolean }>;

interface Feature {
  title:       string;
  description: string;
  Illustration: IllustrationComponent;
}

/* ── Section 1: How It Works (features 1, 2, 6) ── */

const coreFeatures: Feature[] = [
  {
    title:       "Deadline Tracking",
    description: "Every UK filing deadline tracked automatically — corporation tax returns, VAT returns, Self Assessment, and Companies House. Prompt knows what's due for every client and when, so you never have to.",
    Illustration: DeadlineTrackingIllustration,
  },
  {
    title:       "Automated Reminders",
    description: "Set up reminder sequences once. Prompt fires them on your schedule — no manual intervention, no chasing clients yourself. The pipeline runs whether you're at your desk or not.",
    Illustration: AutomatedRemindersIllustration,
  },
  {
    title:       "Email Management",
    description: "Send from your own domain with fully customisable templates. Every outbound email is tracked and logged — giving you a complete audit trail of every client communication.",
    Illustration: EmailManagementIllustration,
  },
];

/* ── Section 2: Collect Records, Not Excuses (features 3, 4, 5) ── */

const documentFeatures: Feature[] = [
  {
    title:       "Client Upload Portal",
    description: "Clients receive a secure, no-login link and upload their records against a filing-specific checklist. Documents go straight to your Google Drive, OneDrive, or Dropbox — Prompt never stores your clients' files on its own servers. GDPR compliant by design.",
    Illustration: ClientUploadPortalIllustration,
  },
  {
    title:       "Document Intelligence",
    description: "Every upload is automatically classified, verified, and scored. Prompt checks tax years, employer names, and PAYE references — flagging mismatches and auto-rejecting wrong documents before they reach your desk.",
    Illustration: DocumentIntelligenceIllustration,
  },
  {
    title:       "Document-Aware Emails",
    description: "Reminder emails that know what's still outstanding. Prompt dynamically lists the documents still needed and embeds a fresh upload portal link in every chase — clients see exactly what they need to provide, every time.",
    Illustration: DocumentAwareEmailsIllustration,
  },
];

/* ── Shared card component ── */

const FeatureCard = ({ feature }: { feature: Feature }) => {
  const [isHovered, setIsHovered] = useState(false);
  const { Illustration } = feature;

  return (
    <div
      className="group p-8 rounded-2xl bg-card border border-border/60 shadow-lg transition-all duration-500 hover:shadow-2xl hover:-translate-y-1 cursor-default"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Illustration stage */}
      <div className="mb-6 h-44">
        <Illustration isHovered={isHovered} />
      </div>

      <h3 className="text-[16px] font-bold text-foreground tracking-tight mb-2.5">
        {feature.title}
      </h3>
      <p className="text-sm text-muted-foreground leading-relaxed">
        {feature.description}
      </p>
    </div>
  );
};

/* ── Shared section layout — header left, 3 cards stacked right ── */

const FeatureGroup = ({
  id,
  label,
  heading,
  subtitle,
  features,
}: {
  id?: string;
  label: string;
  heading: React.ReactNode;
  subtitle: string;
  features: Feature[];
}) => (
  <section id={id} className="relative z-[1] py-20 lg:py-28">
    <div className="max-w-screen-xl mx-auto px-4">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-20 items-start">

        {/* Left: section header */}
        <div className="lg:col-span-5 lg:pt-2 lg:sticky lg:top-24">
          <p className="text-[13px] font-semibold tracking-[0.25em] uppercase text-muted-foreground mb-5">
            {label}
          </p>
          <h2 className="text-4xl lg:text-5xl font-bold text-foreground leading-[1.15]">
            {heading}
          </h2>
          <p className="mt-5 text-base text-muted-foreground max-w-sm leading-relaxed">
            {subtitle}
          </p>
        </div>

        {/* Right: single-column stacked cards — cascading left offset */}
        <div className="lg:col-span-7 flex flex-col gap-8">
          {features.map((f, i) => (
            <div
              key={f.title}
              className="lg:max-w-[85%] ml-auto"
              style={{ marginRight: `${i * 2.5}rem` }}
            >
              <FeatureCard feature={f} />
            </div>
          ))}
        </div>

      </div>
    </div>
  </section>
);

/* ── Exports ── */

export const FeaturesSection = () => (
  <FeatureGroup
    id="features"
    label="How It Works"
    heading={<>Less admin.<br className="hidden lg:block" /> More accounting.</>}
    subtitle="Add your clients, set your schedule. Prompt tracks every UK filing deadline and sends reminders automatically — so nothing slips through the cracks."
    features={coreFeatures}
  />
);

export const DocumentCollectionSection = () => (
  <FeatureGroup
    label="Collect Records, Not Excuses"
    heading={<>Documents in.<br className="hidden lg:block" /> Chasing over.</>}
    subtitle="Turn every reminder into a collection point. Clients upload directly, documents are verified automatically, and follow-ups know exactly what's still missing."
    features={documentFeatures}
  />
);
