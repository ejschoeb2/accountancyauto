"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight } from "lucide-react";

const SLIDER_MIN = 1;
const SLIDER_MAX = 500;

function sliderPct(value: number): number {
  return ((value - SLIDER_MIN) / (SLIDER_MAX - SLIDER_MIN)) * 100;
}

interface TierInfo {
  key: string;
  name: string;
  range: string;
  tagline: string;
  featured: boolean;
  isEnterprise: boolean;
  isFirm: boolean;
  price: number | null;
  overage?: { clients: number; rate: number };
  cta: string;
  ctaHref: string;
}

function getTier(clients: number): TierInfo {
  if (clients <= 25) return {
    key: "free", name: "Free", range: "Up to 25 clients",
    tagline: "Get started at no cost. Upgrade naturally when your practice grows.",
    featured: false, isEnterprise: false, isFirm: false,
    price: 0, cta: "Get Started Free", ctaHref: "/onboarding",
  };
  if (clients <= 100) return {
    key: "starter", name: "Starter", range: "26 – 100 clients",
    tagline: "For independent accountants and small practices.",
    featured: false, isEnterprise: false, isFirm: false,
    price: 39, cta: "Get Started", ctaHref: "/onboarding",
  };
  if (clients <= 300) return {
    key: "practice", name: "Practice", range: "101 – 300 clients",
    tagline: "For growing practices managing a wide range of deadlines.",
    featured: true, isEnterprise: false, isFirm: false,
    price: 89, cta: "Get Started", ctaHref: "/onboarding",
  };
  if (clients < SLIDER_MAX) {
    const overageClients = clients - 300;
    return {
      key: "firm", name: "Firm", range: "301+ clients",
      tagline: "Scales with your firm. No ceiling, no surprises.",
      featured: false, isEnterprise: false, isFirm: true,
      price: Math.round(89 + overageClients * 0.60),
      overage: { clients: overageClients, rate: 0.60 },
      cta: "Get Started", ctaHref: "/onboarding",
    };
  }
  return {
    key: "enterprise", name: "Enterprise", range: "500+ clients",
    tagline: "For large firms with complex needs. Let's build a plan around you.",
    featured: false, isEnterprise: true, isFirm: false,
    price: null, cta: "Get in Touch", ctaHref: "mailto:hello@phasetwo.uk",
  };
}

// Free zone = 0–5% of track (clients 1–25), rest is unified violet
const TRACK_SEGMENTS = [
  { from: 0,  to: 5,   cls: "bg-green-400"  },  // Free
  { from: 5,  to: 100, cls: "bg-violet-600" },  // Starter → Firm
];

const TICK_MARKS = [
  { pct: 5,  label: "25"  },
  { pct: 20, label: "100" },
  { pct: 60, label: "300" },
];

