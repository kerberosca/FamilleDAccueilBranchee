-- CreateEnum
CREATE TYPE "BackgroundCheckStatus" AS ENUM ('NOT_REQUESTED', 'REQUESTED', 'PENDING', 'RECEIVED');

-- AlterTable
ALTER TABLE "ResourceProfile" ADD COLUMN     "backgroundCheckStatus" "BackgroundCheckStatus" NOT NULL DEFAULT 'NOT_REQUESTED';
