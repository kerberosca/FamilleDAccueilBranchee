import { Body, Controller, Headers, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Role } from "@prisma/client";
import { Request } from "express";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Public } from "../../common/decorators/public.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { JwtPayload } from "../../common/types/jwt-payload.type";
import { BillingService } from "./billing.service";

@ApiTags("billing")
@Controller({ path: "billing", version: "1" })
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.RESOURCE)
  @Post("resource/checkout-session")
  async createResourceCheckoutSession(@CurrentUser() user: JwtPayload) {
    return this.billingService.createResourceCheckoutSession(user.sub);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.FAMILY)
  @Post("family/checkout-session")
  async createFamilyCheckoutSession(@CurrentUser() user: JwtPayload) {
    return this.billingService.createFamilySubscriptionCheckoutSession(user.sub);
  }

  @Public()
  @Post("stripe/webhook")
  async handleWebhook(@Req() req: Request, @Headers("stripe-signature") signature?: string) {
    const body = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body ?? {}), "utf-8");
    return this.billingService.handleStripeWebhook(body, signature);
  }

  @Public()
  @Post("family/mock-activate")
  async mockActivate(@Body() body: { userId: string }) {
    return this.billingService.markFamilySubscriptionActive(body.userId);
  }
}
