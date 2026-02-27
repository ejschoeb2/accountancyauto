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
export type PlanTier = "free" | "starter" | "practice" | "enterprise";

/** Tiers that go through Stripe Checkout (i.e. have a Stripe Price ID) */
export const PAID_PLAN_TIERS: PlanTier[] = ["starter", "practice"];

export interface PlanConfig {
  tier: PlanTier;
  /** Human-readable display name */
  name: string;
  /** Stripe Price ID (from env var). Empty string for free/enterprise. */
  priceId: string;
  /** Monthly price in pence (for display purposes). 0 for free/enterprise. */
  monthlyPrice: number;
  /** Maximum number of clients, null = unlimited (overage billing applies for Practice) */
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
    monthlyPrice: 8900, // £89/mo base
    clientLimit: null, // unlimited — overage billing above 300 via metered component
    features: [
      "Unlimited clients",
      "Email reminders",
      "Custom templates",
      "Filing tracking",
      "Priority support",
      "£0.60/client above 300",
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

/** Practice tier overage threshold — clients above this count incur per-client charges */
export const PRACTICE_OVERAGE_THRESHOLD = 300;
/** Practice overage rate in pence per client per month */
export const PRACTICE_OVERAGE_RATE_PENCE = 60; // £0.60

/**
 * Stripe Price ID for Practice overage metered billing.
 * Must be a Stripe metered price (usage_type: 'metered') configured in the Dashboard.
 * Empty string if not configured — Practice checkout falls back to flat-rate only.
 */
export const PRACTICE_OVERAGE_PRICE_ID = process.env.STRIPE_PRICE_PRACTICE_OVERAGE ?? "";

/**
 * Stripe Billing Meter event name for Practice overage.
 * Must match the `event_name` on the Billing Meter created in Stripe Dashboard.
 * Used by the metered billing cron to report client overage counts.
 */
export const PRACTICE_METER_EVENT_NAME =
  process.env.STRIPE_METER_EVENT_NAME ?? "practice_overage_clients";

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
