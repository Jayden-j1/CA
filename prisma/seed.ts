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










// // prisma/seed.ts
// //
// // Purpose:
// // - Populate your database with starter data for local development/testing.
// // - Seeds 4 roles:
// //   1. USER
// //   2. BUSINESS_OWNER
// //   3. STAFF (linked to the business)
// //   4. ADMIN
// //
// // Notes:
// // - All seeded users use "password123" (bcrypt-hashed).
// // - This makes it easy to log in and test role-based navigation in your app.
// // - DO NOT use this in production!
// //
// // Run with: npx prisma db seed
// //
// // Accounts created:
// //   USER → alice@example.com / password123
// //   BUSINESS_OWNER → owner@example.com / password123
// //   STAFF → staff@example.com / password123
// //   ADMIN → admin@example.com / password123
// //
// // Also creates a "Example Business" owned by BUSINESS_OWNER.

// import { PrismaClient } from "@prisma/client";
// import bcrypt from "bcryptjs";

// const prisma = new PrismaClient();

// async function main() {
//   //  Shared test password for all accounts
//   const hashedPassword = await bcrypt.hash("password123", 10);

//   // --- 1. Regular USER ---
//   await prisma.user.upsert({
//     where: { email: "alice@example.com" },
//     update: {}, // do nothing if exists
//     create: {
//       name: "Alice Example",
//       email: "alice@example.com",
//       hashedPassword, // new schema field
//       role: "USER",
//     },
//   });

//   // --- 2. BUSINESS_OWNER ---
//   const owner = await prisma.user.upsert({
//     where: { email: "owner@example.com" },
//     update: {},
//     create: {
//       name: "Bob Owner",
//       email: "owner@example.com",
//       hashedPassword,
//       role: "BUSINESS_OWNER",
//     },
//   });

//   // --- 3. Business owned by BUSINESS_OWNER ---
//   const business = await prisma.business.upsert({
//     where: { domain: "example.com" }, // Business domain must be unique
//     update: {},
//     create: {
//       name: "Example Business",
//       domain: "example.com",
//       owner: { connect: { id: owner.id } }, // Link to owner
//     },
//   });

//   // --- 4. STAFF (linked to Example Business) ---
//   await prisma.user.upsert({
//     where: { email: "staff@example.com" },
//     update: {},
//     create: {
//       name: "Charlie Staff",
//       email: "staff@example.com",
//       hashedPassword,
//       role: "USER", // staff are just regular users, but tied to a business
//       businessId: business.id, // belongs to Example Business
//     },
//   });

//   // --- 5. ADMIN ---
//   await prisma.user.upsert({
//     where: { email: "admin@example.com" },
//     update: {},
//     create: {
//       name: "Alice Admin",
//       email: "admin@example.com",
//       hashedPassword,
//       role: "ADMIN", // top-level role
//     },
//   });

//   console.log("Seed completed: USER, BUSINESS_OWNER, STAFF, ADMIN + Business created");
// }

// // Run + disconnect
// main()
//   .catch((e) => {
//     console.error("❌ Seed error:", e);
//     process.exit(1);
//   })
//   .finally(async () => {
//     await prisma.$disconnect();
//   });
