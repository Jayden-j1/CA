// lib/prisma.ts
import { PrismaClient } from "@prisma/client";

// Prevent multiple instances of Prisma Client in development
declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

export const prisma =
  global.prisma ||
  new PrismaClient({
    log: ["error", "warn"], // optional: can also log "query" in dev
  });

if (process.env.NODE_ENV !== "production") global.prisma = prisma;
