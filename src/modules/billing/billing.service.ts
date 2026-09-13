import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  ServiceUnavailableException
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  Prisma,
  Role,
  StripeCheckoutSessionStatus,
  StripeEnvironment,
  StripeWebhookEventStatus,
  SubscriptionStatus,
  UserStatus
} from "@prisma/client";
import { randomUUID } from "crypto";
import Stripe from "stripe";
import { PrismaService } from "../../prisma/prisma.service";
import { StripeService } from "./stripe.service";

const OPEN_SUBSCRIPTION_STATUSES: SubscriptionStatus[] = [
  SubscriptionStatus.INCOMPLETE,
  SubscriptionStatus.TRIALING,
  SubscriptionStatus.ACTIVE,
  SubscriptionStatus.PAST_DUE,
  SubscriptionStatus.UNPAID,
  SubscriptionStatus.PAUSED
];

@Injectable()
export class BillingService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BillingService.name);
  private readonly frontendUrl: string;
  private readonly reconciliationIntervalMs: number;
  private validatedPrice: Stripe.Price | null = null;
  private reconciliationTimer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly stripeService: StripeService
  ) {
    this.frontendUrl = this.configService.get<string>("APP_FRONTEND_URL", "http://localhost:5173");
    this.reconciliationIntervalMs = Number(
      this.configService.get<string>("STRIPE_RECONCILIATION_INTERVAL_MS", "21600000")
    );
  }

  async onModuleInit() {
    if (this.stripeService.mode === "DISABLED") {
      return;
    }
    await this.getValidatedPrice(true);
    this.reconciliationTimer = setInterval(() => {
      void this.reconcileAllSubscriptions();
    }, this.reconciliationIntervalMs);
    this.reconciliationTimer.unref();
  }

  onModuleDestroy() {
    if (this.reconciliationTimer) {
      clearInterval(this.reconciliationTimer);
    }
  }

  createResourceCheckoutSession(_userId?: string) {
    throw new GoneException("L'inscription allié est gratuite. Aucun paiement n'est requis.");
  }

  getPublicFamilyReadiness() {
    return { state: this.publicFamilyBillingState() };
  }

  async getFamilyOffer(userId: string) {
    const family = await this.getFamilyContext(userId);
    if (this.stripeService.mode === "DISABLED") {
      return {
        available: false,
        amount: null,
        currency: "CAD",
        interval: "month",
        taxes: "UNCONFIRMED",
        publicState: this.publicFamilyBillingState(),
        reason: "L'abonnement famille n'est pas encore ouvert. Aucun paiement ne peut être effectué pour le moment."
      };
    }

    const price = await this.getValidatedPrice();
    const reason = this.getCheckoutBlockReason(family);
    return {
      available: !reason,
      amount: price.unit_amount,
      currency: price.currency.toUpperCase(),
      interval: "month",
      taxes: this.stripeService.taxMode,
      publicState: this.publicFamilyBillingState(),
      reason
    };
  }

  async getFamilySubscription(userId: string) {
    const family = await this.getFamilyContext(userId);
    const environment = this.currentEnvironment();
    const subscription = await this.prisma.subscription.findFirst({
      where: {
        userId,
        ...(environment ? { environment } : { environment: { not: StripeEnvironment.LEGACY } })
      },
      orderBy: { updatedAt: "desc" }
    });

    if (!subscription) {
      const legacy = await this.prisma.subscription.findFirst({
        where: { userId, environment: StripeEnvironment.LEGACY },
        orderBy: { updatedAt: "desc" }
      });
      return legacy
        ? {
            status: "LEGACY",
            currentPeriodEnd: null,
            cancelAtPeriodEnd: false,
            canManage: false,
            hasPremiumAccess: false,
            needsAdminReview: true
          }
        : {
            status: SubscriptionStatus.INACTIVE,
            currentPeriodEnd: null,
            cancelAtPeriodEnd: false,
            canManage: false,
            hasPremiumAccess: false,
            needsAdminReview: false
          };
    }

    return this.toPublicSubscription(subscription, this.familyMatchesCurrentEnvironment(family));
  }

  async createFamilySubscriptionCheckoutSession(userId: string) {
    const family = await this.getFamilyContext(userId);
    this.assertCheckoutAllowed(family);
    await this.getValidatedPrice();
    const environment = this.requiredEnvironment();

    const existingSubscription = await this.prisma.subscription.findFirst({
      where: { userId, environment, status: { in: OPEN_SUBSCRIPTION_STATUSES } },
      orderBy: { updatedAt: "desc" }
    });
    if (existingSubscription) {
      throw new ConflictException("Un abonnement existe déjà. Utilisez le portail de facturation pour le gérer.");
    }

    const customer = await this.getOrCreateFamilyCustomer(family, environment);
    const activeKey = `${environment}:${customer.id}`;
    const now = new Date();
    await this.prisma.stripeCheckoutSession.updateMany({
      where: {
        familyStripeCustomerId: customer.id,
        activeKey,
        status: StripeCheckoutSessionStatus.OPEN,
        OR: [
          { expiresAt: { lte: now } },
          {
            stripeCheckoutSessionId: null,
            updatedAt: { lt: new Date(now.getTime() - 2 * 60 * 1000) }
          }
        ]
      },
      data: { status: StripeCheckoutSessionStatus.EXPIRED, activeKey: null }
    });
    const reusable = await this.findReusableCheckoutSession(customer.id, activeKey);
    if (reusable) {
      return reusable;
    }

    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    let localSession: { id: string };
    try {
      localSession = await this.prisma.stripeCheckoutSession.create({
        data: {
          familyStripeCustomerId: customer.id,
          environment,
          activeKey,
          expiresAt
        },
        select: { id: true }
      });
    } catch (error) {
      if (isPrismaUniqueError(error)) {
        const duplicate = await this.findReusableCheckoutSession(customer.id, activeKey);
        if (duplicate) {
          return duplicate;
        }
        throw new ConflictException("Une séance de paiement est déjà en préparation. Réessayez dans un instant.");
      }
      throw error;
    }

    try {
      const session = await this.stripeService.client.checkout.sessions.create(
        {
          mode: "subscription",
          customer: customer.stripeCustomerId,
          client_reference_id: customer.billingReference,
          line_items: [{ price: this.stripeService.priceId, quantity: 1 }],
          billing_address_collection: "required",
          automatic_tax: { enabled: this.stripeService.taxMode === "AUTOMATIC" },
          success_url: `${this.frontendUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${this.frontendUrl}/billing/cancel`,
          expires_at: Math.floor(expiresAt.getTime() / 1000),
          metadata: this.stripeMetadata(customer.billingReference),
          subscription_data: { metadata: this.stripeMetadata(customer.billingReference) }
        },
        { idempotencyKey: `fab-checkout-${localSession.id}` }
      );
      if (!session.url) {
        throw new ServiceUnavailableException("Stripe n'a pas retourné de lien de paiement sécurisé.");
      }
      await this.prisma.stripeCheckoutSession.update({
        where: { id: localSession.id },
        data: {
          stripeCheckoutSessionId: session.id,
          expiresAt: fromUnixSeconds(session.expires_at) ?? expiresAt
        }
      });
      return { checkoutUrl: session.url };
    } catch (error) {
      await this.prisma.stripeCheckoutSession.update({
        where: { id: localSession.id },
        data: { status: StripeCheckoutSessionStatus.EXPIRED, activeKey: null }
      });
      throw error;
    }
  }

  async createFamilyPortalSession(userId: string) {
    const family = await this.getFamilyContext(userId);
    this.assertEnvironmentAccess(family);
    const environment = this.requiredEnvironment();
    const customer = await this.prisma.familyStripeCustomer.findUnique({
      where: { familyProfileId_environment: { familyProfileId: family.familyProfile.id, environment } }
    });
    if (!customer) {
      throw new BadRequestException("Aucun abonnement Stripe ne peut être géré pour cette famille.");
    }
    const subscription = await this.prisma.subscription.findFirst({
      where: {
        userId,
        environment,
        stripeCustomerRecordId: customer.id,
        stripeSubscriptionId: { not: null }
      }
    });
    if (!subscription) {
      throw new BadRequestException("Aucun abonnement Stripe ne peut être géré pour cette famille.");
    }
    const session = await this.stripeService.client.billingPortal.sessions.create({
      customer: customer.stripeCustomerId,
      return_url: `${this.frontendUrl}/me`
    });
    return { portalUrl: session.url };
  }

  async handleStripeWebhook(rawBody: Buffer, signature?: string) {
    if (this.stripeService.mode === "DISABLED") {
      throw new ServiceUnavailableException("Les webhooks Stripe sont désactivés.");
    }
    if (!signature || !rawBody.length) {
      throw new BadRequestException("La signature Stripe ou le corps brut est absent.");
    }

    let event: Stripe.Event;
    try {
      event = this.stripeService.client.webhooks.constructEvent(
        rawBody,
        signature,
        this.stripeService.webhookSecret
      );
    } catch {
      throw new BadRequestException("La signature Stripe est invalide.");
    }

    const environment = this.requiredEnvironment();
    if (event.livemode !== (environment === StripeEnvironment.LIVE)) {
      throw new BadRequestException("L'environnement de l'événement Stripe ne correspond pas à FAB.");
    }

    const previous = await this.prisma.stripeWebhookEvent.findUnique({ where: { id: event.id } });
    const processingIsRecent =
      previous?.status === StripeWebhookEventStatus.PROCESSING &&
      previous.updatedAt.getTime() > Date.now() - 5 * 60 * 1000;
    if (previous?.status === StripeWebhookEventStatus.PROCESSED || processingIsRecent) {
      return { received: true };
    }

    const eventData = {
      environment,
      type: event.type,
      livemode: event.livemode,
      status: StripeWebhookEventStatus.PROCESSING,
      objectId: getStripeObjectId(event.data.object),
      eventCreatedAt: fromUnixSeconds(event.created) ?? new Date(),
      processedAt: null,
      error: null
    };
    if (previous) {
      await this.prisma.stripeWebhookEvent.update({ where: { id: event.id }, data: eventData });
    } else {
      try {
        await this.prisma.stripeWebhookEvent.create({ data: { id: event.id, ...eventData } });
      } catch (error) {
        if (isPrismaUniqueError(error)) {
          return { received: true };
        }
        throw error;
      }
    }

    try {
      await this.processStripeEvent(event, environment);
      await this.prisma.stripeWebhookEvent.update({
        where: { id: event.id },
        data: { status: StripeWebhookEventStatus.PROCESSED, processedAt: new Date(), error: null }
      });
      return { received: true };
    } catch (error) {
      const message = safeErrorMessage(error);
      await this.prisma.stripeWebhookEvent.update({
        where: { id: event.id },
        data: { status: StripeWebhookEventStatus.FAILED, processedAt: new Date(), error: message }
      });
      this.logger.error(`Stripe event ${event.id} failed: ${message}`);
      throw error;
    }
  }

  async resyncFamilySubscription(userId: string, actorUserId?: string) {
    const environment = this.requiredEnvironment();
    const subscription = await this.prisma.subscription.findFirst({
      where: { userId, environment, stripeSubscriptionId: { not: null } },
      orderBy: { updatedAt: "desc" }
    });
    if (!subscription?.stripeSubscriptionId) {
      throw new BadRequestException("Aucun abonnement Stripe synchronisable pour cette famille.");
    }
    const synced = await this.syncSubscriptionFromStripe(subscription.stripeSubscriptionId, environment, new Date());
    if (actorUserId) {
      await this.prisma.adminAuditLog.create({
        data: {
          actorUserId,
          action: "FAMILY_SUBSCRIPTION_RESYNCED",
          targetType: "USER",
          targetId: userId,
          payload: { status: synced.status, environment }
        }
      });
    }
    return this.toPublicSubscription(synced);
  }

  async cancelFamilySubscriptionsBeforeDeletion(userId: string) {
    const checkoutSessions = await this.prisma.stripeCheckoutSession.findMany({
      where: {
        status: StripeCheckoutSessionStatus.OPEN,
        familyStripeCustomer: { familyProfile: { userId } }
      },
      include: { familyStripeCustomer: { select: { environment: true } } }
    });
    for (const checkoutSession of checkoutSessions) {
      if (
        checkoutSession.familyStripeCustomer.environment !== this.currentEnvironment() ||
        !checkoutSession.stripeCheckoutSessionId
      ) {
        throw new ServiceUnavailableException(
          "La suppression est suspendue : une séance de paiement Stripe doit être fermée d'abord."
        );
      }
      try {
        await this.stripeService.client.checkout.sessions.expire(checkoutSession.stripeCheckoutSessionId);
        await this.prisma.stripeCheckoutSession.update({
          where: { id: checkoutSession.id },
          data: { status: StripeCheckoutSessionStatus.EXPIRED, activeKey: null }
        });
      } catch {
        try {
          const current = await this.stripeService.client.checkout.sessions.retrieve(
            checkoutSession.stripeCheckoutSessionId
          );
          if (current.status !== "open") {
            await this.prisma.stripeCheckoutSession.update({
              where: { id: checkoutSession.id },
              data: {
                status:
                  current.status === "complete"
                    ? StripeCheckoutSessionStatus.COMPLETED
                    : StripeCheckoutSessionStatus.EXPIRED,
                activeKey: null
              }
            });
            continue;
          }
        } catch {
          // La suppression reste bloquée ci-dessous : aucun risque de paiement orphelin n'est accepté.
        }
        throw new ServiceUnavailableException(
          "La suppression est suspendue parce qu'une séance de paiement Stripe n'a pas pu être fermée."
        );
      }
    }

    const subscriptions = await this.prisma.subscription.findMany({
      where: {
        userId,
        environment: { in: [StripeEnvironment.TEST, StripeEnvironment.LIVE] },
        status: { in: OPEN_SUBSCRIPTION_STATUSES }
      }
    });
    for (const subscription of subscriptions) {
      if (subscription.environment !== this.currentEnvironment() || !subscription.stripeSubscriptionId) {
        throw new ServiceUnavailableException(
          "La suppression est suspendue : un abonnement Stripe d'un autre environnement doit être annulé d'abord."
        );
      }
      try {
        const canceled = await this.stripeService.client.subscriptions.cancel(subscription.stripeSubscriptionId, {
          invoice_now: false,
          prorate: false
        });
        await this.persistStripeSubscription(canceled, subscription.environment, new Date());
      } catch (error) {
        try {
          const current = await this.stripeService.client.subscriptions.retrieve(subscription.stripeSubscriptionId);
          if (current.status === "canceled") {
            await this.persistStripeSubscription(current, subscription.environment, new Date());
            continue;
          }
        } catch {
          // L'erreur d'annulation originale reste la cause présentée; aucun compte local n'est supprimé.
        }
        await this.prisma.subscription.update({
          where: { id: subscription.id },
          data: { lastSyncError: safeErrorMessage(error), lastSyncedAt: new Date() }
        });
        throw new ServiceUnavailableException(
          "La suppression est suspendue parce que l'abonnement Stripe n'a pas pu être annulé."
        );
      }
    }
  }

  private async processStripeEvent(event: Stripe.Event, environment: StripeEnvironment) {
    const eventAt = fromUnixSeconds(event.created) ?? new Date();
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await this.closeCheckoutSession(session.id, StripeCheckoutSessionStatus.COMPLETED);
        const subscriptionId = getStripeId(session.subscription);
        if (subscriptionId) {
          await this.syncSubscriptionFromStripe(subscriptionId, environment, eventAt);
        }
        return;
      }
      case "checkout.session.expired": {
        const session = event.data.object as Stripe.Checkout.Session;
        await this.closeCheckoutSession(session.id, StripeCheckoutSessionStatus.EXPIRED);
        return;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const authoritative = await this.stripeService.client.subscriptions.retrieve(subscription.id);
        await this.persistStripeSubscription(authoritative, environment, eventAt);
        return;
      }
      case "invoice.paid":
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = getInvoiceSubscriptionId(invoice);
        if (!subscriptionId) {
          return;
        }
        const synced = await this.syncSubscriptionFromStripe(subscriptionId, environment, eventAt);
        const eventIsCurrent = !synced.lastStripeEventAt || synced.lastStripeEventAt <= eventAt;
        if (event.type === "invoice.payment_failed" && eventIsCurrent) {
          await this.prisma.subscription.update({
            where: { id: synced.id },
            data: {
              status: SubscriptionStatus.PAST_DUE,
              paymentFailedAt: eventAt,
              lastStripeEventAt: latestDate(synced.lastStripeEventAt, eventAt)
            }
          });
        } else if (synced.status === SubscriptionStatus.ACTIVE || synced.status === SubscriptionStatus.TRIALING) {
          await this.prisma.subscription.update({
            where: { id: synced.id },
            data: { paymentFailedAt: null }
          });
        }
        return;
      }
      default:
        return;
    }
  }

  private async syncSubscriptionFromStripe(
    stripeSubscriptionId: string,
    environment: StripeEnvironment,
    eventAt: Date
  ) {
    const subscription = await this.stripeService.client.subscriptions.retrieve(stripeSubscriptionId);
    return this.persistStripeSubscription(subscription, environment, eventAt);
  }

  private async persistStripeSubscription(
    stripeSubscription: Stripe.Subscription,
    environment: StripeEnvironment,
    eventAt: Date
  ) {
    if (environment !== this.requiredEnvironment()) {
      throw new BadRequestException("L'environnement Stripe de l'abonnement est invalide.");
    }
    const expectedItem = stripeSubscription.items.data.find(
      (item) => getStripeId(item.price) === this.stripeService.priceId
    );
    if (!expectedItem || stripeSubscription.items.data.length !== 1) {
      throw new BadRequestException("L'abonnement Stripe ne correspond pas à l'offre familiale FAB.");
    }
    const customerId = getStripeId(stripeSubscription.customer);
    if (!customerId) {
      throw new BadRequestException("Le client Stripe de l'abonnement est absent.");
    }

    const billingReference = stripeSubscription.metadata?.billingReference;
    const customer = await this.prisma.familyStripeCustomer.findFirst({
      where: {
        environment,
        OR: [
          { stripeCustomerId: customerId },
          ...(billingReference ? [{ billingReference }] : [])
        ]
      },
      include: { familyProfile: { select: { userId: true } } }
    });
    if (!customer || customer.stripeCustomerId !== customerId) {
      throw new BadRequestException("L'abonnement Stripe n'appartient pas à une famille reconnue par FAB.");
    }

    const existing = await this.prisma.subscription.findUnique({
      where: { stripeSubscriptionId: stripeSubscription.id }
    });
    if (existing && (existing.userId !== customer.familyProfile.userId || existing.environment !== environment)) {
      throw new BadRequestException("L'abonnement Stripe est lié à un autre dossier FAB.");
    }

    const mappedStatus = mapStripeSubscriptionStatus(stripeSubscription.status);
    const data = {
      userId: customer.familyProfile.userId,
      environment,
      status: mappedStatus,
      stripeCustomerId: customerId,
      stripeCustomerRecordId: customer.id,
      stripePriceId: this.stripeService.priceId,
      currentPeriodStart: fromUnixSeconds(expectedItem.current_period_start),
      currentPeriodEnd: fromUnixSeconds(expectedItem.current_period_end),
      cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
      canceledAt: fromUnixSeconds(stripeSubscription.canceled_at),
      paymentFailedAt:
        mappedStatus === SubscriptionStatus.PAST_DUE ? existing?.paymentFailedAt ?? eventAt : null,
      lastSyncedAt: new Date(),
      lastSyncError: null,
      lastStripeEventAt: latestDate(existing?.lastStripeEventAt ?? null, eventAt)
    };

    return this.prisma.subscription.upsert({
      where: { stripeSubscriptionId: stripeSubscription.id },
      create: { ...data, stripeSubscriptionId: stripeSubscription.id },
      update: data
    });
  }

  private async reconcileAllSubscriptions() {
    const environment = this.currentEnvironment();
    if (!environment) {
      return;
    }
    const subscriptions = await this.prisma.subscription.findMany({
      where: {
        environment,
        stripeSubscriptionId: { not: null },
        status: { in: OPEN_SUBSCRIPTION_STATUSES }
      },
      select: { id: true, stripeSubscriptionId: true }
    });
    for (const subscription of subscriptions) {
      try {
        await this.syncSubscriptionFromStripe(subscription.stripeSubscriptionId!, environment, new Date());
      } catch (error) {
        const message = safeErrorMessage(error);
        await this.prisma.subscription.update({
          where: { id: subscription.id },
          data: { lastSyncError: message, lastSyncedAt: new Date() }
        });
        this.logger.warn(`Stripe reconciliation failed for subscription ${subscription.id}: ${message}`);
      }
    }
  }

  private async getOrCreateFamilyCustomer(family: FamilyContext, environment: StripeEnvironment) {
    const existing = await this.prisma.familyStripeCustomer.findUnique({
      where: { familyProfileId_environment: { familyProfileId: family.familyProfile.id, environment } }
    });
    if (existing) {
      return existing;
    }

    const billingReference = randomUUID();
    const stripeCustomer = await this.stripeService.client.customers.create(
      {
        email: family.email,
        name: family.familyProfile.displayName,
        preferred_locales: ["fr-CA"],
        metadata: this.stripeMetadata(billingReference)
      },
      { idempotencyKey: `fab-family-customer-${environment}-${family.familyProfile.id}` }
    );
    return this.prisma.familyStripeCustomer.upsert({
      where: { familyProfileId_environment: { familyProfileId: family.familyProfile.id, environment } },
      create: {
        familyProfileId: family.familyProfile.id,
        environment,
        stripeCustomerId: stripeCustomer.id,
        billingReference: stripeCustomer.metadata.billingReference || billingReference
      },
      update: {}
    });
  }

  private async findReusableCheckoutSession(customerId: string, activeKey: string) {
    const local = await this.prisma.stripeCheckoutSession.findFirst({
      where: {
        familyStripeCustomerId: customerId,
        activeKey,
        status: StripeCheckoutSessionStatus.OPEN,
        expiresAt: { gt: new Date() }
      }
    });
    if (!local?.stripeCheckoutSessionId) {
      return null;
    }
    try {
      const session = await this.stripeService.client.checkout.sessions.retrieve(local.stripeCheckoutSessionId);
      if (session.status === "open" && session.url) {
        return { checkoutUrl: session.url };
      }
    } catch {
      // Le dossier local est fermé ci-dessous afin de permettre une nouvelle tentative sûre.
    }
    await this.prisma.stripeCheckoutSession.update({
      where: { id: local.id },
      data: { status: StripeCheckoutSessionStatus.EXPIRED, activeKey: null }
    });
    return null;
  }

  private async closeCheckoutSession(stripeSessionId: string, status: StripeCheckoutSessionStatus) {
    await this.prisma.stripeCheckoutSession.updateMany({
      where: { stripeCheckoutSessionId: stripeSessionId },
      data: { status, activeKey: null }
    });
  }

  private async getValidatedPrice(force = false) {
    if (this.validatedPrice && !force) {
      return this.validatedPrice;
    }
    const environment = this.requiredEnvironment();
    const price = await this.stripeService.client.prices.retrieve(this.stripeService.priceId);
    const valid =
      price.active &&
      price.livemode === (environment === StripeEnvironment.LIVE) &&
      price.currency.toLowerCase() === "cad" &&
      price.type === "recurring" &&
      price.recurring?.interval === "month" &&
      price.recurring.interval_count === 1 &&
      Number.isInteger(price.unit_amount) &&
      (price.unit_amount ?? 0) > 0;
    if (!valid) {
      throw new Error("Le prix Stripe doit être actif, mensuel, en CAD et appartenir au bon environnement.");
    }
    this.validatedPrice = price;
    return price;
  }

  private assertCheckoutAllowed(family: FamilyContext) {
    const reason = this.getCheckoutBlockReason(family);
    if (reason) {
      throw new ForbiddenException(reason);
    }
  }

  private assertEnvironmentAccess(family: FamilyContext) {
    if (this.stripeService.mode === "DISABLED") {
      throw new ServiceUnavailableException("La facturation Stripe est désactivée.");
    }
    if (this.stripeService.mode === "TEST" && !family.familyProfile.isInternalTest) {
      throw new ForbiddenException("Le mode test Stripe est réservé aux familles marquées Test interne.");
    }
    if (this.stripeService.mode === "LIVE" && family.familyProfile.isInternalTest) {
      throw new ForbiddenException("Les familles de test ne peuvent jamais accéder au paiement réel.");
    }
  }

  private familyMatchesCurrentEnvironment(family: FamilyContext): boolean {
    return (
      (this.stripeService.mode === "TEST" && family.familyProfile.isInternalTest) ||
      (this.stripeService.mode === "LIVE" && !family.familyProfile.isInternalTest)
    );
  }

  private getCheckoutBlockReason(family: FamilyContext): string | null {
    if (family.status !== UserStatus.ACTIVE) {
      return "Ce compte famille n'est pas actif.";
    }
    if (!family.emailVerifiedAt) {
      return "L'adresse courriel doit être vérifiée avant le paiement.";
    }
    if (this.stripeService.mode === "DISABLED") {
      return "La facturation Stripe est désactivée.";
    }
    if (!this.stripeService.checkoutEnabled) {
      return "Le paiement est temporairement fermé.";
    }
    if (this.stripeService.mode === "TEST" && !family.familyProfile.isInternalTest) {
      return "L'abonnement famille n'est pas encore ouvert au public.";
    }
    if (this.stripeService.mode === "LIVE" && family.familyProfile.isInternalTest) {
      return "Un profil de test ne peut pas effectuer un paiement réel.";
    }
    if (this.stripeService.mode === "LIVE" && this.stripeService.taxMode === "UNCONFIRMED") {
      return "L'ouverture des abonnements famille est en préparation.";
    }
    return null;
  }

  private async getFamilyContext(userId: string): Promise<FamilyContext> {
    const family = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        emailVerifiedAt: true,
        role: true,
        status: true,
        familyProfile: { select: { id: true, displayName: true, isInternalTest: true } }
      }
    });
    const familyProfile = family?.familyProfile;
    if (!family || family.role !== Role.FAMILY || !familyProfile) {
      throw new BadRequestException("Seul un compte famille peut accéder à la facturation.");
    }
    return { ...family, familyProfile };
  }

  private requiredEnvironment(): StripeEnvironment {
    const environment = this.currentEnvironment();
    if (!environment) {
      throw new ServiceUnavailableException("La facturation Stripe est désactivée.");
    }
    return environment;
  }

  private currentEnvironment(): StripeEnvironment | null {
    if (this.stripeService.mode === "TEST") {
      return StripeEnvironment.TEST;
    }
    if (this.stripeService.mode === "LIVE") {
      return StripeEnvironment.LIVE;
    }
    return null;
  }

  private publicFamilyBillingState(): "PREPARATORY" | "OPEN" {
    const isOpen =
      this.stripeService.mode === "LIVE" &&
      this.stripeService.checkoutEnabled &&
      this.stripeService.taxMode !== "UNCONFIRMED";
    return isOpen ? "OPEN" : "PREPARATORY";
  }

  private stripeMetadata(billingReference: string): Record<string, string> {
    return {
      kind: "FAMILY_SUBSCRIPTION",
      environment: this.stripeService.mode,
      billingReference
    };
  }

  private toPublicSubscription(subscription: {
    status: SubscriptionStatus;
    currentPeriodEnd: Date | null;
    cancelAtPeriodEnd: boolean;
    stripeCustomerRecordId: string | null;
    environment: StripeEnvironment;
  }, familyCanManage = true) {
    const matchesCurrentEnvironment = subscription.environment === this.currentEnvironment();
    const periodIsCurrent = !subscription.currentPeriodEnd || subscription.currentPeriodEnd > new Date();
    const hasPremiumAccess =
      familyCanManage &&
      matchesCurrentEnvironment &&
      periodIsCurrent &&
      (subscription.status === SubscriptionStatus.ACTIVE || subscription.status === SubscriptionStatus.TRIALING);
    return {
      status: subscription.status,
      currentPeriodEnd: subscription.currentPeriodEnd,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      canManage:
        familyCanManage &&
        matchesCurrentEnvironment &&
        Boolean(subscription.stripeCustomerRecordId),
      hasPremiumAccess,
      needsAdminReview: subscription.environment === StripeEnvironment.LEGACY
    };
  }
}

