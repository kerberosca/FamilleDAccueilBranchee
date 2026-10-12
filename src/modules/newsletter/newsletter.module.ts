import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { CyberimpactService } from "./cyberimpact.service";
import { NewsletterController } from "./newsletter.controller";
import { NewsletterService } from "./newsletter.service";
import { NewsletterThrottlerGuard } from "./newsletter-throttler.guard";

@Module({
  imports: [PrismaModule],
  controllers: [NewsletterController],
  providers: [NewsletterService, CyberimpactService, NewsletterThrottlerGuard]
})
export class NewsletterModule {}
