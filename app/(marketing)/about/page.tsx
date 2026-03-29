"use client";

import Image from "next/image";
import Script from "next/script";
import { motion } from "framer-motion";
import { ArrowRight, Mail, Phone } from "lucide-react";
import { MarketingNav } from "@/components/marketing/nav";
import { FooterSection } from "@/components/marketing/footer-section";

const spring = { type: "spring" as const, stiffness: 90, damping: 18 };

const team = [
  {
    name: "Ethan Schoeb",
    role: "Co-Founder",
    image: "/ethanshot.jpeg",
    bio: "Computer Science student at the University of Bath. Grew up watching his mum navigate the stress of running a practice solo — and decided to build the tool she never had.",
  },
  {
    name: "Will Crook",
    role: "Co-Founder",
    image: "/willshot.JPG",
    bio: "University of Bath. Joined Ethan through the university's entrepreneur society to validate the problem across practices and help bring Prompt to life.",
  },
  {
    name: "Georgina Schoeb",
    role: "Advisor",
    image: "/mum.png",
    bio: "Chartered Accountant and founder of Peninsula Accounting. Former EY (8 years). The practitioner perspective behind every feature in Prompt.",
  },
];

export default function AboutPage() {
  return (
    <main className="min-h-screen">
      <MarketingNav />

      {/* ── Hero ── */}
      <section className="pt-16 sm:pt-24 lg:pt-32 pb-20 lg:pb-28">
        <div className="max-w-screen-xl mx-auto px-4">
          <div className="max-w-3xl">
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...spring, delay: 0 }}
              className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-foreground leading-[1.08] mb-6"
            >
              Built by someone who saw the fines land on the doormat.
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...spring, delay: 0.12 }}
              className="text-base lg:text-lg text-muted-foreground leading-relaxed max-w-2xl"
            >
              Prompt started at a kitchen table — not in a boardroom. It exists
              because one accountant&apos;s son watched the stress of chasing
              clients, missing deadlines, and paying penalties that were entirely
              preventable.
            </motion.p>
          </div>
        </div>
      </section>

      {/* ── Story ── */}
      <section className="pb-20 lg:pb-28">
        <div className="max-w-screen-xl mx-auto px-4">
          <div className="max-w-3xl space-y-16">
            {/* Chapter 1 — The problem */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={spring}
              className="space-y-4"
            >
              <h2 className="text-2xl font-bold text-foreground">
                Growing up in a one-person practice
              </h2>
              <div className="space-y-4 text-base text-muted-foreground leading-relaxed">
                <p>
                  My mum, Georgina, spent eight years as a chartered accountant
                  at EY before going out on her own to start{" "}
                  <a
                    href="https://www.peninsulaaccounting.co.uk/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-violet-600 hover:text-violet-700 font-medium transition-colors"
                  >
                    Peninsula Accounting
                  </a>
                  . She traded the corporate structure for independence — but
                  independence meant doing everything herself.
                </p>
                <p>
                  I grew up watching her juggle dozens of clients, each with
                  their own year-end dates, Corporation Tax deadlines, VAT
                  quarters, and Companies House filings. The spreadsheets were
                  colour-coded, the calendar was full, and the stress was
                  constant. One missed deadline meant an HMRC fine — not for
                  her, but for her client. That weight sat on her shoulders
                  every single day.
                </p>
                <p>
                  I remember the late nights before Self Assessment in January,
                  the frantic calls chasing records that should have arrived
                  weeks ago, and the frustration of knowing there had to be a
                  better way.
                </p>
              </div>
            </motion.div>

            {/* Chapter 2 — Validation */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={spring}
              className="space-y-4"
            >
              <h2 className="text-2xl font-bold text-foreground">
                It wasn&apos;t just her
              </h2>
              <div className="space-y-4 text-base text-muted-foreground leading-relaxed">
                <p>
                  When I got to the University of Bath and joined the
                  entrepreneur society, I started exploring the problem
                  properly. Will and I began reaching out to accounting
                  practices around Bath — small firms, sole practitioners,
                  bookkeepers managing a handful of clients.
                </p>
                <p>
                  The conversations all sounded the same. Everyone was
                  spending hours every week manually chasing clients for
                  records. Everyone had a system of spreadsheets, sticky
                  notes, or Outlook reminders that sort-of worked until it
                  didn&apos;t. And almost everyone had a story about a fine
                  that could have been avoided.
                </p>
                <p>
                  The pain wasn&apos;t niche — it was universal. It just
                  hadn&apos;t been solved properly because the tools that
                  existed were either too expensive, too complex, or built for
                  large firms with compliance teams.
                </p>
              </div>
            </motion.div>

            {/* Chapter 3 — The product */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={spring}
              className="space-y-4"
            >
              <h2 className="text-2xl font-bold text-foreground">
                So we built it
              </h2>
              <div className="space-y-4 text-base text-muted-foreground leading-relaxed">
                <p>
                  Prompt is the tool my mum never had. It tracks every
                  deadline across every client, sends reminder sequences
                  automatically, and lets clients upload documents without a
                  single phone call. It was designed from day one for small
                  practices — the people who don&apos;t have a compliance
                  department, who are the accountant <em>and</em> the
                  admin <em>and</em> the client manager.
                </p>
                <p>
                  Mum has been our first tester, our harshest critic, and our
                  most valuable advisor. Every feature in Prompt has been
                  shaped by her real workflows and real frustrations. If it
                  doesn&apos;t make her life easier, it doesn&apos;t ship.
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── Team ── */}
      <section className="pb-20 lg:pb-28">
        <div className="max-w-screen-xl mx-auto px-4">
          <motion.h2
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={spring}
            className="text-2xl font-bold text-foreground mb-8"
          >
            The team
          </motion.h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {team.map((person, i) => (
              <motion.div
                key={person.name}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ ...spring, delay: i * 0.08 }}
                className="bg-card border border-border/60 rounded-2xl overflow-hidden shadow-md shadow-black/[0.07]"
              >
                <div className="aspect-[4/3] relative bg-muted">
                  <Image
                    src={person.image}
                    alt={person.name}
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="p-6">
                  <h3 className="text-lg font-bold text-foreground">
                    {person.name}
                  </h3>
                  <p className="text-sm font-semibold text-violet-600 mb-3">
                    {person.role}
                  </p>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {person.bio}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Contact ── */}
      <section className="pb-20 lg:pb-28">
        <div className="max-w-screen-xl mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={spring}
          >
            <h2 className="text-2xl font-bold text-foreground mb-6">
              Get in touch
            </h2>
            <div className="flex flex-col sm:flex-row gap-4">
              <a
                href="mailto:info@prompt.accountants"
                className="flex items-center gap-3 bg-card border border-border/60 rounded-2xl px-6 py-4 shadow-md shadow-black/[0.07] hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300"
              >
                <Mail className="size-5 text-violet-600 shrink-0" />
                <span className="text-sm font-medium text-foreground">info@prompt.accountants</span>
              </a>
              <a
                href="tel:+447795032668"
                className="flex items-center gap-3 bg-card border border-border/60 rounded-2xl px-6 py-4 shadow-md shadow-black/[0.07] hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300"
              >
                <Phone className="size-5 text-violet-600 shrink-0" />
                <span className="text-sm font-medium text-foreground">07795 032668</span>
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Book a call ── */}
      <section className="pb-20 lg:pb-28">
        <div className="max-w-screen-xl mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={spring}
          >
            <h2 className="text-2xl font-bold text-foreground mb-2">
              Book a call
            </h2>
            <p className="text-base text-muted-foreground mb-6">
              Want to see how Prompt could work for your practice? Pick a time that suits you.
            </p>
            <div className="bg-card border border-border/60 rounded-2xl shadow-md shadow-black/[0.07] overflow-hidden">
              <div
                className="calendly-inline-widget"
                data-url="https://calendly.com/ejschoeb/30min?hide_event_type_details=1&hide_gdpr_banner=1&text_color=2a2a2a&primary_color=8e51ff"
                style={{ minWidth: 320, height: 700 }}
              />
            </div>
          </motion.div>
        </div>
      </section>

      <Script
        src="https://assets.calendly.com/assets/external/widget.js"
        strategy="lazyOnload"
      />

      {/* ── CTA ── */}
      <section className="pb-20 lg:pb-28">
        <div className="max-w-screen-xl mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={spring}
            className="bg-card border border-border/60 rounded-2xl shadow-md shadow-black/[0.07] p-8 sm:p-12 text-center"
          >
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">
              Want to try Prompt?
            </h2>
            <p className="text-base text-muted-foreground mb-6 max-w-lg mx-auto">
              We&apos;re working closely with early practices to shape the
              product. If deadline chaos sounds familiar, we&apos;d love to
              hear from you.
            </p>
            <a
              href="/signup"
              className="inline-flex items-center gap-2 rounded-full bg-violet-600 px-8 py-4 text-lg font-semibold text-white shadow-md shadow-violet-500/30 hover:bg-violet-700 hover:shadow-violet-500/50 active:scale-95 transition-all duration-200"
            >
              Get started
              <ArrowRight size={18} />
            </a>
          </motion.div>
        </div>
      </section>

      <FooterSection />
    </main>
  );
}
