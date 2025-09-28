/**
 * scripts/env-check.ts
 *
 * Purpose:
 * - Run a one-command sanity check for your `.env.local` configuration and database.
 * - Helps catch missing/invalid Stripe keys or DB connectivity issues *before* running the app.
 *
 * Features:
 *  - Loads .env.local explicitly, with .env as fallback.
 *  - Prints which env files are detected in the project root.
 *  - Verifies Stripe secret key + publishable key exist.
 *  - Validates STRIPE_*_PRICE env vars are integers in cents (e.g. 8000 not 80).
 *  - Connects to Prisma DB: counts users + attempts an insert/delete of a dummy user.
 *  - Optional `--staff-seat` flag: simulate creating a dummy staff-seat checkout session.
 *  - Outputs a ✅ / ❌ summary at the end (color-coded).
 *
 * Usage:
 *   npm run env-check
 *   npm run env-check -- --staff-seat
 */

import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import Stripe from "stripe";
import { PrismaClient } from "@prisma/client";

// Load `.env.local` first, then fallback to `.env`
dotenv.config({ path: ".env.local" });
dotenv.config();

const prisma = new PrismaClient();
const args = process.argv.slice(2);

// Utility: color output (green/red)
const green = (msg: string) => `\x1b[32m${msg}\x1b[0m`;
const red = (msg: string) => `\x1b[31m${msg}\x1b[0m`;

async function main() {
  console.log("=== .env Sanity Check ===");

  // -------------------------------
  // 1. List env files present
  // -------------------------------
  const root = process.cwd();
  const candidates = [".env.local", ".env", ".env.development", ".env.production"];
  const found = candidates.filter((f) => fs.existsSync(path.join(root, f)));
  console.log("Env files found in project root:", found.length > 0 ? found : "(none)");

  // -------------------------------
  // 2. Check Stripe keys
  // -------------------------------
  const stripeSecret = process.env.STRIPE_SECRET_KEY;
  const stripePub = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

  if (stripeSecret) {
    console.log(green(`✅ STRIPE_SECRET_KEY prefix: ${stripeSecret.substring(0, 8)}`));
  } else {
    console.log(red("❌ STRIPE_SECRET_KEY missing"));
  }

  if (stripePub) {
    console.log(green(`✅ NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY prefix: ${stripePub.substring(0, 8)}`));
  } else {
    console.log(red("❌ NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY missing"));
  }

  // -------------------------------
  // 3. Validate Stripe prices
  // -------------------------------
  const priceVars = [
    "STRIPE_INDIVIDUAL_PRICE",
    "STRIPE_BUSINESS_PRICE",
    "STRIPE_STAFF_SEAT_PRICE",
  ];

  for (const varName of priceVars) {
    const val = process.env[varName];
    if (!val) {
      console.log(red(`❌ ${varName} missing`));
      continue;
    }

    const parsed = parseInt(val, 10);
    if (isNaN(parsed) || parsed <= 0) {
      console.log(red(`❌ ${varName} is not a valid integer: ${val}`));
    } else if (parsed < 100) {
      console.log(red(`❌ ${varName} looks too small (did you mean cents, e.g. 8000?) → ${parsed}`));
    } else {
      console.log(green(`✅ ${varName} = ${parsed} cents`));
    }
  }

  // -------------------------------
  // 4. Database checks
  // -------------------------------
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.log(red("❌ DATABASE_URL missing"));
  } else {
    console.log(green(`✅ DATABASE_URL length: ${dbUrl.length}`));
  }

  try {
    // Count users
    const count = await prisma.user.count();
    console.log(green(`✅ DB reachable, user count: ${count}`));

    // Insert + delete dummy user
    const dummy = await prisma.user.create({
      data: { email: "dummy-env-check@example.com", name: "Dummy User", hashedPassword: "test" },
    });
    console.log(green("✅ DB write test inserted dummy user"));

    await prisma.user.delete({ where: { id: dummy.id } });
    console.log(green("✅ DB write test cleanup succeeded"));
  } catch (err) {
    console.error(red("❌ DB error:"), err);
  }

  // -------------------------------
  // 5. Optional Stripe smoke test
  // -------------------------------
  if (args.includes("--staff-seat")) {
    if (!stripeSecret) {
      console.error(red("❌ Cannot run staff-seat smoke test: STRIPE_SECRET_KEY missing"));
    } else {
      try {
        const stripe = new Stripe(stripeSecret, { apiVersion: "2023-10-16" as any });

        const session = await stripe.checkout.sessions.create({
          mode: "payment",
          payment_method_types: ["card"],
          line_items: [
            {
              price_data: {
                currency: "aud",
                product_data: { name: "Dummy Staff Seat (env-check)" },
                unit_amount: parseInt(process.env.STRIPE_STAFF_SEAT_PRICE || "5000", 10),
              },
              quantity: 1,
            },
          ],
          success_url: "http://localhost:3000/success",
          cancel_url: "http://localhost:3000/cancel",
        });

        console.log(green("✅ Stripe staff-seat smoke test created session"));
        console.log("   Checkout URL:", session.url);
      } catch (err: any) {
        console.error(red("❌ Stripe smoke test failed:"), err.message);
      }
    }
  }

  console.log("\n=== Sanity Check Complete ===");
}

main()
  .then(() => prisma.$disconnect())
  .catch((err) => {
    console.error("Fatal error in env-check:", err);
    prisma.$disconnect();
  });
