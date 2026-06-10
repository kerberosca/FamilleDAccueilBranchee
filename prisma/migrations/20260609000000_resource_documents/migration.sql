CREATE TYPE "ResourceDocumentType" AS ENUM ('CV', 'BACKGROUND_CHECK', 'RCR_PROOF');

CREATE TABLE "ResourceDocument" (
    "id" TEXT NOT NULL,
    "resourceProfileId" TEXT NOT NULL,
    "type" "ResourceDocumentType" NOT NULL,
    "originalName" TEXT NOT NULL,
    "storedName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ResourceDocument_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ResourceDocument_resourceProfileId_idx" ON "ResourceDocument"("resourceProfileId");
CREATE INDEX "ResourceDocument_type_idx" ON "ResourceDocument"("type");
CREATE UNIQUE INDEX "ResourceDocument_active_type_key" ON "ResourceDocument"("resourceProfileId", "type") WHERE "deletedAt" IS NULL;

ALTER TABLE "ResourceDocument" ADD CONSTRAINT "ResourceDocument_resourceProfileId_fkey" FOREIGN KEY ("resourceProfileId") REFERENCES "ResourceProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
