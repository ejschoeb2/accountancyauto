/**
 * Plan tier configuration for Stripe billing.
 *
 * Price IDs come from environment variables so test-mode and production
 * Stripe accounts can use different values. Prices and limits are
 * placeholder values to be finalised before launch.
 */

// Matches the plan_tier_enum in the database
export type PlanTier = "lite" | "sole_trader" | "practice" | "firm";

export interface PlanConfig {
  tier: PlanTier;
  /** Human-readable display name */
  name: string;
  /** Stripe Price ID (from env var) */
  priceId: string;
  /** Monthly price in pence (for display purposes) */
  monthlyPrice: number;
  /** Maximum number of clients, null = unlimited */
  clientLimit: number | null;
  /** Feature bullet points for pricing page */
  features: string[];
}

/**
 * All plan tiers with their configuration.
 *
 * Prices are placeholder values (confirmed with user: "Use sensible
 * placeholder prices and limits -- finalized before launch").
 *
 * Price IDs are loaded from environment variables to support
 * different Stripe accounts for test vs production.
 */
export const PLAN_TIERS: Record<PlanTier, PlanConfig> = {
  lite: {
    tier: "lite",
    name: "Lite",
    priceId: process.env.STRIPE_PRICE_LITE ?? "",
    monthlyPrice: 2000, // £20/mo
    clientLimit: 15,
    features: [
      "Up to 15 clients",
      "Email reminders",
      "Basic templates",
    ],
  },
  sole_trader: {
    tier: "sole_trader",
    name: "Sole Trader",
    priceId: process.env.STRIPE_PRICE_SOLE_TRADER ?? "",
    monthlyPrice: 3900, // £39/mo
    clientLimit: 40,
    features: [
      "Up to 40 clients",
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
    clientLimit: 150,
    features: [
      "Up to 150 clients",
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
    clientLimit: null, // Unlimited
    features: [
      "Unlimited clients",
      "Email reminders",
      "Custom templates",
      "Filing tracking",
      "Priority support",
      "Dedicated account manager",
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
export function getPlanLimits(
  tier: PlanTier
): { clientLimit: number | null } {
  const plan = PLAN_TIERS[tier];
  return { clientLimit: plan.clientLimit };
}
