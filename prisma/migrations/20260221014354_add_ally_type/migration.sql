-- CreateEnum
CREATE TYPE "AllyType" AS ENUM ('MENAGE', 'GARDIENS', 'AUTRES');

-- AlterTable
ALTER TABLE "ResourceProfile" ADD COLUMN     "allyType" "AllyType";
