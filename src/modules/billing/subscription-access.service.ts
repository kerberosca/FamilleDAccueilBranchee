import { Injectable } from "@nestjs/common";
import { StripeEnvironment, SubscriptionStatus } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class SubscriptionAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async hasActiveFamilySubscription(userId: string): Promise<boolean> {
    const family = await this.prisma.familyProfile.findUnique({
      where: { userId },
      select: { isInternalTest: true }
    });
    if (!family) {
      return false;
    }
    const environment = family.isInternalTest ? StripeEnvironment.TEST : StripeEnvironment.LIVE;
    const subscription = await this.prisma.subscription.findFirst({
      where: {
        userId,
        environment
      },
      orderBy: { updatedAt: "desc" }
    });
    if (
      !subscription ||
      (subscription.status !== SubscriptionStatus.ACTIVE && subscription.status !== SubscriptionStatus.TRIALING)
    ) {
      return false;
    }
    if (subscription.currentPeriodEnd && subscription.currentPeriodEnd <= new Date()) {
      return false;
    }
    return true;
  }
}
