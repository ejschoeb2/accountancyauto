/**
 * Plan tier configuration for Stripe billing.
 *
 * This file is the single source of truth for tier names, limits, prices,
 * and Stripe Price IDs. All other files import from here.
 *
 * Price IDs come from environment variables so test-mode and production
 * Stripe accounts can use different values.
 */

// Matches the plan_tier_enum in the database
export type PlanTier = "free" | "solo" | "starter" | "practice" | "firm" | "enterprise";

/** Tiers that go through Stripe Checkout (i.e. have a Stripe Price ID) */
export const PAID_PLAN_TIERS: PlanTier[] = ["solo", "starter", "practice", "firm"];

export interface PlanConfig {
  tier: PlanTier;
  /** Human-readable display name */
  name: string;
  /** Stripe Price ID (from env var). Empty string for free/enterprise. */
  priceId: string;
  /** Monthly price in pence (for display purposes). 0 for free/enterprise. */
  monthlyPrice: number;
  /** Maximum number of clients, null = unlimited */
  clientLimit: number | null;
  /** Feature bullet points for pricing page */
  features: string[];
}

export const PLAN_TIERS: Record<PlanTier, PlanConfig> = {
  free: {
    tier: "free",
    name: "Free",
    priceId: "",
    monthlyPrice: 0,
    clientLimit: 20,
    features: [
      "Up to 20 clients",
      "Email reminders",
      "Filing tracking",
    ],
  },
  solo: {
    tier: "solo",
    name: "Solo",
    priceId: process.env.STRIPE_PRICE_SOLO ?? "",
    monthlyPrice: 1900, // £19/mo
    clientLimit: 50,
    features: [
      "Up to 50 clients",
      "Email reminders",
      "Filing tracking",
      "Cloud storage integration",
    ],
  },
  starter: {
    tier: "starter",
    name: "Starter",
    priceId: process.env.STRIPE_PRICE_STARTER ?? "",
    monthlyPrice: 3900, // £39/mo
    clientLimit: 100,
    features: [
      "Up to 100 clients",
      "Email reminders",
      "Custom templates",
      "Filing tracking",
      "Cloud storage integration",
    ],
  },
  practice: {
    tier: "practice",
    name: "Practice",
    priceId: process.env.STRIPE_PRICE_PRACTICE ?? "",
    monthlyPrice: 6900, // £69/mo
    clientLimit: 200,
    features: [
      "Up to 200 clients",
      "Email reminders",
      "Custom templates",
      "Filing tracking",
      "Cloud storage integration",
      "Priority support",
    ],
  },
  firm: {
    tier: "firm",
    name: "Firm",
    priceId: process.env.STRIPE_PRICE_FIRM ?? "",
    monthlyPrice: 10900, // £109/mo
    clientLimit: 400,
    features: [
      "Up to 400 clients",
      "Email reminders",
      "Custom templates",
      "Filing tracking",
      "Cloud storage integration",
      "Priority support",
    ],
  },
  enterprise: {
    tier: "enterprise",
    name: "Enterprise",
    priceId: "",
    monthlyPrice: 0, // custom pricing
    clientLimit: null, // unlimited
    features: [
      "Unlimited clients",
      "Email reminders",
      "Custom templates",
      "Filing tracking",
      "Cloud storage integration",
      "Priority support",
      "Dedicated account manager",
      "Custom integrations",
    ],
  },
};

// ---------------------------------------------------------------------------
// Practice tier metered billing constants
// ---------------------------------------------------------------------------

/** Number of clients included in the Practice base price (overage kicks in above this). */
export const PRACTICE_OVERAGE_THRESHOLD = 200;

/** Stripe Price ID for Practice tier overage (per-client above threshold). */
export const PRACTICE_OVERAGE_PRICE_ID = process.env.STRIPE_PRICE_PRACTICE_OVERAGE ?? "";

/** Stripe Billing Meter event name for Practice tier overage reporting. */
export const PRACTICE_METER_EVENT_NAME = process.env.STRIPE_METER_EVENT_NAME ?? "";

/** Get the plan configuration for a specific tier. */
export function getPlanByTier(tier: PlanTier): PlanConfig {
  return PLAN_TIERS[tier];
}

/** Look up a plan by its Stripe Price ID. Returns undefined if no match. */
export function getPlanByPriceId(priceId: string): PlanConfig | undefined {
  return Object.values(PLAN_TIERS).find((plan) => plan.priceId === priceId);
}

/** Convenience helper to get just the limits for a tier. */
export function getPlanLimits(tier: PlanTier): { clientLimit: number | null } {
  const plan = PLAN_TIERS[tier];
  return { clientLimit: plan.clientLimit };
}
