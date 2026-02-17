import { Module } from "@nestjs/common";
import { BillingModule } from "../billing/billing.module";
import { MessagingController } from "./messaging.controller";
import { MessagingService } from "./messaging.service";

@Module({
  imports: [BillingModule],
  controllers: [MessagingController],
  providers: [MessagingService]
})
export class MessagingModule {}