type FamilyContext = {
  id: string;
  email: string;
  emailVerifiedAt: Date | null;
  role: Role;
  status: UserStatus;
  familyProfile: {
    id: string;
    displayName: string;
    isInternalTest: boolean;
  };
};

function mapStripeSubscriptionStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
  switch (status) {
    case "incomplete":
      return SubscriptionStatus.INCOMPLETE;
    case "incomplete_expired":
      return SubscriptionStatus.INCOMPLETE_EXPIRED;
    case "trialing":
      return SubscriptionStatus.TRIALING;
    case "active":
      return SubscriptionStatus.ACTIVE;
    case "past_due":
      return SubscriptionStatus.PAST_DUE;
    case "canceled":
      return SubscriptionStatus.CANCELED;
    case "unpaid":
      return SubscriptionStatus.UNPAID;
    case "paused":
      return SubscriptionStatus.PAUSED;
    default:
      return SubscriptionStatus.INACTIVE;
  }
}

function getStripeId(value: string | { id: string } | null | undefined): string | null {
  if (!value) {
    return null;
  }
  return typeof value === "string" ? value : value.id;
}

function getInvoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  return getStripeId(invoice.parent?.subscription_details?.subscription);
}

function getStripeObjectId(value: unknown): string | null {
  if (!value || typeof value !== "object" || !("id" in value)) {
    return null;
  }
  return typeof (value as { id?: unknown }).id === "string" ? (value as { id: string }).id : null;
}

function fromUnixSeconds(value: number | null | undefined): Date | null {
  return typeof value === "number" ? new Date(value * 1000) : null;
}

function latestDate(current: Date | null, incoming: Date): Date {
  return current && current > incoming ? current : incoming;
}

function safeErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "Erreur Stripe inconnue";
  return message.slice(0, 1000);
}

function isPrismaUniqueError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}
