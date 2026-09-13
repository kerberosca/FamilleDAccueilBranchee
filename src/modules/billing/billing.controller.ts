import { Controller, Get, Headers, HttpCode, Param, Post, RawBodyRequest, Req, UseGuards } from "@nestjs/common";
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

  @Public()
  @Get("family/readiness")
  getFamilyReadiness() {
    return this.billingService.getPublicFamilyReadiness();
  }

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
  @Get("family/offer")
  async getFamilyOffer(@CurrentUser() user: JwtPayload) {
    return this.billingService.getFamilyOffer(user.sub);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.FAMILY)
  @Get("family/subscription")
  async getFamilySubscription(@CurrentUser() user: JwtPayload) {
    return this.billingService.getFamilySubscription(user.sub);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.FAMILY)
  @Post("family/checkout-session")
  async createFamilyCheckoutSession(@CurrentUser() user: JwtPayload) {
    return this.billingService.createFamilySubscriptionCheckoutSession(user.sub);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.FAMILY)
  @Post("family/portal-session")
  async createFamilyPortalSession(@CurrentUser() user: JwtPayload) {
    return this.billingService.createFamilyPortalSession(user.sub);
  }

  @Public()
  @Post("stripe/webhook")
  @HttpCode(200)
  async handleWebhook(@Req() req: RawBodyRequest<Request>, @Headers("stripe-signature") signature?: string) {
    return this.billingService.handleStripeWebhook(req.rawBody ?? Buffer.alloc(0), signature);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Post("admin/families/:userId/resync")
  async resyncFamilySubscription(@CurrentUser() user: JwtPayload, @Param("userId") userId: string) {
    return this.billingService.resyncFamilySubscription(userId, user.sub);
  }
}
