// prisma/seed.ts
//
// Purpose:
// - Seed your DB with multiple test users + payments.
// - Includes both unpaid and paid users for testing access gating.
//
// Accounts created:
// - user-no-pay@example.com → USER (unpaid)
// - user-paid@example.com → USER (paid, Individual Package)
// - owner@example.com → BUSINESS_OWNER (paid, Business Package)
// - admin@example.com → ADMIN
//
// Usage:
//   npm run seed

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

  // --- 2. USER with Individual Package payment ---
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

  // ❌ FIX: cannot use upsert on Payment since stripeId isn’t unique
  // ✅ Instead, just create payment record (clear DB before reseeding if needed)
  await prisma.payment.create({
    data: {
      userId: userPaid.id,
      amount: 50,
      currency: "aud",
      stripeId: "test_stripe_individual",
      description: "Individual Package",
    },
  });

  // --- 3. Business Owner with Business Package ---
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

  // Create Business Package payment
  await prisma.payment.create({
    data: {
      userId: businessOwner.id,
      amount: 150,
      currency: "aud",
      stripeId: "test_stripe_business",
      description: "Business Package",
    },
  });

  // --- 4. Admin (no payment needed) ---
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
