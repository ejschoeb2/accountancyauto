"use client";

import { useState } from "react";
import { DeadlineTrackingIllustration }    from "./feature-illustrations/deadline-tracking";
import { AutomatedRemindersIllustration }  from "./feature-illustrations/automated-reminders";
import { ClientUploadPortalIllustration }  from "./feature-illustrations/client-upload-portal";
import { DocumentIntelligenceIllustration } from "./feature-illustrations/document-intelligence";
import { CloudStorageSyncIllustration }    from "./feature-illustrations/cloud-storage-sync";
import { AutoRejectIllustration }          from "./feature-illustrations/auto-reject";
import { AutoConfirmIllustration }         from "./feature-illustrations/auto-confirm";
import { CustomDomainsIllustration }       from "./feature-illustrations/custom-domains";
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

/* ── Section 2: Power Features — bento grid (3 rows × 2 cols, varied splits) ── */

const powerFeatures: Feature[] = [
  {
    title:       "Client Upload Portal",
    description: "Clients receive a secure, no-login link and upload records against a filing-specific checklist. Documents go straight to your cloud storage — Prompt never stores files on its own servers.",
    Illustration: ClientUploadPortalIllustration,
  },
  {
    title:       "Document Intelligence",
    description: "Every upload is automatically classified, verified, and scored. Prompt checks tax years, employer names, and PAYE references — flagging mismatches before they reach your desk.",
    Illustration: DocumentIntelligenceIllustration,
  },
  {
    title:       "Smart Auto-Reject",
    description: "Wrong tax year? Wrong document type? Prompt catches it instantly and rejects the upload before it ever reaches your desk — clients are prompted to re-upload the right file.",
    Illustration: AutoRejectIllustration,
  },
  {
    title:       "Auto-Confirm Documents",
    description: "When a document passes the smart scan, Prompt automatically marks it as received. No manual review needed — verified records flow straight into your dashboard.",
    Illustration: AutoConfirmIllustration,
  },
  {
    title:       "Cloud Storage Sync",
    description: "Uploaded documents land directly in your Google Drive, OneDrive, or Dropbox — organised by client and filing type. Your files, your storage, always.",
    Illustration: CloudStorageSyncIllustration,
  },
  {
    title:       "Custom Domains",
    description: "Send reminders from your own domain — reminders@yourfirm.co.uk instead of a generic address. Professional, trusted, and fully authenticated with DKIM and SPF.",
    Illustration: CustomDomainsIllustration,
  },
];

/* ── Shared card component ── */

const FeatureCard = ({ feature, variant = "stacked", reversed = false }: { feature: Feature; variant?: "stacked" | "horizontal"; reversed?: boolean }) => {
  const [isHovered, setIsHovered] = useState(false);
  const { Illustration } = feature;

  if (variant === "horizontal") {
    const textBlock = (
      <div className="md:col-span-3 p-8 md:p-10 flex flex-col justify-center">
        <h3 className="text-xl font-bold text-foreground tracking-tight mb-3">
          {feature.title}
        </h3>
        <p className="text-[15px] text-muted-foreground leading-relaxed">
          {feature.description}
        </p>
      </div>
    );

    const illustrationBlock = (
      <div className="md:col-span-9 p-6 md:p-8 flex items-center justify-center">
        <div className="w-full h-full min-h-[320px]">
          <Illustration isHovered={isHovered} />
        </div>
      </div>
    );

    return (
      <div
        className="group rounded-2xl bg-card border border-border/60 shadow-lg transition-all duration-500 hover:shadow-2xl hover:-translate-y-1 cursor-default grid grid-cols-1 md:grid-cols-12 min-h-[400px]"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {reversed ? (
          <>
            {illustrationBlock}
            {textBlock}
          </>
        ) : (
          <>
            {textBlock}
            {illustrationBlock}
          </>
        )}
      </div>
    );
  }

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

/* ── Bento grid card for power features ── */

const BentoCard = ({ feature }: { feature: Feature }) => {
  const [isHovered, setIsHovered] = useState(false);
  const { Illustration } = feature;

  return (
    <div
      className="group h-full rounded-2xl bg-card border border-border/60 shadow-lg transition-all duration-500 hover:shadow-2xl hover:-translate-y-1 cursor-default grid grid-cols-1 md:grid-cols-2 overflow-hidden min-h-[220px]"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Text — left */}
      <div className="flex flex-col justify-center px-5 py-5">
        <h3 className="text-[15px] font-bold text-foreground tracking-tight mb-1.5">
          {feature.title}
        </h3>
        <p className="text-[13px] text-muted-foreground leading-relaxed">
          {feature.description}
        </p>
      </div>

      {/* Illustration — right */}
      <div className="flex items-center justify-center p-4 min-h-[180px]">
        <Illustration isHovered={isHovered} />
      </div>
    </div>
  );
};

/* ── Exports ── */

export const FeaturesSection = () => (
  <section id="features" className="relative z-[1] py-20 lg:py-28">
    <div className="max-w-screen-xl mx-auto px-4">
      {/* Header */}
      <div className="mb-16">
        <p className="text-[13px] font-semibold tracking-[0.25em] uppercase text-muted-foreground mb-5">
          How It Works
        </p>
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground leading-[1.15]">
          Less admin.<br className="hidden lg:block" /> More accounting.
        </h2>
      </div>

      {/* Full-width horizontal cards — alternating text/illustration sides */}
      <div className="flex flex-col gap-8">
        {coreFeatures.map((f, i) => (
          <FeatureCard key={f.title} feature={f} variant="horizontal" reversed={i % 2 === 1} />
        ))}
      </div>
    </div>
  </section>
);

export const DocumentCollectionSection = () => (
  <section className="relative z-[1] py-20 lg:py-28">
    <div className="max-w-screen-xl mx-auto px-4">

      {/* Section header — centred above the grid */}
      <div className="mb-12">
        <p className="text-[13px] font-semibold tracking-[0.25em] uppercase text-muted-foreground mb-5">
          Take it further
        </p>
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground leading-[1.15]">
          Documents in.<br className="hidden lg:block" /> Chasing over.
        </h2>
      </div>

      {/* Bento grid — 3 rows × 2 cols, subtle alternating splits */}
      <div className="flex flex-col gap-5">
        {/* Row 1 (55/45): Upload Portal + Document Intelligence */}
        <div className="flex flex-col md:flex-row gap-5">
          <div className="md:w-[55%]">
            <BentoCard feature={powerFeatures[0]} />
          </div>
          <div className="md:w-[45%]">
            <BentoCard feature={powerFeatures[1]} />
          </div>
        </div>

        {/* Row 2 (45/55): Auto-Reject + Custom Domains */}
        <div className="flex flex-col md:flex-row gap-5">
          <div className="md:w-[45%]">
            <BentoCard feature={powerFeatures[2]} />
          </div>
          <div className="md:w-[55%]">
            <BentoCard feature={powerFeatures[5]} />
          </div>
        </div>

        {/* Row 3 (55/45): Cloud Storage + Auto-Confirm */}
        <div className="flex flex-col md:flex-row gap-5">
          <div className="md:w-[55%]">
            <BentoCard feature={powerFeatures[4]} />
          </div>
          <div className="md:w-[45%]">
            <BentoCard feature={powerFeatures[3]} />
          </div>
        </div>
      </div>

    </div>
  </section>
);
