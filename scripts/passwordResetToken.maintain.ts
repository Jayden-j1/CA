// scripts/passwordResetToken.maintain.ts
//
// Purpose (Combined Script):
// - One-off maintenance & verification tool for your PasswordResetToken table.
// - Verifies whether your production DB schema has `expiresAt` (canonical) or legacy `expires`.
// - Cleans up existing tokens (by user or all), inserts a fresh test token, and reads it back.
// - Prints a concise report so you can confirm "forgot password" is correctly wired end-to-end.
//
// Why this helps:
// - Prevents confusion when Prisma client types and DB columns drift (e.g., expires vs expiresAt).
// - Gives you a single, robust script that you can run locally or in CI/CD to assert DB state.
// - Minimizes risk: By default, this script only deletes tokens for one user you pass via --email.
//   You must explicitly pass --all to wipe the entire PasswordResetToken table.
//
// Usage:
//   1) Ensure .env / DATABASE_URL is set for the intended environment (local or Neon prod).
//   2) Install a TS runner if you haven't:
//        npm i -D tsx
//   3) Run:
//        npx tsx scripts/passwordResetToken.maintain.ts --email your_user@example.com
//      Optional flags:
//        --hours 1         (expiry in hours; default 1h)
//        --dry-run         (verify only; no writes)
//        --all             (CAUTION: deletes all tokens, not just target user's tokens)
//        --verbose         (prints extra details)
//
// Security notes:
// - The script requires --email unless you pass --all, to avoid accidental bulk deletions.
// - It uses direct PrismaClient instance with .env DATABASE_URL; it does not depend on Next aliases.
//
// Exit codes:
// - 0: success
// - 1: invalid usage or failure
//
// Keep best practices:
// - Run it intentionally (e.g., for troubleshooting).
// - Avoid committing this file to production images; keep it in a "scripts" folder.
// - DO NOT run with --all in a shared database without explicit confirmation.
//
// ----------------------------------------------------------------------

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

interface Args {
  email?: string;
  hours: number;
  dryRun: boolean;
  all: boolean;
  verbose: boolean;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const args: Args = {
    email: undefined,
    hours: 1,
    dryRun: false,
    all: false,
    verbose: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--email') {
      args.email = argv[i + 1];
      i++;
    } else if (a === '--hours') {
      args.hours = Number(argv[i + 1]);
      i++;
    } else if (a === '--dry-run') {
      args.dryRun = true;
    } else if (a === '--all') {
      args.all = true;
    } else if (a === '--verbose') {
      args.verbose = true;
    }
  }
  return args;
}

/**
 * Load columns present in "PasswordResetToken" table from Postgres metadata.
 */
async function loadTableColumns(): Promise<string[]> {
  // Use information_schema to query real DB columns (works with Neon/PG)
  const rows = await prisma.$queryRaw<
    { column_name: string }[]
  >`SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'PasswordResetToken'`;

  return rows.map((r) => r.column_name);
}

/**
 * Print a short banner so it's clear what environment we're hitting.
 */
function printHeader(args: Args) {
  console.log('─────────────────────────────────────────────────────────────');
  console.log(' PasswordResetToken Maintenance & Verification Script');
  console.log('─────────────────────────────────────────────────────────────');
  console.log(`DATABASE_URL: ${process.env.DATABASE_URL ? '✔ present' : '✖ missing'}`);
  console.log(`Mode: ${args.dryRun ? 'DRY-RUN (no writes)' : 'LIVE'}`);
  console.log(`Scope: ${args.all ? 'ALL tokens' : `Only tokens for: ${args.email || '(none)'}`}`);
  console.log(`Expiry: ${args.hours} hour(s) from now`);
  console.log(`Verbose: ${args.verbose ? 'on' : 'off'}`);
  console.log('─────────────────────────────────────────────────────────────\n');
}

