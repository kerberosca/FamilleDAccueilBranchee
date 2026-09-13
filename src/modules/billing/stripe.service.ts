import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Stripe from "stripe";

export type StripeBillingMode = "DISABLED" | "TEST" | "LIVE";
export type StripeTaxMode = "UNCONFIRMED" | "AUTOMATIC" | "DISABLED";

@Injectable()
export class StripeService {
  private readonly stripeClient: Stripe | null;
  readonly mode: StripeBillingMode;
  readonly checkoutEnabled: boolean;
  readonly taxMode: StripeTaxMode;
  readonly priceId: string;
  readonly webhookSecret: string;

  constructor(configService: ConfigService) {
    this.mode = configService.get<StripeBillingMode>("STRIPE_BILLING_MODE", "DISABLED");
    this.checkoutEnabled = configService.get<string>("STRIPE_CHECKOUT_ENABLED", "false") === "true";
    this.taxMode = configService.get<StripeTaxMode>("STRIPE_TAX_MODE", "UNCONFIRMED");
    this.priceId = (configService.get<string>("STRIPE_FAMILY_SUBSCRIPTION_PRICE_ID", "") ?? "").trim();
    this.webhookSecret = (configService.get<string>("STRIPE_WEBHOOK_SECRET", "") ?? "").trim();

    const apiKey = (configService.get<string>("STRIPE_SECRET_KEY", "") ?? "").trim();
    if (this.mode === "DISABLED") {
      this.stripeClient = null;
      return;
    }

    this.assertConfigured(apiKey);
    this.stripeClient = new Stripe(apiKey, {
      // La version est épinglée volontairement : Stripe 22 accepte encore cette version,
      // même si ses types sont générés depuis une révision Dahlia plus récente.
      apiVersion: "2026-03-25.dahlia" as Stripe.LatestApiVersion
    });
  }

  get client(): Stripe {
    if (!this.stripeClient) {
      throw new ServiceUnavailableException("La facturation Stripe est désactivée.");
    }
    return this.stripeClient;
  }

  private assertConfigured(apiKey: string) {
    const expectedKeyPrefixes = this.mode === "TEST" ? ["sk_test_", "rk_test_"] : ["sk_live_", "rk_live_"];
    if (!expectedKeyPrefixes.some((prefix) => apiKey.startsWith(prefix))) {
      throw new Error(`STRIPE_SECRET_KEY ne correspond pas au mode ${this.mode}.`);
    }
    if (!this.priceId.startsWith("price_")) {
      throw new Error("STRIPE_FAMILY_SUBSCRIPTION_PRICE_ID est requis quand Stripe est activé.");
    }
    if (!this.webhookSecret.startsWith("whsec_")) {
      throw new Error("STRIPE_WEBHOOK_SECRET est requis quand Stripe est activé.");
    }
  }
}
