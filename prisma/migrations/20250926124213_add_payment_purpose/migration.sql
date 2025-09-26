-- CreateEnum
CREATE TYPE "public"."PaymentPurpose" AS ENUM ('PACKAGE', 'STAFF_SEAT');

-- AlterTable
ALTER TABLE "public"."Payment" ADD COLUMN     "purpose" "public"."PaymentPurpose" NOT NULL DEFAULT 'PACKAGE';
