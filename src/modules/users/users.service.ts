import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, Role, StripeEnvironment, SubscriptionStatus, UserStatus } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { BillingService } from "../billing/billing.service";

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly billingService: BillingService
  ) {}

  async getById(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException("Compte introuvable.");
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

  async updateRole(userId: string, role: Role, actorUserId?: string) {
    const target = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!target) {
      throw new NotFoundException("Compte introuvable.");
    }
    if (target.role === Role.ADMIN && role !== Role.ADMIN) {
      const adminCount = await this.prisma.user.count({ where: { role: Role.ADMIN } });
      if (adminCount <= 1) {
        throw new BadRequestException("Impossible de retirer le dernier administrateur.");
      }
    }
    const user = await this.prisma.user.update({ where: { id: userId }, data: { role } });
    if (actorUserId) {
      await this.logAdminAction(actorUserId, "USER_ROLE_UPDATED", "USER", userId, {
        previousRole: target.role,
        newRole: role
      });
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
    testProfile?: string;
  }) {
    const query = (filters.query ?? "").trim();
    const statusFilter = filters.status && isUserStatus(filters.status) ? filters.status : undefined;
    const page = clamp(filters.page, 1, 9999, 1);
    const pageSize = clamp(filters.pageSize, 1, 50, 10);
    const skip = (page - 1) * pageSize;
    const sortOrder = filters.sortOrder === "asc" ? "asc" : "desc";
    const orderBy = toUserOrderBy(filters.sortBy, sortOrder);
    const testProfile = filters.testProfile === "only" ? "only" : filters.testProfile === "all" ? "all" : "exclude";

    const where = {
      role: "FAMILY" as const,
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(testProfile === "only"
        ? { familyProfile: { is: { isInternalTest: true } } }
        : testProfile === "exclude"
          ? { familyProfile: { is: { isInternalTest: false } } }
          : {}),
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
            take: 10
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
              postalCode: family.familyProfile.postalCode,
              isInternalTest: family.familyProfile.isInternalTest
            }
          : null,
        subscription: toAdminSubscription(family.subscriptions)
      }))
    };
  }

  async deleteFamilyByAdmin(userId: string, reason: string, actorUserId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        familyProfile: true,
        subscriptions: true
      }
    });
    if (!user) {
      throw new NotFoundException("Famille introuvable.");
    }
    if (user.role !== Role.FAMILY) {
      throw new BadRequestException("Seul un compte famille peut etre supprime via cet endpoint.");
    }

    await this.billingService.cancelFamilySubscriptionsBeforeDeletion(userId);
    await this.logAdminAction(actorUserId, "FAMILY_DELETED", "USER", userId, {
      reason,
      email: user.email,
      displayName: user.familyProfile?.displayName ?? null,
      subscriptionStatuses: user.subscriptions.map((subscription) => subscription.status)
    });
    await this.prisma.user.delete({ where: { id: userId } });
    return { success: true };
  }

  async setFamilyInternalTest(userId: string, isInternalTest: boolean, actorUserId: string) {
    const family = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { familyProfile: true, subscriptions: true }
    });
    if (!family || family.role !== Role.FAMILY || !family.familyProfile) {
      throw new NotFoundException("Famille introuvable.");
    }
    if (
      isInternalTest &&
      family.subscriptions.some(
        (subscription) =>
          subscription.environment === StripeEnvironment.LIVE &&
          (subscription.status === SubscriptionStatus.INCOMPLETE ||
            subscription.status === SubscriptionStatus.ACTIVE ||
            subscription.status === SubscriptionStatus.TRIALING ||
            subscription.status === SubscriptionStatus.PAST_DUE ||
            subscription.status === SubscriptionStatus.UNPAID ||
            subscription.status === SubscriptionStatus.PAUSED)
      )
    ) {
      throw new BadRequestException("Un abonnement réel actif doit être réglé avant de marquer cette famille comme test.");
    }
    if (family.familyProfile.isInternalTest === isInternalTest) {
      return { id: family.familyProfile.id, isInternalTest };
    }
    const profile = await this.prisma.familyProfile.update({
      where: { id: family.familyProfile.id },
      data: { isInternalTest },
      select: { id: true, isInternalTest: true }
    });
    await this.logAdminAction(
      actorUserId,
      isInternalTest ? "FAMILY_INTERNAL_TEST_ENABLED" : "FAMILY_INTERNAL_TEST_DISABLED",
      "FAMILY_PROFILE",
      profile.id,
      { userId }
    );
    return profile;
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
  emailVerifiedAt: Date | null;
  role: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: user.id,
    email: user.email,
    emailVerifiedAt: user.emailVerifiedAt,
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

function toAdminSubscription(
  subscriptions: Array<{
    status: SubscriptionStatus;
    environment: StripeEnvironment;
    currentPeriodEnd: Date | null;
    cancelAtPeriodEnd: boolean;
    paymentFailedAt: Date | null;
    lastSyncedAt: Date | null;
    lastSyncError: string | null;
    updatedAt: Date;
  }>
) {
  const subscription =
    subscriptions.find((item) => item.environment !== StripeEnvironment.LEGACY) ?? subscriptions[0];
  if (!subscription) {
    return null;
  }
  return {
    status: subscription.status,
    environment: subscription.environment,
    currentPeriodEnd: subscription.currentPeriodEnd,
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    paymentFailedAt: subscription.paymentFailedAt,
    lastSyncedAt: subscription.lastSyncedAt,
    lastSyncError: subscription.lastSyncError,
    updatedAt: subscription.updatedAt
  };
}
