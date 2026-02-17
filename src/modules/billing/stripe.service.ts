import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Stripe from "stripe";

@Injectable()
export class StripeService {
  readonly client: Stripe;

  constructor(configService: ConfigService) {
    const apiKey = configService.get<string>("STRIPE_SECRET_KEY");
    if (!apiKey) {
      // API key can be absent in dev exploration; endpoints will fail explicitly when used.
      this.client = new Stripe("sk_test_placeholder", { apiVersion: "2024-06-20" });
      return;
    }
    this.client = new Stripe(apiKey, { apiVersion: "2024-06-20" });
  }
}
