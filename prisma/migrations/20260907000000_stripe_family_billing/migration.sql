ALTER TYPE "SubscriptionStatus" ADD VALUE IF NOT EXISTS 'INCOMPLETE';
ALTER TYPE "SubscriptionStatus" ADD VALUE IF NOT EXISTS 'INCOMPLETE_EXPIRED';
ALTER TYPE "SubscriptionStatus" ADD VALUE IF NOT EXISTS 'TRIALING';
ALTER TYPE "SubscriptionStatus" ADD VALUE IF NOT EXISTS 'UNPAID';
ALTER TYPE "SubscriptionStatus" ADD VALUE IF NOT EXISTS 'PAUSED';

CREATE TYPE "StripeEnvironment" AS ENUM ('LEGACY', 'TEST', 'LIVE');
CREATE TYPE "StripeWebhookEventStatus" AS ENUM ('PROCESSING', 'PROCESSED', 'FAILED');
CREATE TYPE "StripeCheckoutSessionStatus" AS ENUM ('OPEN', 'COMPLETED', 'EXPIRED');

ALTER TABLE "FamilyProfile"
ADD COLUMN "isInternalTest" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Subscription"
ADD COLUMN "environment" "StripeEnvironment" NOT NULL DEFAULT 'LEGACY',
ADD COLUMN "stripeCustomerRecordId" TEXT,
ADD COLUMN "stripePriceId" TEXT,
ADD COLUMN "currentPeriodStart" TIMESTAMP(3),
ADD COLUMN "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "canceledAt" TIMESTAMP(3),
ADD COLUMN "paymentFailedAt" TIMESTAMP(3),
ADD COLUMN "lastSyncedAt" TIMESTAMP(3),
ADD COLUMN "lastSyncError" TEXT,
ADD COLUMN "lastStripeEventAt" TIMESTAMP(3);

CREATE TABLE "FamilyStripeCustomer" (
  "id" TEXT NOT NULL,
  "familyProfileId" TEXT NOT NULL,
  "environment" "StripeEnvironment" NOT NULL,
  "stripeCustomerId" TEXT NOT NULL,
  "billingReference" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FamilyStripeCustomer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StripeCheckoutSession" (
    "id" TEXT NOT NULL,
    "familyStripeCustomerId" TEXT NOT NULL,
    "environment" "StripeEnvironment" NOT NULL,
    "stripeCheckoutSessionId" TEXT,
    "activeKey" TEXT,
    "status" "StripeCheckoutSessionStatus" NOT NULL DEFAULT 'OPEN',
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StripeCheckoutSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StripeWebhookEvent" (
  "id" TEXT NOT NULL,
  "environment" "StripeEnvironment" NOT NULL,
  "type" TEXT NOT NULL,
  "livemode" BOOLEAN NOT NULL,
  "status" "StripeWebhookEventStatus" NOT NULL DEFAULT 'PROCESSING',
  "objectId" TEXT,
  "eventCreatedAt" TIMESTAMP(3) NOT NULL,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),
  "error" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StripeWebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FamilyStripeCustomer_stripeCustomerId_key" ON "FamilyStripeCustomer"("stripeCustomerId");
CREATE UNIQUE INDEX "FamilyStripeCustomer_billingReference_key" ON "FamilyStripeCustomer"("billingReference");
CREATE UNIQUE INDEX "FamilyStripeCustomer_familyProfileId_environment_key" ON "FamilyStripeCustomer"("familyProfileId", "environment");
CREATE INDEX "FamilyStripeCustomer_environment_idx" ON "FamilyStripeCustomer"("environment");
CREATE UNIQUE INDEX "StripeCheckoutSession_stripeCheckoutSessionId_key" ON "StripeCheckoutSession"("stripeCheckoutSessionId");
CREATE UNIQUE INDEX "StripeCheckoutSession_activeKey_key" ON "StripeCheckoutSession"("activeKey");
CREATE INDEX "StripeCheckoutSession_familyStripeCustomerId_status_expiresAt_idx" ON "StripeCheckoutSession"("familyStripeCustomerId", "status", "expiresAt");
CREATE INDEX "StripeWebhookEvent_status_receivedAt_idx" ON "StripeWebhookEvent"("status", "receivedAt");
CREATE INDEX "StripeWebhookEvent_environment_eventCreatedAt_idx" ON "StripeWebhookEvent"("environment", "eventCreatedAt");
CREATE INDEX "FamilyProfile_isInternalTest_idx" ON "FamilyProfile"("isInternalTest");
CREATE INDEX "Subscription_userId_environment_status_idx" ON "Subscription"("userId", "environment", "status");
CREATE INDEX "Subscription_stripeCustomerRecordId_idx" ON "Subscription"("stripeCustomerRecordId");
CREATE INDEX "Subscription_lastSyncedAt_idx" ON "Subscription"("lastSyncedAt");

ALTER TABLE "FamilyStripeCustomer"
ADD CONSTRAINT "FamilyStripeCustomer_familyProfileId_fkey"
FOREIGN KEY ("familyProfileId") REFERENCES "FamilyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StripeCheckoutSession"
ADD CONSTRAINT "StripeCheckoutSession_familyStripeCustomerId_fkey"
FOREIGN KEY ("familyStripeCustomerId") REFERENCES "FamilyStripeCustomer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Subscription"
ADD CONSTRAINT "Subscription_stripeCustomerRecordId_fkey"
FOREIGN KEY ("stripeCustomerRecordId") REFERENCES "FamilyStripeCustomer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
