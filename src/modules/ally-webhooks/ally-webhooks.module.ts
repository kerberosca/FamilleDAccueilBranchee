import { Module } from "@nestjs/common";
import { AllyWebhooksService } from "./ally-webhooks.service";

@Module({
  providers: [AllyWebhooksService],
  exports: [AllyWebhooksService]
})
export class AllyWebhooksModule {}
