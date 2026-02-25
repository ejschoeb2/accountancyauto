"use client";

import { useState } from "react";
import { DeadlineTrackingIllustration }    from "./feature-illustrations/deadline-tracking";
import { AutomatedRemindersIllustration }  from "./feature-illustrations/automated-reminders";
import { ClientUploadPortalIllustration }  from "./feature-illustrations/client-upload-portal";
import { DocumentStorageIllustration }     from "./feature-illustrations/document-storage";
import { DocumentAwareEmailsIllustration } from "./feature-illustrations/document-aware-emails";
import { EmailManagementIllustration }     from "./feature-illustrations/email-management";

type IllustrationComponent = React.ComponentType<{ isHovered: boolean }>;

const features: {
  number:      string;
  title:       string;
  description: string;
  Illustration: IllustrationComponent;
}[] = [
  {
    number:      "01",
    title:       "Deadline Tracking",
    description: "Every UK filing deadline tracked automatically — Corporation Tax, CT600, VAT returns, Self Assessment, and Companies House. Prompt knows what's due for every client and when, so you never have to.",
    Illustration: DeadlineTrackingIllustration,
  },
  {
    number:      "02",
    title:       "Automated Reminders",
    description: "Set up reminder sequences once. Prompt fires them on your schedule — no manual intervention, no chasing clients yourself. The pipeline runs whether you're at your desk or not.",
    Illustration: AutomatedRemindersIllustration,
  },
  {
    number:      "03",
    title:       "Client Upload Portal",
    description: "Clients receive a secure, no-login link and upload their records against a filing-specific checklist. Prompt tracks what's arrived, what's still outstanding, and chases automatically until everything's in.",
    Illustration: ClientUploadPortalIllustration,
  },
  {
    number:      "04",
    title:       "Document Storage",
    description: "Every uploaded file stored securely in EU-region infrastructure, linked to the client and filing type. Downloads via short-lived signed URLs — direct storage access never exposed. Every download logged for full accountability.",
    Illustration: DocumentStorageIllustration,
  },
  {
    number:      "05",
    title:       "Document-Aware Emails",
    description: "Reminder emails that know what's still outstanding. Prompt dynamically lists the documents still needed and embeds a fresh upload portal link in every chase — clients see exactly what they need to provide, every time.",
    Illustration: DocumentAwareEmailsIllustration,
  },
  {
    number:      "06",
    title:       "Email Management",
    description: "Send from your own domain with fully customisable templates. Inbound client replies are captured, parsed, and logged — giving you a complete audit trail for every client communication.",
    Illustration: EmailManagementIllustration,
  },
];

const leftFeatures  = features.filter((_, i) => i % 2 === 0); // 01, 03, 05
const rightFeatures = features.filter((_, i) => i % 2 === 1); // 02, 04, 06

const FeatureCard = ({ feature }: { feature: typeof features[number] }) => {
  const [isHovered, setIsHovered] = useState(false);
  const { Illustration } = feature;

  return (
    <div
      className="group p-6 rounded-2xl bg-card border border-border/60 shadow-lg transition-all duration-500 hover:shadow-2xl hover:-translate-y-1 cursor-default"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Illustration stage */}
      <div className="mb-5 h-36">
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

export const FeaturesSection = () => {
  return (
    <section id="features" className="py-20 lg:py-28">
      <div className="max-w-6xl mx-auto px-4">

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-14">

          {/* Left: section header */}
          <div className="lg:col-span-4 lg:pt-2">
            <p className="text-[11px] font-semibold tracking-[0.25em] uppercase text-muted-foreground mb-5">
              What We Do
            </p>
            <h2 className="text-4xl lg:text-5xl font-bold text-foreground leading-[1.15]">
              Everything between you<br className="hidden lg:block" /> and a fully automated practice.
            </h2>
          </div>

          {/* Right: two-column card grid */}
          <div className="lg:col-span-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

              {/* Left card column — pushed down */}
              <div className="flex flex-col gap-4 sm:mt-16">
                {leftFeatures.map(f => (
                  <FeatureCard key={f.title} feature={f} />
                ))}
              </div>

              {/* Right card column — sits level with heading */}
              <div className="flex flex-col gap-4">
                {rightFeatures.map(f => (
                  <FeatureCard key={f.title} feature={f} />
                ))}
              </div>

            </div>
          </div>

        </div>

      </div>
    </section>
  );
};
