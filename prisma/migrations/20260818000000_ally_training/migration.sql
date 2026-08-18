-- CreateEnum
CREATE TYPE "TrainingStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'EXAM_AVAILABLE', 'PASSED', 'ATTENTION_REQUIRED');

-- CreateEnum
CREATE TYPE "TrainingAssessmentType" AS ENUM ('FORMATIVE', 'FINAL');

-- CreateEnum
CREATE TYPE "TrainingReminderType" AS ENUM ('ASSIGNMENT', 'DAY_3', 'DAY_7', 'DAY_14', 'SUCCESS', 'ATTENTION');

-- CreateEnum
CREATE TYPE "TrainingEmailStatus" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'SKIPPED', 'FAILED');

-- CreateTable
CREATE TABLE "TrainingEnrollment" (
    "id" TEXT NOT NULL,
    "resourceProfileId" TEXT NOT NULL,
    "courseVersion" TEXT NOT NULL DEFAULT 'faba-v1',
    "status" "TrainingStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "currentLessonKey" TEXT,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "lastActivityAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "attemptsResetAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TrainingEnrollment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TrainingLessonProgress" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "lessonKey" TEXT NOT NULL,
    "visitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TrainingLessonProgress_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TrainingAssessmentAttempt" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "type" "TrainingAssessmentType" NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "answers" JSONB NOT NULL,
    "scorePercent" INTEGER NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TrainingAssessmentAttempt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TrainingCertificate" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "certificateCode" TEXT NOT NULL,
    "participantName" TEXT NOT NULL,
    "courseTitle" TEXT NOT NULL,
    "courseVersion" TEXT NOT NULL,
    "scorePercent" INTEGER NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TrainingCertificate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TrainingEmailLog" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "type" "TrainingReminderType" NOT NULL,
    "status" "TrainingEmailStatus" NOT NULL DEFAULT 'PENDING',
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "processingAt" TIMESTAMP(3),
    "providerMessageId" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TrainingEmailLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TrainingEnrollment_resourceProfileId_courseVersion_key" ON "TrainingEnrollment"("resourceProfileId", "courseVersion");
CREATE INDEX "TrainingEnrollment_status_assignedAt_idx" ON "TrainingEnrollment"("status", "assignedAt");
CREATE INDEX "TrainingEnrollment_lastActivityAt_idx" ON "TrainingEnrollment"("lastActivityAt");
CREATE UNIQUE INDEX "TrainingLessonProgress_enrollmentId_lessonKey_key" ON "TrainingLessonProgress"("enrollmentId", "lessonKey");
CREATE INDEX "TrainingLessonProgress_enrollmentId_completedAt_idx" ON "TrainingLessonProgress"("enrollmentId", "completedAt");
CREATE UNIQUE INDEX "TrainingAssessmentAttempt_enrollmentId_type_attemptNumber_key" ON "TrainingAssessmentAttempt"("enrollmentId", "type", "attemptNumber");
CREATE INDEX "TrainingAssessmentAttempt_enrollmentId_type_submittedAt_idx" ON "TrainingAssessmentAttempt"("enrollmentId", "type", "submittedAt");
CREATE UNIQUE INDEX "TrainingCertificate_enrollmentId_key" ON "TrainingCertificate"("enrollmentId");
CREATE UNIQUE INDEX "TrainingCertificate_certificateCode_key" ON "TrainingCertificate"("certificateCode");
CREATE UNIQUE INDEX "TrainingEmailLog_enrollmentId_type_key" ON "TrainingEmailLog"("enrollmentId", "type");
CREATE INDEX "TrainingEmailLog_status_scheduledFor_idx" ON "TrainingEmailLog"("status", "scheduledFor");

ALTER TABLE "TrainingEnrollment" ADD CONSTRAINT "TrainingEnrollment_resourceProfileId_fkey" FOREIGN KEY ("resourceProfileId") REFERENCES "ResourceProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrainingLessonProgress" ADD CONSTRAINT "TrainingLessonProgress_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "TrainingEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrainingAssessmentAttempt" ADD CONSTRAINT "TrainingAssessmentAttempt_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "TrainingEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrainingCertificate" ADD CONSTRAINT "TrainingCertificate_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "TrainingEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrainingEmailLog" ADD CONSTRAINT "TrainingEmailLog_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "TrainingEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Rattrapage idempotent des alliés déjà présents. Aucun courriel n'est envoyé par la migration.
INSERT INTO "TrainingEnrollment" ("id", "resourceProfileId", "courseVersion", "status", "assignedAt", "createdAt", "updatedAt")
SELECT 'train_' || md5(random()::text || rp."id"), rp."id", 'faba-v1', 'NOT_STARTED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "ResourceProfile" rp
ON CONFLICT ("resourceProfileId", "courseVersion") DO NOTHING;
