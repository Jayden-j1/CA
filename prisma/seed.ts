// prisma/seed.ts
//
// Purpose:
// - Populate your database with starter data for local development/testing.
// - Seeds 4 roles:
//   1. USER
//   2. BUSINESS_OWNER
//   3. STAFF (linked to the business)
//   4. ADMIN
//
// Notes:
// - All seeded users use "password123" (bcrypt-hashed).
// - This makes it easy to log in and test role-based navigation in your app.
// - DO NOT use this in production!
//
// Run with: npx prisma db seed
//
// Accounts created:
//   USER → alice@example.com / password123
//   BUSINESS_OWNER → owner@example.com / password123
//   STAFF → staff@example.com / password123
//   ADMIN → admin@example.com / password123
//
// Also creates a "Example Business" owned by BUSINESS_OWNER.

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  //  Shared test password for all accounts
  const hashedPassword = await bcrypt.hash("password123", 10);

  // --- 1. Regular USER ---
  await prisma.user.upsert({
    where: { email: "alice@example.com" },
    update: {}, // do nothing if exists
    create: {
      name: "Alice Example",
      email: "alice@example.com",
      hashedPassword, // new schema field
      role: "USER",
    },
  });

  // --- 2. BUSINESS_OWNER ---
  const owner = await prisma.user.upsert({
    where: { email: "owner@example.com" },
    update: {},
    create: {
      name: "Bob Owner",
      email: "owner@example.com",
      hashedPassword,
      role: "BUSINESS_OWNER",
    },
  });

  // --- 3. Business owned by BUSINESS_OWNER ---
  const business = await prisma.business.upsert({
    where: { domain: "example.com" }, // Business domain must be unique
    update: {},
    create: {
      name: "Example Business",
      domain: "example.com",
      owner: { connect: { id: owner.id } }, // Link to owner
    },
  });

  // --- 4. STAFF (linked to Example Business) ---
  await prisma.user.upsert({
    where: { email: "staff@example.com" },
    update: {},
    create: {
      name: "Charlie Staff",
      email: "staff@example.com",
      hashedPassword,
      role: "USER", // staff are just regular users, but tied to a business
      businessId: business.id, // belongs to Example Business
    },
  });

  // --- 5. ADMIN ---
  await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: {},
    create: {
      name: "Alice Admin",
      email: "admin@example.com",
      hashedPassword,
      role: "ADMIN", // top-level role
    },
  });

  console.log("Seed completed: USER, BUSINESS_OWNER, STAFF, ADMIN + Business created");
}

// Run + disconnect
main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