async function main() {
  const args = parseArgs();
  printHeader(args);

  // Safety checks
  if (!args.all && !args.email) {
    console.error('❌ You must specify --email <email> OR explicitly pass --all to affect all rows.');
    process.exit(1);
  }

  // 1) Load actual table columns
  const columns = await loadTableColumns();
  const hasExpiresAt = columns.includes('expiresat') || columns.includes('expiresAt');
  const hasExpires = columns.includes('expires');

  console.log('Schema columns detected in PasswordResetToken:', columns);
  if (hasExpiresAt) {
    console.log('✅ Detected canonical column: "expiresAt"');
  } else if (hasExpires) {
    console.log('⚠️ Detected legacy column: "expires" (we will fall back to this).');
  } else {
    console.error('❌ Neither "expiresAt" nor "expires" column found. Aborting.');
    process.exit(1);
  }

  // 2) If we are not in DRY mode, clean up tokens
  if (!args.dryRun) {
    if (args.all) {
      console.log('⚠️ Deleting ALL rows from PasswordResetToken...');
      const delRes = await prisma.passwordResetToken.deleteMany({});
      console.log(`→ Deleted ${delRes.count} token(s).`);
    } else {
      // Delete only for a specific user
      console.log(`Looking up user by email: ${args.email}`);
      const user = await prisma.user.findUnique({
        where: { email: args.email! },
        select: { id: true, email: true, isActive: true },
      });

      if (!user) {
        console.error('❌ No user found for that email. Aborting.');
        process.exit(1);
      }
      if (user.isActive === false) {
        console.warn('⚠️ User is inactive (soft-deleted). Insert will still proceed for testing tokens.');
      }

      console.log(`Deleting only tokens for userId=${user.id} ...`);
      const delRes = await prisma.passwordResetToken.deleteMany({
        where: { userId: user.id },
      });
      console.log(`→ Deleted ${delRes.count} token(s) for ${user.email}`);

      // 3) Insert a fresh token row (expiresAt or expires)
      const token = crypto.randomBytes(32).toString('hex');
      const expiresDate = new Date(Date.now() + args.hours * 60 * 60 * 1000);

      console.log('Inserting a fresh test token row...');
      if (hasExpiresAt) {
        // Canonical path
        await prisma.passwordResetToken.create({
          data: {
            token,
            userId: user.id,
            expiresAt: expiresDate,
          },
        });
      } else {
        // Fallback path for legacy column
        await prisma.passwordResetToken.create({
          data: {
            token,
            userId: user.id,
            // @ts-ignore - if Prisma client types no longer include "expires"
            expires: expiresDate as any,
          } as any,
        });
      }
      console.log('→ Inserted a new test token.');
    }
  } else {
    console.log('DRY-RUN: Skipped deletion/insertion.');
  }

  // 4) Read back sample rows using a raw query that coalesces expiresAt/expires
  console.log('\nQuerying last 5 tokens (coalesced expiry column)...');
  const sample = await prisma.$queryRaw<
    { id: string; token: string; userId: string; createdAt: Date; expiry: Date | null }[]
  >`
    SELECT 
      "id", 
      "token", 
      "userId", 
      "createdAt",
      COALESCE("expiresAt", "expires") AS "expiry"
    FROM "PasswordResetToken"
    ORDER BY "createdAt" DESC
    LIMIT 5
  `;

  if (sample.length === 0) {
    console.log('No rows found in PasswordResetToken.');
  } else {
    console.table(
      sample.map((r) => ({
        id: r.id,
        token: r.token.slice(0, 12) + '…', // avoid printing full token
        userId: r.userId,
        createdAt: r.createdAt.toISOString(),
        expiry: r.expiry ? new Date(r.expiry).toISOString() : null,
      }))
    );
  }

  // 5) Final report
  console.log('\n─────────────────────────────────────────────────────────────');
  console.log(' Report');
  console.log('─────────────────────────────────────────────────────────────');
  console.log(`• Prisma Client version: ${require('@prisma/client/package.json').version}`);
  console.log(`• Columns present: ${columns.join(', ')}`);
  console.log(`• Used column for write: ${!args.dryRun ? (hasExpiresAt ? 'expiresAt' : 'expires') : '(no write - dry run)'}\n`);

  console.log('✅ Done. If you see your new row in Prisma Studio under PasswordResetToken,');
  console.log('   the forgot-password persistence layer is fully healthy in this environment.\n');
}

main()
  .catch((err) => {
    console.error('❌ Script failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
