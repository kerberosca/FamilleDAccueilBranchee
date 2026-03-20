-- AlterTable
ALTER TABLE "ResourceProfile" ADD COLUMN     "streetAddress" TEXT,
ADD COLUMN     "allyRegistration" JSONB,
ADD COLUMN     "allyDeclarationsAcceptedAt" TIMESTAMP(3);
