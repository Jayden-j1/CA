// prisma/seed.ts
//
// Purpose:
// - Seed your DB with multiple test users + payments.
// - Includes both unpaid and paid users for testing access gating + billing history.
//
// Accounts created:
// - user-no-pay@example.com → USER (unpaid)
// - user-paid@example.com → USER (paid, Individual Package, 2 payments)
// - owner@example.com → BUSINESS_OWNER (paid, Business Package, 2 payments)
// - admin@example.com → ADMIN
//
// Usage:
//   1. Run `npx prisma migrate reset` (recommended → clears DB & applies schema)
//   2. Run `npm run seed`
//   3. Log in with printed credentials
//
// Notes:
// - `upsert` ensures users/business aren’t duplicated
// - Payments use `create` only → duplicates possible if not reset first
// - Useful for testing Billing page with multiple history rows

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const plainPassword = "password123";

async function main() {
  const hashedPassword = await bcrypt.hash(plainPassword, 10);

  // --- 1. USER with no payment ---
  const userNoPay = await prisma.user.upsert({
    where: { email: "user-no-pay@example.com" },
    update: {},
    create: {
      name: "User NoPay",
      email: "user-no-pay@example.com",
      hashedPassword,
      role: "USER",
    },
  });

  // --- 2. USER with Individual Package payments ---
  const userPaid = await prisma.user.upsert({
    where: { email: "user-paid@example.com" },
    update: {},
    create: {
      name: "User Paid",
      email: "user-paid@example.com",
      hashedPassword,
      role: "USER",
    },
  });

  // Multiple payments for history testing
  await prisma.payment.create({
    data: {
      userId: userPaid.id,
      amount: 50,
      currency: "aud",
      stripeId: "test_stripe_individual_1",
      description: "Individual Package - Initial Purchase",
    },
  });
  await prisma.payment.create({
    data: {
      userId: userPaid.id,
      amount: 50,
      currency: "aud",
      stripeId: "test_stripe_individual_2",
      description: "Individual Package - Renewal",
    },
  });

  // --- 3. Business Owner with Business Package payments ---
  const businessOwner = await prisma.user.upsert({
    where: { email: "owner@example.com" },
    update: {},
    create: {
      name: "Business Owner",
      email: "owner@example.com",
      hashedPassword,
      role: "BUSINESS_OWNER",
    },
  });

  // Ensure Business record exists
  const business = await prisma.business.upsert({
    where: { domain: "example.com" },
    update: { ownerId: businessOwner.id },
    create: {
      name: "Example Corp",
      domain: "example.com",
      owner: { connect: { id: businessOwner.id } },
    },
  });

  // Multiple payments for history testing
  await prisma.payment.create({
    data: {
      userId: businessOwner.id,
      amount: 150,
      currency: "aud",
      stripeId: "test_stripe_business_1",
      description: "Business Package - Initial Purchase",
    },
  });
  await prisma.payment.create({
    data: {
      userId: businessOwner.id,
      amount: 150,
      currency: "aud",
      stripeId: "test_stripe_business_2",
      description: "Business Package - Renewal",
    },
  });

  // --- 4. Admin (no payments) ---
  await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: {},
    create: {
      name: "Admin User",
      email: "admin@example.com",
      hashedPassword,
      role: "ADMIN",
    },
  });

  // ✅ Log credentials
  console.log("✅ Seed complete!");
  console.log("➡️  USER (no pay): user-no-pay@example.com /", plainPassword);
  console.log("➡️  USER (paid): user-paid@example.com /", plainPassword);
  console.log("➡️  BUSINESS_OWNER: owner@example.com /", plainPassword);
  console.log("➡️  ADMIN: admin@example.com /", plainPassword);
  console.log("Business linked:", business.name, "Domain:", business.domain);
}

// Run safely
main()
  .then(async () => await prisma.$disconnect())
  .catch(async (e) => {
    console.error("❌ Seed error:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
