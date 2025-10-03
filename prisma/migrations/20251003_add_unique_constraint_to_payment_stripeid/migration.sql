-- 20251003_add_unique_constraint_to_payment_stripeid

-- Step 1: Clean duplicates if any (keep only latest by createdAt)
DELETE FROM "Payment" a
USING "Payment" b
WHERE a."stripeId" = b."stripeId"
  AND a.ctid < b.ctid;

-- Step 2: Add the unique constraint on stripeId
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_stripeId_key" UNIQUE("stripeId");
