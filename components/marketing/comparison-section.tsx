"use client";

import { motion, type Variants } from "framer-motion";
import { CheckCircle2, XCircle, ArrowRight } from "lucide-react";

const ROWS: { oldWay: string; withPrompt: string }[] = [
  {
    oldWay:      "Manually track 12 deadlines per client in a spreadsheet",
    withPrompt:  "Prompt calculates every deadline automatically — Corporation Tax payments, CT600s, VAT, Companies House, Self Assessment",
  },
  {
    oldWay:      "Chase clients by email when records are overdue",
    withPrompt:  "Automated, personalised reminders sent at exactly the right time",
  },
  {
    oldWay:      "Hope clients remember to send their paperwork",
    withPrompt:  "Client portal: clients upload documents directly via a secure link",
  },
  {
    oldWay:      "Guess which VAT stagger group a client is in",
    withPrompt:  "Just set the stagger group and Prompt handles the rest",
  },
  {
    oldWay:      "Manually check every document — wrong tax year, wrong form, wrong client",
    withPrompt:  "Automatic document verification: Prompt classifies, validates, and flags mismatches before you touch a thing",
  },
  {
    oldWay:      "No record of who was chased or when",
    withPrompt:  "Full audit log: every action tracked, every email logged",
  },
  {
    oldWay:      "Manually roll over deadlines to the new tax year",
    withPrompt:  "One-click year rollover — all deadlines updated instantly",
  },
  {
    oldWay:      "One person holds all the knowledge — risky if they leave",
    withPrompt:  "Multi-user teams: your whole practice has visibility",
  },
];

const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.07,
    },
  },
};

const rowVariants: Variants = {
  hidden:  { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 100, damping: 14 },
  },
};

export const ComparisonSection = () => {
  return (
    <section id="comparison" className="py-20 lg:py-28">
      <div className="max-w-screen-xl mx-auto px-4">

        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ type: "spring", stiffness: 100, damping: 14 }}
          className="mb-12 lg:mb-16 max-w-2xl"
        >
          <p className="text-[13px] font-semibold tracking-[0.25em] uppercase text-muted-foreground mb-5">
            Why Switch
          </p>
          <h2 className="text-4xl lg:text-5xl font-bold text-foreground leading-[1.15]">
            Prompt vs. the old way.
          </h2>
          <p className="mt-5 text-base text-muted-foreground leading-relaxed max-w-lg">
            Most practices run on spreadsheets, sticky notes, and manual chasing.
            Here is what changes when you stop.
          </p>
        </motion.div>

        {/* Table */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
          className="rounded-2xl border border-border/60 overflow-hidden shadow-lg"
        >

          {/* Column headers */}
          <div className="grid grid-cols-2 divide-x divide-border/60">
            <div className="bg-muted/50 px-5 py-4 lg:px-8 lg:py-5">
              <span className="text-[13px] font-semibold tracking-[0.2em] uppercase text-muted-foreground/70">
                The old way 😩
              </span>
            </div>
            <div className="bg-violet-600 px-5 py-4 lg:px-8 lg:py-5">
              <span className="text-[13px] font-semibold tracking-[0.2em] uppercase text-violet-100">
                With Prompt ✓
              </span>
            </div>
          </div>

          {/* Rows */}
          {ROWS.map((row, i) => (
            <motion.div
              key={i}
              variants={rowVariants}
              className="grid grid-cols-2 divide-x divide-border/60 border-t border-border/60"
            >
              {/* Old way cell */}
              <div className="flex items-start gap-3 px-5 py-5 lg:px-8 lg:py-6 bg-muted/20">
                <XCircle
                  size={17}
                  className="flex-shrink-0 mt-[2px] text-rose-400/80"
                  aria-hidden="true"
                />
                <p className="text-sm text-muted-foreground leading-relaxed line-through decoration-muted-foreground/40">
                  {row.oldWay}
                </p>
              </div>

              {/* With Prompt cell */}
              <div className="flex items-start gap-3 px-5 py-5 lg:px-8 lg:py-6 bg-violet-50/5">
                <CheckCircle2
                  size={17}
                  className="flex-shrink-0 mt-[2px] text-violet-500"
                  aria-hidden="true"
                />
                <p className="text-sm text-foreground leading-relaxed font-medium">
                  {row.withPrompt}
                </p>
              </div>
            </motion.div>
          ))}

        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ type: "spring", stiffness: 100, damping: 14, delay: 0.1 }}
          className="mt-10 flex justify-center"
        >
          <a
            href="/signup"
            className="group inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold bg-violet-600 text-white shadow-md shadow-violet-500/30 hover:bg-violet-700 hover:shadow-violet-500/50 active:scale-95 transition-all duration-200"
          >
            Start for free — no credit card needed
            <ArrowRight size={14} className="transition-transform duration-200 group-hover:translate-x-0.5" />
          </a>
        </motion.div>

      </div>
    </section>
  );
};
