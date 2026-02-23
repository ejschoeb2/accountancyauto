"use client";

import { HeroParticles } from "@/components/marketing/hero-particles";

export const HeroSection = () => {
  return (
    <section className="py-20 lg:py-32 overflow-hidden">
      <div className="max-w-6xl mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">

          {/* Left column — text and CTA */}
          <div className="flex flex-col gap-6">
            <h1 className="text-5xl lg:text-6xl font-bold tracking-tight text-foreground">
              The Chase Is Over
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed max-w-lg">
              Automated client reminders for UK accounting practices. Stop manually
              chasing records and documents — Prompt handles it for you.
            </p>
            <div className="flex flex-col gap-3">
              <a
                href="/onboarding"
                className="inline-flex items-center justify-center self-start rounded-lg bg-violet-600 px-8 py-3 text-lg font-semibold text-white hover:bg-violet-700 transition-colors"
              >
                Start Free Trial
              </a>
              <p className="text-sm text-muted-foreground">
                14-day free trial. No card required.
              </p>
            </div>
          </div>

          {/* Right column — particles (hidden on mobile via HeroParticles internals) */}
          <div className="hidden lg:block relative overflow-visible min-h-[500px]">
            <HeroParticles />
          </div>

        </div>
      </div>
    </section>
  );
};
