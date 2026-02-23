"use client";

import { Bell, CalendarDays, MailOpen } from "lucide-react";

const features = [
  {
    icon: Bell,
    iconClass: "text-status-info",
    title: "Automated Reminders",
    description:
      "Set up reminder schedules once and let Prompt chase your clients automatically. Reminders fire on your timetable — no manual intervention required.",
  },
  {
    icon: CalendarDays,
    iconClass: "text-status-warning",
    title: "Deadline Tracking",
    description:
      "Never miss a filing deadline again. Prompt tracks Corporation Tax, VAT, Self Assessment, and Companies House deadlines for every client in your portfolio.",
  },
  {
    icon: MailOpen,
    iconClass: "text-green-500",
    title: "Email Management",
    description:
      "Send professional emails from your own domain with customisable templates. Inbound replies are captured and logged, giving you a full audit trail for every client.",
  },
] as const;

export const FeaturesSection = () => {
  return (
    <section id="features" className="py-20 lg:py-24 bg-muted/30">
      <div className="max-w-6xl mx-auto px-6">

        {/* Section heading */}
        <div className="text-center mb-14">
          <h2 className="text-3xl lg:text-4xl font-bold text-foreground">
            What We Do
          </h2>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            Three tools that cover everything between you and a fully automated practice.
          </p>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className="bg-white rounded-xl border border-border p-8 shadow-sm"
              >
                <div className="mb-5">
                  <Icon size={36} className={feature.iconClass} strokeWidth={1.75} />
                </div>
                <h3 className="text-lg font-bold text-foreground mb-3">
                  {feature.title}
                </h3>
                <p className="text-muted-foreground leading-relaxed text-sm">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
};
