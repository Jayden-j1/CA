// prisma/seed.ts
//
// Purpose:
// - Seed your DB with multiple test users + payments.
// - Ensures business owners are correctly linked to Business via businessId.
// - Includes test users for unpaid, paid (individual + business), admin, and NEW: staff seat.
// - Makes CSV export/reconciliation easier by pre-seeding both PACKAGE and STAFF_SEAT payments.
//
// Usage:
//   1. Run `npx prisma migrate reset` (resets DB & applies schema).
//   2. Run `npm run seed`.
//   3. Log in with the printed credentials.
//
// Notes:
// - `upsert` ensures idempotent creation (avoids duplicates).
// - Payments use explicit `purpose` ("PACKAGE" | "STAFF_SEAT") so you can test filters/exports.
// - Console logs confirm each seeded entity.

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const plainPassword = "password123";

async function main() {
  const hashedPassword = await bcrypt.hash(plainPassword, 10);

  // --- 1. USER with no payment ---
  await prisma.user.upsert({
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

  // Add payments for testing history
  await prisma.payment.create({
    data: {
      userId: userPaid.id,
      amount: 50,
      currency: "aud",
      stripeId: "test_stripe_individual_1",
      description: "Individual Package - Initial Purchase",
      purpose: "PACKAGE",
    },
  });
  await prisma.payment.create({
    data: {
      userId: userPaid.id,
      amount: 50,
      currency: "aud",
      stripeId: "test_stripe_individual_2",
      description: "Individual Package - Renewal",
      purpose: "PACKAGE",
    },
  });

  // --- 3. Business Owner with Business Package payments ---
  let businessOwner = await prisma.user.upsert({
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

  // ✅ Link businessId back to owner user
  businessOwner = await prisma.user.update({
    where: { id: businessOwner.id },
    data: { businessId: business.id },
  });

  // Add business package payments
  await prisma.payment.create({
    data: {
      userId: businessOwner.id,
      amount: 150,
      currency: "aud",
      stripeId: "test_stripe_business_1",
      description: "Business Package - Initial Purchase",
      purpose: "PACKAGE",
    },
  });
  await prisma.payment.create({
    data: {
      userId: businessOwner.id,
      amount: 150,
      currency: "aud",
      stripeId: "test_stripe_business_2",
      description: "Business Package - Renewal",
      purpose: "PACKAGE",
    },
  });

  // --- 4. Staff member with STAFF_SEAT payment ---
  const staffUser = await prisma.user.upsert({
    where: { email: "staff-seed@example.com" },
    update: {},
    create: {
      name: "Staff Seed",
      email: "staff-seed@example.com",
      hashedPassword,
      role: "USER",
      businessId: business.id, // ✅ linked to Example Corp
    },
  });

  await prisma.payment.create({
    data: {
      userId: staffUser.id,
      amount: 99,
      currency: "aud",
      stripeId: "test_stripe_staff_seat_1",
      description: "Staff Seat Payment (seeded)",
      purpose: "STAFF_SEAT",
    },
  });

  // --- 5. Admin (no payments) ---
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
  console.log("➡️  STAFF (seeded staff seat): staff-seed@example.com /", plainPassword);
  console.log("➡️  ADMIN: admin@example.com /", plainPassword);
  console.log("Business linked:", business.name, "Domain:", business.domain);
  console.log("BusinessOwner businessId:", businessOwner.businessId);
}

// Run safely
main()
  .then(async () => await prisma.$disconnect())
  .catch(async (e) => {
    console.error("❌ Seed error:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
