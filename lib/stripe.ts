// lib/stripe.ts
//
// Purpose:
// - Provides a single, centralized Stripe client across your app.
// - Ensures the Secret Key is only ever used server-side.
// - Uses a fixed, stable Stripe API version for compatibility.
//
// Notes:
// - STRIPE_SECRET_KEY (sk_test_...) must be set in `.env.local`.
// - NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY (pk_test_...) is for client-side use if you integrate Stripe.js later.

import Stripe from "stripe";

// ✅ Initialize once with server-side secret
// Important: Never expose STRIPE_SECRET_KEY in client-side code.
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  // ✅ Cast to any so TS doesn’t force future/beta versions
  apiVersion: "2023-10-16" as any, 
});
