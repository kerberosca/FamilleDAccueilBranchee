import { Module } from "@nestjs/common";
import { BillingModule } from "../billing/billing.module";
import { UsersModule } from "../users/users.module";
import { ProfilesController } from "./profiles.controller";
import { ProfilesService } from "./profiles.service";

@Module({
  imports: [BillingModule, UsersModule],
  controllers: [ProfilesController],
  providers: [ProfilesService],
  exports: [ProfilesService]
})
export class ProfilesModule {}
