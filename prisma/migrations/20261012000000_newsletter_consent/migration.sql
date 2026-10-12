CREATE TABLE "NewsletterConsent" (
  "id" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "firstName" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "consentVersion" TEXT NOT NULL,
  "consentText" TEXT NOT NULL,
  "ipAddress" TEXT NOT NULL,
  "userAgent" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "providerMemberId" TEXT,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "NewsletterConsent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "NewsletterConsent_source_check" CHECK ("source" IN ('site', 'congres')),
  CONSTRAINT "NewsletterConsent_status_check" CHECK ("status" IN ('PENDING', 'SYNCED', 'FAILED'))
);
CREATE UNIQUE INDEX "NewsletterConsent_requestId_key" ON "NewsletterConsent"("requestId");
CREATE INDEX "NewsletterConsent_email_submittedAt_idx" ON "NewsletterConsent"("email", "submittedAt");
CREATE INDEX "NewsletterConsent_status_submittedAt_idx" ON "NewsletterConsent"("status", "submittedAt");
