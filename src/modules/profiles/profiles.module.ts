import { Module } from "@nestjs/common";
import { AllyWebhooksModule } from "../ally-webhooks/ally-webhooks.module";
import { BillingModule } from "../billing/billing.module";
import { EmailModule } from "../email/email.module";
import { UsersModule } from "../users/users.module";
import { ProfilesController } from "./profiles.controller";
import { ProfilesService } from "./profiles.service";

@Module({
  imports: [AllyWebhooksModule, BillingModule, EmailModule, UsersModule],
  controllers: [ProfilesController],
  providers: [ProfilesService],
  exports: [ProfilesService]
})
export class ProfilesModule {}
