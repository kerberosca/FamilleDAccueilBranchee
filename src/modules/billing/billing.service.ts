import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  ResourceOnboardingState,
  ResourcePublishStatus,
  ResourceVerificationStatus,
  Role,
  SubscriptionStatus
} from "@prisma/client";
import Stripe from "stripe";
import { PrismaService } from "../../prisma/prisma.service";
import { StripeService } from "./stripe.service";

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly stripeService: StripeService
  ) {}

  async createResourceCheckoutSession(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { resourceProfile: true }
    });
    if (!user || user.role !== Role.RESOURCE || !user.resourceProfile) {
      throw new BadRequestException("Only RESOURCE accounts can use this endpoint");
    }

    const priceId = this.configService.get<string>("STRIPE_RESOURCE_ONBOARDING_PRICE_ID");
    if (!priceId) {
      throw new BadRequestException("Missing STRIPE_RESOURCE_ONBOARDING_PRICE_ID");
    }
    const frontendUrl = this.configService.get<string>("APP_FRONTEND_URL", "http://localhost:5173");

    const session = await this.createCheckoutSessionWithDevFallback({
      mode: "payment",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${frontendUrl}/billing/success?type=resource`,
      cancel_url: `${frontendUrl}/billing/cancel?type=resource`,
      metadata: { userId: user.id, kind: "RESOURCE_ONBOARDING" },
      customer_email: user.email
    });

    await this.prisma.resourceProfile.update({
      where: { userId: user.id },
      data: { onboardingState: ResourceOnboardingState.PENDING_PAYMENT }
    });

    return { checkoutUrl: session.url, sessionId: session.id };
  }

  async createFamilySubscriptionCheckoutSession(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.role !== Role.FAMILY) {
      throw new BadRequestException("Only FAMILY accounts can use this endpoint");
    }
    const priceId = this.configService.get<string>("STRIPE_FAMILY_SUBSCRIPTION_PRICE_ID");
    if (!priceId) {
      throw new BadRequestException("Missing STRIPE_FAMILY_SUBSCRIPTION_PRICE_ID");
    }
    const frontendUrl = this.configService.get<string>("APP_FRONTEND_URL", "http://localhost:5173");

    const session = await this.createCheckoutSessionWithDevFallback({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${frontendUrl}/billing/success?type=family`,
      cancel_url: `${frontendUrl}/billing/cancel?type=family`,
      metadata: { userId: user.id, kind: "FAMILY_SUBSCRIPTION" },
      customer_email: user.email
    });

    return { checkoutUrl: session.url, sessionId: session.id };
  }

  async markFamilySubscriptionActive(userId: string, stripeCustomerId?: string, stripeSubscriptionId?: string) {
    const existing = stripeSubscriptionId
      ? await this.prisma.subscription.findUnique({ where: { stripeSubscriptionId } })
      : null;

    if (existing) {
      await this.prisma.subscription.update({
        where: { id: existing.id },
        data: { status: SubscriptionStatus.ACTIVE, stripeCustomerId }
      });
      return;
    }
    await this.prisma.subscription.create({
      data: {
        userId,
        status: SubscriptionStatus.ACTIVE,
        stripeCustomerId,
        stripeSubscriptionId
      }
    });
  }

  async markResourcePaymentCompleted(userId: string) {
    await this.prisma.resourceProfile.update({
      where: { userId },
      data: {
        onboardingState: ResourceOnboardingState.PENDING_VERIFICATION,
        verificationStatus: ResourceVerificationStatus.PENDING_VERIFICATION,
        publishStatus: ResourcePublishStatus.HIDDEN
      }
    });
  }

  async handleStripeWebhook(rawBody: Buffer, signature?: string) {
    if (this.configService.get<string>("NODE_ENV") === "test") {
      const mockEvent = this.parseMockWebhookEvent(rawBody);
      if (mockEvent) {
        await this.handleCheckoutCompletedEvent(mockEvent);
        return { received: true, validated: false };
      }
    }

    const webhookSecret = this.configService.get<string>("STRIPE_WEBHOOK_SECRET");
    if (!webhookSecret || !signature) {
      this.logger.warn("Webhook signature validation skipped (missing config/signature)");
      return { received: true, validated: false };
    }

    const event = this.stripeService.client.webhooks.constructEvent(rawBody, signature, webhookSecret);
    await this.handleCheckoutCompletedEvent(event);
    return { received: true, validated: true };
  }

  private async handleCheckoutCompletedEvent(event: Pick<Stripe.Event, "type" | "data">) {
    if (event.type !== "checkout.session.completed") {
      return;
    }
    const session = event.data.object as { metadata?: Record<string, string>; customer?: string; subscription?: string };
    const kind = session.metadata?.kind;
    const userId = session.metadata?.userId;
    if (kind === "RESOURCE_ONBOARDING" && userId) {
      await this.markResourcePaymentCompleted(userId);
    }
    if (kind === "FAMILY_SUBSCRIPTION" && userId) {
      await this.markFamilySubscriptionActive(userId, session.customer as string, session.subscription as string);
    }
  }

  private parseMockWebhookEvent(rawBody: Buffer): Pick<Stripe.Event, "type" | "data"> | null {
    try {
      return JSON.parse(rawBody.toString("utf-8")) as Pick<Stripe.Event, "type" | "data">;
    } catch {
      return null;
    }
  }

  private async createCheckoutSessionWithDevFallback(
    payload: Stripe.Checkout.SessionCreateParams
  ): Promise<{ id: string; url: string | null }> {
    try {
      const session = await this.stripeService.client.checkout.sessions.create(payload);
      return { id: session.id, url: session.url };
    } catch (error) {
      if (!this.shouldUseMockCheckout()) {
        throw error;
      }
      this.logger.warn("Stripe checkout fallback enabled in development (mock session).");
      const mockId = `cs_mock_${Date.now()}`;
      const fallbackUrl = `${this.configService.get<string>("APP_FRONTEND_URL", "http://localhost:5173")}/onboarding?mockCheckout=1`;
      return { id: mockId, url: fallbackUrl };
    }
  }

  private shouldUseMockCheckout(): boolean {
    const nodeEnv = this.configService.get<string>("NODE_ENV", "development");
    if (nodeEnv === "production") {
      return false;
    }
    const key = this.configService.get<string>("STRIPE_SECRET_KEY", "");
    return !key || key.includes("xxx") || key.includes("placeholder");
  }
}
