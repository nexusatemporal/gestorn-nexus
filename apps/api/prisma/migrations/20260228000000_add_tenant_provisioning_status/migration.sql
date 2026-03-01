-- CreateEnum
CREATE TYPE "TenantProvisioningStatus" AS ENUM ('PENDING', 'PROVISIONED', 'FAILED');

-- AlterTable: make tenantUuid and systemUrl nullable (they may already be nullable in some envs)
ALTER TABLE "Tenant" ALTER COLUMN "tenantUuid" DROP NOT NULL;
ALTER TABLE "Tenant" ALTER COLUMN "systemUrl" DROP NOT NULL;

-- AlterTable: set default empty string for vpsLocation
ALTER TABLE "Tenant" ALTER COLUMN "vpsLocation" SET DEFAULT '';
UPDATE "Tenant" SET "vpsLocation" = '' WHERE "vpsLocation" IS NULL;

-- AlterTable: add provisioningStatus and provisioningError columns
ALTER TABLE "Tenant" ADD COLUMN "provisioningStatus" "TenantProvisioningStatus" NOT NULL DEFAULT 'PENDING';
ALTER TABLE "Tenant" ADD COLUMN "provisioningError" TEXT;

-- CreateIndex
CREATE INDEX "Tenant_provisioningStatus_idx" ON "Tenant"("provisioningStatus");
