import { Body, Controller, Get, Header, HttpCode, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { ConfigService } from "@nestjs/config";
import { Throttle } from "@nestjs/throttler";
import { Request } from "express";
import { Public } from "../../common/decorators/public.decorator";
import { NewsletterSourceDto, SubscribeNewsletterDto } from "./newsletter.dto";
import { NewsletterService } from "./newsletter.service";
import { NewsletterThrottlerGuard } from "./newsletter-throttler.guard";
import { newsletterClientIp } from "./newsletter-client-ip";

@ApiTags("newsletter")
@Public()
@UseGuards(NewsletterThrottlerGuard)
@Controller({ path: "newsletter", version: "1" })
export class NewsletterController {
  constructor(private readonly newsletter: NewsletterService, private readonly config: ConfigService) {}

  @Get("form")
  @Header("Cache-Control", "no-store")
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  form(@Query() query: NewsletterSourceDto, @Req() request: Request) {
    return this.newsletter.challenge(query.source, this.context(request));
  }

  @Post("subscribe")
  @HttpCode(200)
  @Header("Cache-Control", "no-store")
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  subscribe(@Body() body: SubscribeNewsletterDto, @Req() request: Request) {
    return this.newsletter.subscribe(body, this.context(request));
  }

  private context(request: Request) {
    return { ip: newsletterClientIp(request, this.config), userAgent: request.get("user-agent") || "" };
  }
}
