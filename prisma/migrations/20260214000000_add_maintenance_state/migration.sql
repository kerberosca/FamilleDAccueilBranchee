-- CreateTable
CREATE TABLE "MaintenanceState" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "MaintenanceState_pkey" PRIMARY KEY ("id")
);

-- Insert default row
INSERT INTO "MaintenanceState" ("id", "enabled", "updatedAt") VALUES ('default', false, NOW());
