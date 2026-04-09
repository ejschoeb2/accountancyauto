"use client";

import Image from "next/image";
import Script from "next/script";
import { motion } from "framer-motion";
import { Mail, Phone } from "lucide-react";
import { MarketingNav } from "@/components/marketing/nav";
import { FooterSection } from "@/components/marketing/footer-section";

const spring = { type: "spring" as const, stiffness: 90, damping: 18 };

export default function AboutPage() {
  return (
    <main className="min-h-screen">
      <MarketingNav />

      {/* Calendly widget script — load early so embed renders */}
      <Script
        src="https://assets.calendly.com/assets/external/widget.js"
        strategy="afterInteractive"
      />

      {/* ── Hero — heading + photo + story side by side ── */}
      <section className="pt-16 sm:pt-24 lg:pt-32 pb-20 lg:pb-28">
        <div className="max-w-screen-xl mx-auto px-4">
          <div className="flex flex-col lg:flex-row items-start gap-12 lg:gap-16">
            {/* Left — heading + all story content */}
            <div className="flex-1 min-w-0 space-y-10">
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...spring, delay: 0 }}
                className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-foreground leading-[1.08]"
              >
                The Story
              </motion.h1>

              {/* The problem */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...spring, delay: 0.1 }}
                className="space-y-4 text-base text-muted-foreground leading-relaxed"
              >
                <p>
                  I created Prompt after watching my mum juggle dozens of
                  clients at her firm,{" "}
                  <a
                    href="https://www.peninsulaaccounting.co.uk/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-violet-600 hover:text-violet-700 font-medium transition-colors"
                  >
                    Peninsula Accounting Ltd
                  </a>
                  . Every client had different year-end dates, Corporation Tax
                  deadlines, VAT quarters, and Companies House filings — all
                  tracked across colour-coded spreadsheets and a calendar that
                  was always full. One missed deadline meant an HMRC fine for
                  her client, and that pressure never let up.
                </p>
                <p>
                  When I joined the University of Bath and got involved with
                  the entrepreneur society, I started reaching out to local
                  businesses to understand whether this was a wider problem.
                  It was. Accountants across Bath were dealing with the exact
                  same thing — spending hours every week chasing clients for
                  records, relying on spreadsheets and Outlook reminders that
                  worked until they didn&apos;t, and dealing with fines that
                  could have been avoided entirely.
                </p>
              </motion.div>

              {/* Background */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...spring, delay: 0.15 }}
                className="space-y-4 text-base text-muted-foreground leading-relaxed"
              >
                <p>
                  This wasn&apos;t my first time building tools for small
                  businesses. Before Prompt, I designed websites and workflow
                  automations for{" "}
                  <a
                    href="https://www.ctheworld.co.uk/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-violet-600 hover:text-violet-700 font-medium transition-colors"
                  >
                    C The World
                  </a>
                  , giving me a practical grounding in what it actually takes to
                  build software that real businesses rely on day-to-day.
                </p>
              </motion.div>

              {/* The solution */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...spring, delay: 0.2 }}
                className="space-y-4"
              >
                <h2 className="text-2xl font-bold text-foreground">
                  The Solution
                </h2>
                <div className="space-y-4 text-base text-muted-foreground leading-relaxed">
                  <p>
                    I built Prompt to fix this. It was developed in close
                    collaboration with{" "}
                    <a
                      href="https://www.peninsulaaccounting.co.uk/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-violet-600 hover:text-violet-700 font-medium transition-colors"
                    >
                      Peninsula Accounting Ltd
                    </a>
                    {" "}and accountants around Bath, with their feedback
                    shaping every stage of development. The result is a tool
                    that tracks every deadline across every client, sends
                    reminder sequences automatically, and lets clients upload
                    documents without a single phone call.
                  </p>
                  <p>
                    It was designed from day one for smaller practices — the
                    people who don&apos;t have a compliance department, who are
                    the accountant <em>and</em> the admin <em>and</em> the
                    client manager — but it works just as well for larger firms
                    looking to streamline how they manage deadlines and client
                    communication across their team.
                  </p>
                </div>
              </motion.div>
            </div>

            {/* Right — photo */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...spring, delay: 0.12 }}
              className="w-full lg:w-[320px] shrink-0"
            >
              <div className="aspect-[3/4] relative rounded-2xl overflow-hidden bg-muted shadow-md shadow-black/[0.07]">
                <Image
                  src="/ethanshot.jpeg"
                  alt="Ethan Schoeb"
                  fill
                  sizes="(max-width: 1024px) 100vw, 320px"
                  className="object-cover"
                  priority
                />
              </div>
              <p className="text-sm text-muted-foreground mt-3">
                Ethan Schoeb, Founder
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── Get in touch — Calendly + contact ── */}
      <section className="pb-20 lg:pb-28">
        <div className="max-w-screen-xl mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={spring}
          >
            <h2 className="text-2xl font-bold text-foreground mb-2">
              Get in touch
            </h2>
            <p className="text-base text-muted-foreground mb-6">
              Book a free, no-obligation call to learn more about how Prompt works — or drop us a message any time.
            </p>

            <div className="flex flex-col lg:flex-row gap-6">
              {/* Left — Calendly widget */}
              <div className="flex-1 min-w-0 bg-card border border-border/60 rounded-2xl shadow-md shadow-black/[0.07] overflow-hidden">
                <div
                  className="calendly-inline-widget"
                  data-url="https://calendly.com/ejschoeb/30min?hide_event_type_details=1&hide_gdpr_banner=1&text_color=2a2a2a&primary_color=8e51ff"
                  style={{ minWidth: 320, height: 660 }}
                />
              </div>

              {/* Right — contact details */}
              <div className="lg:w-[320px] shrink-0 flex flex-col gap-4">
                <a
                  href="mailto:info@prompt.accountants"
                  className="flex items-center gap-3 bg-card border border-border/60 rounded-2xl px-6 py-5 shadow-md shadow-black/[0.07] hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300"
                >
                  <Mail className="size-5 text-violet-600 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">Email</p>
                    <p className="text-sm font-medium text-foreground">info@prompt.accountants</p>
                  </div>
                </a>
                <a
                  href="tel:+447795032668"
                  className="flex items-center gap-3 bg-card border border-border/60 rounded-2xl px-6 py-5 shadow-md shadow-black/[0.07] hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300"
                >
                  <Phone className="size-5 text-violet-600 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">Phone</p>
                    <p className="text-sm font-medium text-foreground">07795 032668</p>
                  </div>
                </a>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <FooterSection />
    </main>
  );
}
