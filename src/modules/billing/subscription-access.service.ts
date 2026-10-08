import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { StripeEnvironment, SubscriptionStatus } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class SubscriptionAccessService {
  constructor(private readonly prisma: PrismaService, private readonly configService: ConfigService) {}

  async hasActiveFamilySubscription(userId: string): Promise<boolean> {
    const family = await this.prisma.familyProfile.findUnique({
      where: { userId },
      select: { isInternalTest: true, user: { select: { email: true } } }
    });
    if (!family) {
      return false;
    }
    if (this.configService.get<string>("DEMO_MODE") === "true") {
      return family.isInternalTest && /^visiteur-[0-9a-f-]+@demo\.invalid$/.test(family.user.email);
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
