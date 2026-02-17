import { Module } from "@nestjs/common";
import { BillingController } from "./billing.controller";
import { BillingService } from "./billing.service";
import { StripeService } from "./stripe.service";
import { SubscriptionAccessService } from "./subscription-access.service";

@Module({
  controllers: [BillingController],
  providers: [BillingService, StripeService, SubscriptionAccessService],
  exports: [BillingService, SubscriptionAccessService]
})
export class BillingModule {}