export const PricingSection = () => {
  const [clients, setClients] = useState(50);
  const tier = getTier(clients);
  const pct  = sliderPct(clients);

  return (
    <section id="pricing" className="py-20 lg:py-28">
      <div className="max-w-6xl mx-auto px-4">

        {/* ── Top row: header (left) + card (right) ──────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-8 lg:gap-16 items-stretch mb-0 lg:mb-0">

          {/* Header + client count */}
          <div className="flex flex-col justify-between gap-8 lg:py-1">
            <div>
              <p className="text-[11px] font-semibold tracking-[0.25em] uppercase text-muted-foreground mb-5">
                Pricing
              </p>
              <h2 className="text-4xl lg:text-5xl font-bold text-foreground leading-[1.15]">
                Pay for what you use.<br className="hidden lg:block" /> Free until you need more.
              </h2>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-3">
                How many clients do you manage?
              </p>
              <div className="flex items-end gap-3">
                <span className="text-7xl lg:text-8xl font-bold tabular-nums text-foreground leading-none">
                  {clients >= SLIDER_MAX ? `${SLIDER_MAX}+` : clients}
                </span>
                <span className="text-xl text-muted-foreground mb-2">clients</span>
              </div>
            </div>
          </div>

          {/* Dynamic pricing card */}
          <AnimatePresence mode="wait">
            <motion.div
              key={tier.key}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -14 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className={[
                "flex flex-col p-7 rounded-2xl border shadow-lg",
                tier.featured
                  ? "bg-violet-500/[0.03] border-violet-500/40"
                  : tier.isEnterprise
                  ? "bg-card border-dashed border-border"
                  : "bg-card border-border/60",
              ].join(" ")}
            >
              {tier.featured && (
                <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-violet-500 mb-3">
                  Most Popular
                </p>
              )}

              <h3 className="text-lg font-bold text-foreground tracking-tight mb-4">
                {tier.name}
              </h3>

              {/* Price */}
              {tier.isEnterprise ? (
                <div className="mb-5">
                  <p className="text-3xl font-bold text-foreground">Custom pricing</p>
                </div>
              ) : tier.price === 0 ? (
                <div className="mb-5">
                  <span className="text-5xl font-bold text-foreground tabular-nums leading-none">£0</span>
                  <span className="text-sm text-muted-foreground ml-2">forever free</span>
                </div>
              ) : (
                <div className="mb-2">
                  <span className="text-5xl font-bold text-foreground tabular-nums leading-none">
                    £{tier.price}
                  </span>
                  <span className="text-sm text-muted-foreground ml-1.5">/mo</span>
                </div>
              )}

              {/* Firm overage breakdown */}
              <div className="mb-4 min-h-[1.25rem]">
                {tier.isFirm && tier.overage && (
                  <p className="text-xs text-muted-foreground">
                    £89 base + {tier.overage.clients} × £0.60
                  </p>
                )}
              </div>

              <p className="text-sm font-semibold text-foreground/65 mb-3">
                {tier.range}
              </p>

              <p className="text-sm text-muted-foreground leading-relaxed flex-1 mb-6">
                {tier.tagline}
              </p>

              <a
                href={tier.ctaHref}
                className="group self-start inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold bg-gradient-to-r from-sky-500 to-sky-400 text-white shadow-md shadow-sky-500/30 hover:shadow-sky-500/50 hover:from-sky-400 hover:to-sky-300 active:scale-95 transition-all duration-200 mb-5"
              >
                {tier.cta}
                <ArrowRight size={14} className="transition-transform duration-200 group-hover:translate-x-0.5" />
              </a>

              <p className="text-xs text-muted-foreground/60">
                All prices exclude VAT.
              </p>

            </motion.div>
          </AnimatePresence>

        </div>

        {/* ── Full-width slider section ───────────────────────────── */}
        <div className="mt-8 lg:mt-10">

          {/* Custom slider */}
          <div className="relative select-none mb-3" style={{ paddingTop: "10px", paddingBottom: "10px" }}>

            {/* Segmented track */}
            <div className="relative h-2 rounded-full overflow-hidden">
              {TRACK_SEGMENTS.map((seg) => (
                <div
                  key={seg.from}
                  className={`absolute inset-y-0 ${seg.cls}`}
                  style={{ left: `${seg.from}%`, width: `${seg.to - seg.from}%` }}
                />
              ))}
              {/* Dim unvisited portion */}
              <div
                className="absolute inset-y-0 right-0 bg-background/75 transition-[left] duration-[25ms] ease-linear"
                style={{ left: `${pct}%` }}
              />
            </div>

            {/* Thumb */}
            <div
              className="absolute top-1/2 w-5 h-5 rounded-full bg-background border-2 border-violet-500 shadow-md pointer-events-none transition-[left] duration-[25ms] ease-linear"
              style={{ marginTop: "-10px", left: `calc(${pct / 100} * (100% - 20px))` }}
            />

            {/* Invisible range input */}
            <input
              type="range"
              min={SLIDER_MIN}
              max={SLIDER_MAX}
              value={clients}
              onChange={(e) => setClients(Number(e.target.value))}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
          </div>

          {/* Tick marks */}
          <div className="relative h-4">
            {TICK_MARKS.map((t) => (
              <span
                key={t.label}
                className="absolute text-xs text-muted-foreground/40 -translate-x-1/2"
                style={{ left: `${t.pct}%` }}
              >
                {t.label}
              </span>
            ))}
            <span className="absolute right-0 text-xs text-muted-foreground/40">500+</span>
          </div>

        </div>

      </div>
    </section>
  );
};
