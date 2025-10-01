/*
  Manual migration to align DB schema with Prisma model.

  Changes:
  - Drop old column `expires` if it still exists.
  - Add new column `expiresAt` (non-null).
*/

-- Safely drop old column if it exists
DO $$ BEGIN
  ALTER TABLE "PasswordResetToken" DROP COLUMN IF EXISTS "expires";
EXCEPTION WHEN others THEN
  RAISE NOTICE 'Column expires not found, skipping drop.';
END $$;

-- Add new column if not already present
DO $$ BEGIN
  ALTER TABLE "PasswordResetToken" ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();
EXCEPTION WHEN others THEN
  RAISE NOTICE 'Column expiresAt already exists, skipping add.';
END $$;
