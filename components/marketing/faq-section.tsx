"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus } from "lucide-react";

const FAQS = [
  {
    q: "What deadlines does Prompt track?",
    a: "Prompt tracks all major UK filing deadlines: Corporation Tax payments, CT600 returns, Companies House confirmation statements, VAT returns (all three HMRC stagger groups), and Self Assessment. Deadlines are calculated automatically from each client's accounting year-end and VAT stagger group — you never enter a date manually.",
  },
  {
    q: "How does the free plan work?",
    a: "The free plan supports up to 10 clients with no time limit and no credit card required. You get access to all core features — deadline tracking, automated reminders, and the client upload portal. When your client count grows beyond 10, you simply upgrade to a paid plan.",
  },
  {
    q: "Do my clients need to create an account?",
    a: "No. Clients receive a secure, personalised link in each reminder email. Clicking it takes them straight to their upload portal — no registration, no password, no friction. The link is filing-specific and short-lived for security.",
  },
  {
    q: "Can I send reminders from my own domain?",
    a: "Yes. Prompt sends emails through your own domain using Postmark. You'll verify your domain during onboarding, and emails land in your clients' inboxes looking exactly like they came from you — because they did.",
  },
  {
    q: "How are uploaded documents stored?",
    a: "Uploaded documents are forwarded directly to your connected cloud storage — Google Drive, OneDrive, or Dropbox. Prompt never stores your clients' files on its own servers. GDPR compliant by design: your data stays in your cloud, not ours.",
  },
  {
    q: "Can I customise the deadline reminders?",
    a: "Yes. You control when reminders go out relative to each deadline — how many days in advance, how frequently to chase, and what the emails say. Templates are fully customisable per filing type.",
  },
  {
    q: "What happens after a client uploads their documents?",
    a: "Each upload is automatically classified and verified using document intelligence — Prompt checks tax years, employer names, and PAYE references. Verified documents are forwarded to your cloud storage. Mismatches are flagged, and wrong documents can be auto-rejected before they reach your desk.",
  },
  {
    q: "Is Prompt suitable for sole practitioners as well as full practices?",
    a: "Absolutely. The free tier covers up to 10 clients — perfect for a sole practitioner or small bookkeeper. The Solo, Starter, Practice, and Firm plans scale with you as your client list grows.",
  },
];

const FaqItem = ({
  q,
  a,
  isOpen,
  onToggle,
}: {
  q: string;
  a: string;
  isOpen: boolean;
  onToggle: () => void;
}) => (
  <div className="border-b border-border/60 last:border-none">
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between gap-6 py-5 text-left group"
    >
      <span className="text-[15px] font-semibold text-foreground group-hover:text-violet-500 transition-colors duration-150">
        {q}
      </span>
      <motion.div
        animate={{ rotate: isOpen ? 45 : 0 }}
        transition={{ duration: 0.2, ease: "easeInOut" }}
        className="flex-shrink-0 text-muted-foreground group-hover:text-violet-500 transition-colors duration-150"
      >
        <Plus size={18} />
      </motion.div>
    </button>

    <AnimatePresence initial={false}>
      {isOpen && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
          className="overflow-hidden"
        >
          <p className="text-sm text-muted-foreground leading-relaxed pb-5 pr-8">
            {a}
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  </div>
);

export const FaqSection = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="py-20 lg:py-28">
      <div className="max-w-screen-xl mx-auto px-4">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-14 items-start">

          {/* Left: sticky header */}
          <div className="lg:col-span-4 lg:pt-2 lg:sticky lg:top-24">
            <p className="text-[13px] font-semibold tracking-[0.25em] uppercase text-muted-foreground mb-5">
              FAQ
            </p>
            <h2 className="text-4xl lg:text-5xl font-bold text-foreground leading-[1.15]">
              Everything<br className="hidden lg:block" /> you need<br className="hidden lg:block" /> to know.
            </h2>
            <p className="mt-6 text-sm text-muted-foreground leading-relaxed">
              Something else on your mind?{" "}
              <a
                href="mailto:hello@phasetwo.uk"
                className="text-violet-500 hover:text-violet-400 transition-colors"
              >
                Get in touch.
              </a>
            </p>
          </div>

          {/* Right: accordion */}
          <div className="lg:col-span-8 lg:pt-2">
            {FAQS.map((item, i) => (
              <FaqItem
                key={i}
                q={item.q}
                a={item.a}
                isOpen={openIndex === i}
                onToggle={() => setOpenIndex(openIndex === i ? null : i)}
              />
            ))}
          </div>

        </div>
      </div>
    </section>
  );
};
