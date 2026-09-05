-- Les profils existants demeurent en personne et ne deviennent jamais des profils de test automatiquement.
CREATE TYPE "ResourceServiceDeliveryMode" AS ENUM ('IN_PERSON', 'REMOTE', 'BOTH');

ALTER TABLE "ResourceProfile"
ADD COLUMN "serviceDeliveryMode" "ResourceServiceDeliveryMode" NOT NULL DEFAULT 'IN_PERSON',
ADD COLUMN "isInternalTest" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "ResourceProfile_isInternalTest_idx"
ON "ResourceProfile"("isInternalTest");

CREATE INDEX "ResourceProfile_allyType_serviceDeliveryMode_idx"
ON "ResourceProfile"("allyType", "serviceDeliveryMode");
