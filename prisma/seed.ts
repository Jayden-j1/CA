// prisma/seed.ts
//
// Purpose:
// - Seed your Neon/Postgres DB with multiple test users (USER, BUSINESS_OWNER, ADMIN).
// - Each account has a hashed password (bcrypt) so you can log in directly via your login form.
// - BUSINESS_OWNER also gets a Business record created + linked.
//
// Usage:
//   1. Run: npm run seed
//   2. Use the credentials shown in console logs to log in.
//
// Notes:
// - Uses Prisma's `upsert` (update or insert) so running it twice won't duplicate users.
// - Safe for development/testing.

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// Shared password for all seed users
const plainPassword = "password123";

async function main() {
  // Hash password once and reuse
  const hashedPassword = await bcrypt.hash(plainPassword, 10);

  // --- 1. Regular USER ---
  const user = await prisma.user.upsert({
    where: { email: "user@example.com" },
    update: {},
    create: {
      name: "Regular User",
      email: "user@example.com",
      hashedPassword,
      role: "USER",
    },
  });

  // --- 2. Business Owner ---
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

  // Ensure this owner has a Business record
  const business = await prisma.business.upsert({
    where: { domain: "example.com" }, // domain = part after @ in email
    update: { ownerId: businessOwner.id },
    create: {
      name: "Example Corp",
      domain: "example.com",
      owner: { connect: { id: businessOwner.id } },
    },
  });

  // --- 3. Admin ---
  const admin = await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: {},
    create: {
      name: "Admin User",
      email: "admin@example.com",
      hashedPassword,
      role: "ADMIN",
    },
  });

  // --- Log results so you know credentials ---
  console.log("✅ Seed complete!");
  console.log("➡️  USER: user@example.com /", plainPassword);
  console.log("➡️  BUSINESS_OWNER: owner@example.com /", plainPassword);
  console.log("➡️  ADMIN: admin@example.com /", plainPassword);
  console.log("Business linked:", business.name, "Domain:", business.domain);
}

// Run seeding + safe disconnect
main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error("❌ Seed error:", e);
    await prisma.$disconnect();
    process.exit(1);
  });










