import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

const DEFAULT_ID = "default";

export type MaintenanceStateDto = {
  enabled: boolean;
  updatedAt: Date;
  updatedBy: string | null;
};

@Injectable()
export class MaintenanceService {
  constructor(private readonly prisma: PrismaService) {}

  async isActive(): Promise<boolean> {
    const row = await this.prisma.maintenanceState.findUnique({
      where: { id: DEFAULT_ID }
    });
    return row?.enabled ?? false;
  }

  async getState(): Promise<MaintenanceStateDto> {
    const row = await this.prisma.maintenanceState.upsert({
      where: { id: DEFAULT_ID },
      create: { id: DEFAULT_ID, enabled: false, updatedAt: new Date() },
      update: {}
    });
    return {
      enabled: row.enabled,
      updatedAt: row.updatedAt,
      updatedBy: row.updatedBy
    };
  }

  async setEnabled(enabled: boolean, userId?: string): Promise<MaintenanceStateDto> {
    const row = await this.prisma.maintenanceState.upsert({
      where: { id: DEFAULT_ID },
      create: {
        id: DEFAULT_ID,
        enabled,
        updatedAt: new Date(),
        updatedBy: userId ?? null
      },
      update: {
        enabled,
        updatedBy: userId ?? undefined
      }
    });
    return {
      enabled: row.enabled,
      updatedAt: row.updatedAt,
      updatedBy: row.updatedBy
    };
  }
}
