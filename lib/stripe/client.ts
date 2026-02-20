import Stripe from "stripe";

/**
 * Singleton Stripe SDK instance.
 *
 * Uses the secret key from environment and pins the API version to
 * ensure consistent behaviour across deployments.
 *
 * Usage:
 *   import { stripe } from "@/lib/stripe/client";
 *   const session = await stripe.checkout.sessions.create({ ... });
 */
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-01-28.clover",
  typescript: true,
});
