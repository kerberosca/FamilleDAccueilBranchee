import { Module } from "@nestjs/common";
import { BillingModule } from "../billing/billing.module";
import { SearchController } from "./search.controller";
import { SearchService } from "./search.service";

@Module({
  imports: [BillingModule],
  controllers: [SearchController],
  providers: [SearchService]
})
export class SearchModule {}
