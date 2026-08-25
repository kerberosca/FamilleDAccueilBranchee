-- Le nouveau test officiel regroupe les 12 mises en situation et l'ancienne
-- question finale. Les anciens types restent disponibles pour l'historique.
ALTER TYPE "TrainingAssessmentType" ADD VALUE IF NOT EXISTS 'QUIZ';

-- Les parcours déjà réussis et leurs certificats ne sont jamais modifiés.
-- Les parcours incomplets de l'ancien modèle reçoivent trois nouveaux essais.
UPDATE "TrainingEnrollment" enrollment
SET
  "status" = 'IN_PROGRESS',
  "attemptsResetAt" = CURRENT_TIMESTAMP,
  "lastActivityAt" = COALESCE(enrollment."lastActivityAt", CURRENT_TIMESTAMP),
  "updatedAt" = CURRENT_TIMESTAMP
WHERE enrollment."status" IN ('EXAM_AVAILABLE', 'ATTENTION_REQUIRED')
  AND NOT EXISTS (
    SELECT 1
    FROM "TrainingCertificate" certificate
    WHERE certificate."enrollmentId" = enrollment."id"
  );

-- Un ancien avis d'échec ne doit pas partir après la remise à zéro.
UPDATE "TrainingEmailLog" log
SET
  "status" = 'SKIPPED',
  "processingAt" = NULL,
  "lastError" = 'Ancienne évaluation remplacée par le test officiel de 13 questions',
  "updatedAt" = CURRENT_TIMESTAMP
WHERE log."type" = 'ATTENTION'
  AND log."status" IN ('PENDING', 'PROCESSING')
  AND EXISTS (
    SELECT 1
    FROM "TrainingEnrollment" enrollment
    WHERE enrollment."id" = log."enrollmentId"
      AND enrollment."status" = 'IN_PROGRESS'
      AND enrollment."attemptsResetAt" IS NOT NULL
  );
