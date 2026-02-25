"use client";

import { Archive, Bell, CalendarDays, ListChecks, MailOpen, Upload } from "lucide-react";

const features = [
  {
    number: "01",
    icon: CalendarDays,
    iconClass: "text-amber-500",
    title: "Deadline Tracking",
    description:
      "Every UK filing deadline tracked automatically — Corporation Tax, CT600, VAT returns, Self Assessment, and Companies House. Prompt knows what's due for every client and when, so you never have to.",
  },
  {
    number: "02",
    icon: Bell,
    iconClass: "text-blue-500",
    title: "Automated Reminders",
    description:
      "Set up reminder sequences once. Prompt fires them on your schedule — no manual intervention, no chasing clients yourself. The pipeline runs whether you're at your desk or not.",
  },
  {
    number: "03",
    icon: Upload,
    iconClass: "text-violet-500",
    title: "Client Upload Portal",
    description:
      "Clients receive a secure, no-login link and upload their records against a filing-specific checklist. Prompt tracks what's arrived, what's still outstanding, and chases automatically until everything's in.",
  },
  {
    number: "04",
    icon: Archive,
    iconClass: "text-slate-500",
    title: "Document Storage",
    description:
      "Every uploaded file stored securely in EU-region infrastructure, linked to the client and filing type. Downloads via short-lived signed URLs — direct storage access never exposed. Every download logged for full accountability.",
  },
  {
    number: "05",
    icon: ListChecks,
    iconClass: "text-indigo-500",
    title: "Document-Aware Emails",
    description:
      "Reminder emails that know what's still outstanding. Prompt dynamically lists the documents still needed and embeds a fresh upload portal link in every chase — clients see exactly what they need to provide, every time.",
  },
  {
    number: "06",
    icon: MailOpen,
    iconClass: "text-emerald-500",
    title: "Email Management",
    description:
      "Send from your own domain with fully customisable templates. Inbound client replies are captured, parsed, and logged — giving you a complete audit trail for every client communication.",
  },
] as const;

export const FeaturesSection = () => {
  return (
    <section id="features" className="py-20 lg:py-28">
      <div className="max-w-6xl mx-auto px-6">

        {/* Section header — editorial, left-aligned */}
        <div className="mb-16 lg:mb-20">
          <p className="text-[11px] font-semibold tracking-[0.25em] uppercase text-muted-foreground mb-5">
            What We Do
          </p>
          <h2 className="text-4xl lg:text-5xl font-bold text-foreground leading-[1.15] max-w-xl">
            Everything between you<br className="hidden lg:block" /> and a fully automated practice.
          </h2>
        </div>

        {/* Feature rows */}
        <div>
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className="group relative overflow-hidden border-t border-border last:border-b"
              >
                {/* Background ordinal — decorative typographic anchor */}
                <span
                  className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 font-bold leading-none select-none text-foreground opacity-[0.04] group-hover:opacity-[0.08] transition-opacity duration-500"
                  style={{ fontSize: "clamp(6rem, 12vw, 10rem)" }}
                  aria-hidden="true"
                >
                  {feature.number}
                </span>

                <div className="relative py-10 lg:py-12 grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6 lg:gap-16 items-center">

                  {/* Left: icon + title */}
                  <div className="flex items-center gap-4">
                    <div className="shrink-0 w-11 h-11 rounded-xl bg-foreground/[0.05] flex items-center justify-center group-hover:bg-foreground/[0.09] transition-colors duration-300">
                      <Icon size={20} className={feature.iconClass} strokeWidth={1.5} />
                    </div>
                    <h3 className="text-[17px] font-bold text-foreground tracking-tight">
                      {feature.title}
                    </h3>
                  </div>

                  {/* Right: description */}
                  <p className="text-muted-foreground leading-relaxed text-[15px]">
                    {feature.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
};
