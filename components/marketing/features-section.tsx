"use client";

import { useState } from "react";
import { DeadlineTrackingIllustration }    from "./feature-illustrations/deadline-tracking";
import { AutomatedRemindersIllustration }  from "./feature-illustrations/automated-reminders";
import { ClientUploadPortalIllustration }  from "./feature-illustrations/client-upload-portal";
import { DocumentIntelligenceIllustration } from "./feature-illustrations/document-intelligence";
import { CloudStorageSyncIllustration }    from "./feature-illustrations/cloud-storage-sync";
import { YearRolloverIllustration }        from "./feature-illustrations/year-rollover";
import { AuditTrailIllustration }          from "./feature-illustrations/audit-trail";
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

/* ── Section 2: Power Features — bento grid ── */

interface PowerFeature extends Feature {
  span: "large" | "medium" | "small";
}

const powerFeatures: PowerFeature[] = [
  {
    title:       "Client Upload Portal",
    description: "Clients receive a secure, no-login link and upload records against a filing-specific checklist. Documents go straight to your cloud storage — Prompt never stores files on its own servers.",
    Illustration: ClientUploadPortalIllustration,
    span:        "large",
  },
  {
    title:       "Document Intelligence",
    description: "Every upload is automatically classified, verified, and scored. Prompt checks tax years, employer names, and PAYE references — flagging mismatches before they reach your desk.",
    Illustration: DocumentIntelligenceIllustration,
    span:        "medium",
  },
  {
    title:       "Cloud Storage Sync",
    description: "Uploaded documents land directly in your Google Drive, OneDrive, or Dropbox — organised by client and filing type. Your files, your storage, always.",
    Illustration: CloudStorageSyncIllustration,
    span:        "medium",
  },
  {
    title:       "One-Click Year Rollover",
    description: "New tax year? Roll every client deadline forward in one click. No re-entry, no missed filings.",
    Illustration: YearRolloverIllustration,
    span:        "small",
  },
  {
    title:       "Full Audit Trail",
    description: "Every email, upload, and status change logged with timestamps. Complete compliance-ready history at a glance.",
    Illustration: AuditTrailIllustration,
    span:        "small",
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

const BentoCard = ({ feature, span }: { feature: Feature; span: "large" | "medium" | "small" }) => {
  const [isHovered, setIsHovered] = useState(false);
  const { Illustration } = feature;

  const heightClass = span === "large" ? "min-h-[280px]" : span === "medium" ? "min-h-[260px]" : "min-h-[220px]";

  return (
    <div
      className={`group h-full rounded-2xl bg-card border border-border/60 shadow-lg transition-all duration-500 hover:shadow-2xl hover:-translate-y-1 cursor-default flex flex-col overflow-hidden ${heightClass}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Illustration */}
      <div className="flex-1 min-h-0">
        <Illustration isHovered={isHovered} />
      </div>

      {/* Text */}
      <div className="px-5 pb-5 pt-2">
        <h3 className="text-[15px] font-bold text-foreground tracking-tight mb-1.5">
          {feature.title}
        </h3>
        <p className="text-[13px] text-muted-foreground leading-relaxed">
          {feature.description}
        </p>
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
        <h2 className="text-4xl lg:text-5xl font-bold text-foreground leading-[1.15]">
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
          Optional Power Features
        </p>
        <h2 className="text-4xl lg:text-5xl font-bold text-foreground leading-[1.15]">
          Documents in.<br className="hidden lg:block" /> Chasing over.
        </h2>
      </div>

      {/* Bento grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-5 auto-rows-fr">
        {/* Row 1: Upload Portal (large, 7-col) + Document Intelligence (medium, 5-col) */}
        <div className="lg:col-span-7 md:col-span-2 lg:row-span-1">
          <BentoCard feature={powerFeatures[0]} span="large" />
        </div>
        <div className="lg:col-span-5">
          <BentoCard feature={powerFeatures[1]} span="medium" />
        </div>

        {/* Row 2: Cloud Storage (medium, 5-col) + Year Rollover (small, 3-col) + Audit Trail (small, 4-col) */}
        <div className="lg:col-span-5">
          <BentoCard feature={powerFeatures[2]} span="medium" />
        </div>
        <div className="lg:col-span-3">
          <BentoCard feature={powerFeatures[3]} span="small" />
        </div>
        <div className="lg:col-span-4">
          <BentoCard feature={powerFeatures[4]} span="small" />
        </div>
      </div>

    </div>
  </section>
);
