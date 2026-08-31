-- Les parcours existants et futurs restent verrouillés tant qu'un administrateur
-- ne les active pas explicitement.
ALTER TABLE "TrainingEnrollment"
ADD COLUMN "emailAutomationEnabledAt" TIMESTAMP(3);

CREATE INDEX "TrainingEnrollment_emailAutomationEnabledAt_idx"
ON "TrainingEnrollment"("emailAutomationEnabledAt");
