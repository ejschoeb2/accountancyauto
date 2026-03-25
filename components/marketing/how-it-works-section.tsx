"use client";

import { useRef } from "react";
import { useInView } from "framer-motion";
import { AddClientsIllustration } from "./how-it-works-illustrations/add-clients";
import { DeadlinesCalculatedIllustration } from "./how-it-works-illustrations/deadlines-calculated";
import { RemindersScheduledIllustration } from "./how-it-works-illustrations/reminders-scheduled";
import { ClientUploadsIllustration } from "./how-it-works-illustrations/client-uploads";
import { CloudForwardIllustration } from "./how-it-works-illustrations/cloud-forward";
import { StayInControlIllustration } from "./how-it-works-illustrations/stay-in-control";

type IllustrationComponent = React.FC<{ isActive: boolean }>;

const STEPS: {
  number: string;
  title: string;
  description: string;
  Illustration: IllustrationComponent;
}[] = [
  {
    number: "01",
    title: "Add your clients",
    description:
      "Import from CSV or add clients one by one — client name, accounting year-end, and VAT stagger group. That's all Prompt needs. No manual deadline entry, no spreadsheets.",
    Illustration: AddClientsIllustration,
  },
  {
    number: "02",
    title: "Deadlines calculated instantly",
    description:
      "Prompt computes every relevant filing deadline for each client automatically — Corporation Tax, CT600, VAT returns, Companies House, Self Assessment. All of them, to the day.",
    Illustration: DeadlinesCalculatedIllustration,
  },
  {
    number: "03",
    title: "Reminders go out on your schedule",
    description:
      "Set your reminder schedule once. Prompt fires emails automatically at the right intervals before each deadline — from your own domain, with no further input from you.",
    Illustration: RemindersScheduledIllustration,
  },
  {
    number: "04",
    title: "Clients upload their documents",
    description:
      "Each reminder includes a secure, no-login upload link. Clients see exactly what's needed and upload directly. Prompt verifies each document automatically — checking tax years, names, and references — and keeps chasing what hasn't arrived.",
    Illustration: ClientUploadsIllustration,
  },
  {
    number: "05",
    title: "Files go straight to your cloud",
    description:
      "Connect your Google Drive, OneDrive, or Dropbox and documents are forwarded directly into your existing folders — Prompt never stores your clients' files on its own servers. GDPR compliant by design: your data stays in your cloud, not ours.",
    Illustration: CloudForwardIllustration,
  },
  {
    number: "06",
    title: "You stay in control",
    description:
      "Every document received, email sent, and client reply is logged. Full audit trail per client, per filing. Your whole team has visibility — nothing falls through the cracks.",
    Illustration: StayInControlIllustration,
  },
];

const StepCard = ({
  step,
  isLast,
}: {
  step: (typeof STEPS)[number];
  isLast: boolean;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const isActive = useInView(ref, { once: true, margin: "0px 0px -100px 0px" });
  const { Illustration } = step;

  return (
    <div ref={ref} className="flex gap-5 sm:gap-7">
      {/* Left: numbered circle + connector line */}
      <div className="flex flex-col items-center">
        <div
          className={[
            "w-9 h-9 rounded-full border-2 flex items-center justify-center shrink-0 z-10 bg-background transition-all duration-500",
            isActive
              ? "border-violet-500 bg-violet-500"
              : "border-border",
          ].join(" ")}
        >
          <span
            className={[
              "text-[11px] font-bold tabular-nums transition-colors duration-500",
              isActive ? "text-white" : "text-muted-foreground",
            ].join(" ")}
          >
            {step.number}
          </span>
        </div>
        {!isLast && <div className="w-px flex-1 bg-border/50 mt-2" />}
      </div>

      {/* Right: illustration card + title + description */}
      <div className={`flex-1 ${isLast ? "pb-0" : "pb-10"}`}>
        <div className="p-5 rounded-2xl bg-card border border-border/60 shadow-lg mb-4">
          <div className="h-40">
            <Illustration isActive={isActive} />
          </div>
        </div>

        <h3 className="text-[16px] font-bold text-foreground tracking-tight mb-2">
          {step.title}
        </h3>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {step.description}
        </p>
      </div>
    </div>
  );
};

export const HowItWorksSection = () => (
  <section id="how-it-works" className="py-20 lg:py-28">
    <div className="max-w-screen-xl mx-auto px-4">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-14 items-start">

        {/* Left: sticky header */}
        <div className="lg:col-span-4 lg:pt-2 lg:sticky lg:top-24">
          <p className="text-[13px] font-semibold tracking-[0.25em] uppercase text-muted-foreground mb-5">
            How It Works
          </p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground leading-[1.15]">
            Up and running<br className="hidden lg:block" /> in minutes.
          </h2>
          <p className="mt-5 text-sm text-muted-foreground leading-relaxed">
            No integrations required. No data migration. Add your clients and
            Prompt takes it from there.
          </p>
        </div>

        {/* Right: timeline steps */}
        <div className="lg:col-span-8">
          {STEPS.map((step, i) => (
            <StepCard key={step.number} step={step} isLast={i === STEPS.length - 1} />
          ))}
        </div>

      </div>
    </div>
  </section>
);
