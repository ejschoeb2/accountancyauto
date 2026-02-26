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
export type PlanTier = "free" | "starter" | "practice" | "firm" | "enterprise";

/** Tiers that go through Stripe Checkout (i.e. have a Stripe Price ID) */
export const PAID_PLAN_TIERS: PlanTier[] = ["starter", "practice", "firm"];

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
    clientLimit: 25,
    features: [
      "Up to 25 clients",
      "Email reminders",
      "Filing tracking",
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
    ],
  },
  practice: {
    tier: "practice",
    name: "Practice",
    priceId: process.env.STRIPE_PRICE_PRACTICE ?? "",
    monthlyPrice: 8900, // £89/mo
    clientLimit: 300,
    features: [
      "Up to 300 clients",
      "Email reminders",
      "Custom templates",
      "Filing tracking",
      "Priority support",
    ],
  },
  firm: {
    tier: "firm",
    name: "Firm",
    priceId: process.env.STRIPE_PRICE_FIRM ?? "",
    monthlyPrice: 15900, // £159/mo
    clientLimit: 500,
    features: [
      "Up to 500 clients",
      "Email reminders",
      "Custom templates",
      "Filing tracking",
      "Priority support",
      "Dedicated account manager",
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
      "Priority support",
      "Dedicated account manager",
      "Custom integrations",
    ],
  },
};

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
