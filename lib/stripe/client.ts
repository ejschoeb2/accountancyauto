import Stripe from "stripe";

/**
 * Lazy-initialised Stripe SDK instance.
 *
 * Uses the secret key from environment and pins the API version to
 * ensure consistent behaviour across deployments.
 *
 * Lazy init prevents build failures when STRIPE_SECRET_KEY is not set
 * (e.g. during `next build` page data collection).
 *
 * Usage:
 *   import { stripe } from "@/lib/stripe/client";
 *   const session = await stripe.checkout.sessions.create({ ... });
 */
let _stripe: Stripe | null = null;

export const stripe: Stripe = new Proxy({} as Stripe, {
  get(_target, prop, receiver) {
    if (!_stripe) {
      const key = process.env.STRIPE_SECRET_KEY;
      if (!key) {
        throw new Error(
          "STRIPE_SECRET_KEY is not set. Configure it in your environment variables."
        );
      }
      _stripe = new Stripe(key, {
        apiVersion: "2026-01-28.clover",
        typescript: true,
      });
    }
    return Reflect.get(_stripe, prop, receiver);
  },
});
