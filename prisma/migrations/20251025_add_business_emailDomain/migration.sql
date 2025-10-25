-- Adds Business.emailDomain only if it doesn't already exist.
-- Safe to run multiple times; PostgreSQL will no-op on second run.

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE (table_schema = 'public' OR table_schema = current_schema())
      AND (table_name = 'Business' OR lower(table_name) = 'business')
      AND column_name = 'emailDomain'
  ) THEN
    ALTER TABLE "Business"
      ADD COLUMN "emailDomain" TEXT;

    -- Optional (recommended): index for quick lookups by domain
    CREATE INDEX IF NOT EXISTS "Business_emailDomain_idx" ON "Business" ("emailDomain");
  END IF;
END $$;
