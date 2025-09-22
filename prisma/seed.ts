// prisma/seed.ts
import { prisma } from "../lib/prisma";
import bcrypt from "bcryptjs";

async function main() {
  // 1. Seed an individual user
  const hashedPassword = await bcrypt.hash("password123", 10);
  await prisma.user.create({
    data: {
      name: "Alice Example",
      email: "alice@example.com",
      password: hashedPassword,
      role: "USER",
    },
  });

  // 2. Seed a business owner + business
  const ownerPassword = await bcrypt.hash("securepass456", 10);
  const businessOwner = await prisma.user.create({
    data: {
      name: "Bob Owner",
      email: "bob@mybusiness.com",
      password: ownerPassword,
      role: "BUSINESS_OWNER",
    },
  });

  // Business linked to Bob
  await prisma.business.create({
    data: {
      name: "My Business Pty Ltd",
      domain: "mybusiness.com",
      ownerId: businessOwner.id,
    },
  });

  console.log("✅ Seed complete!");
}

// Run script
main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
