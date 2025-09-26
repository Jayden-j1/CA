// lib/stripe.ts
//
// Purpose:
// - Provide a single initialized Stripe client across the app.
// - Avoids duplicate imports and conflicts.
// - Uses correct Stripe API version.
//
// Notes:
// - Always import { stripe } from "@/lib/stripe" in your API routes.
// - Do NOT create local `new Stripe(...)` instances elsewhere.

import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-08-27.basil", // ✅ Correct version for your project
});
