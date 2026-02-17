import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, UserStatus } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getById(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException("User not found");
    }
    return sanitizeUser(user);
  }

  async updateStatus(userId: string, status: UserStatus, actorUserId?: string) {
    const user = await this.prisma.user.update({ where: { id: userId }, data: { status } });
    if (actorUserId) {
      await this.logAdminAction(actorUserId, "USER_STATUS_UPDATED", "USER", userId, { status });
    }
    return sanitizeUser(user);
  }

  async bulkUpdateStatus(userIds: string[], status: UserStatus, actorUserId: string) {
    const result = await this.prisma.user.updateMany({
      where: { id: { in: userIds }, role: "FAMILY" },
      data: { status }
    });
    await this.logAdminAction(actorUserId, "USER_STATUS_BULK_UPDATED", "USER", "bulk", { userIds, status });
    return {
      updatedCount: result.count
    };
  }

  async listFamilies(filters: {
    query?: string;
    status?: string;
    page?: number;
    pageSize?: number;
    sortBy?: string;
    sortOrder?: string;
  }) {
    const query = (filters.query ?? "").trim();
    const statusFilter = filters.status && isUserStatus(filters.status) ? filters.status : undefined;
    const page = clamp(filters.page, 1, 9999, 1);
    const pageSize = clamp(filters.pageSize, 1, 50, 10);
    const skip = (page - 1) * pageSize;
    const sortOrder = filters.sortOrder === "asc" ? "asc" : "desc";
    const orderBy = toUserOrderBy(filters.sortBy, sortOrder);

    const where = {
      role: "FAMILY" as const,
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(query
        ? {
            OR: [
              { email: { contains: query, mode: "insensitive" as const } },
              { familyProfile: { is: { displayName: { contains: query, mode: "insensitive" as const } } } },
              { familyProfile: { is: { city: { contains: query, mode: "insensitive" as const } } } },
              { familyProfile: { is: { postalCode: { startsWith: query.toUpperCase().replace(/\s+/g, "") } } } }
            ]
          }
        : {})
    };

    const [total, families] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        include: {
          familyProfile: true,
          subscriptions: {
            orderBy: { updatedAt: "desc" },
            take: 1
          }
        },
        orderBy,
        skip,
        take: pageSize
      })
    ]);

    return {
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      items: families.map((family) => ({
        ...sanitizeUser(family),
        profile: family.familyProfile
          ? {
              id: family.familyProfile.id,
              displayName: family.familyProfile.displayName,
              city: family.familyProfile.city,
              region: family.familyProfile.region,
              postalCode: family.familyProfile.postalCode
            }
          : null,
        subscription: family.subscriptions[0]
          ? {
              status: family.subscriptions[0].status,
              currentPeriodEnd: family.subscriptions[0].currentPeriodEnd,
              updatedAt: family.subscriptions[0].updatedAt
            }
          : null
      }))
    };
  }

  async listAdminAuditLogs(filters: { page?: number; pageSize?: number }) {
    const page = clamp(filters.page, 1, 9999, 1);
    const pageSize = clamp(filters.pageSize, 1, 100, 20);
    const skip = (page - 1) * pageSize;

    const [total, logs] = await this.prisma.$transaction([
      this.prisma.adminAuditLog.count(),
      this.prisma.adminAuditLog.findMany({
        include: {
          actorUser: {
            select: { id: true, email: true, role: true }
          }
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize
      })
    ]);

    return {
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      items: logs
    };
  }

  async logAdminAction(
    actorUserId: string,
    action: string,
    targetType: string,
    targetId: string,
    payload?: Record<string, unknown>
  ) {
    await this.prisma.adminAuditLog.create({
      data: {
        actorUserId,
        action,
        targetType,
        targetId,
        payload: toJsonPayload(payload)
      }
    });
  }
}

function sanitizeUser(user: {
  id: string;
  email: string;
  role: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

function isUserStatus(value: string): value is UserStatus {
  return value === UserStatus.ACTIVE || value === UserStatus.BANNED;
}

function clamp(value: number | undefined, min: number, max: number, fallback: number): number {
  if (!value || Number.isNaN(value)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, value));
}

function toUserOrderBy(sortBy?: string, sortOrder: "asc" | "desc" = "desc") {
  if (sortBy === "email") {
    return [{ email: sortOrder }];
  }
  if (sortBy === "status") {
    return [{ status: sortOrder }, { createdAt: "desc" as const }];
  }
  return [{ createdAt: sortOrder }];
}

function toJsonPayload(payload?: Record<string, unknown>): Prisma.InputJsonValue {
  return (payload ?? {}) as Prisma.InputJsonValue;
}
