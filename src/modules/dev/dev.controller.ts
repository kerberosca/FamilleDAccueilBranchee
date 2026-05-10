import { Body, Controller, Get, NotFoundException, Param, Post, Res, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { ConfigService } from "@nestjs/config";
import { Response } from "express";
import { Public } from "../../common/decorators/public.decorator";
import {
  buildAllyProfileUpdatedEmail,
  buildAllyAdminStatusEmail,
  buildAllyWelcomeEmail,
  buildPasswordResetEmail,
  buildTeamNewAllyEmail,
  buildTeamNewFamilyEmail
} from "../email/fab-email.templates";
import { DevLoginAsDto } from "./dto/dev-login-as.dto";
import { DevOnlyGuard } from "./guards/dev-only.guard";
import { DevService } from "./dev.service";

@ApiTags("dev")
@Controller({ path: "dev", version: "1" })
export class DevController {
  constructor(
    private readonly devService: DevService,
    private readonly configService: ConfigService
  ) {}

  @Public()
  @UseGuards(DevOnlyGuard)
  @Post("login-as")
  async loginAs(@Body() body: DevLoginAsDto) {
    return this.devService.loginAs(body.role);
  }

  @Public()
  @UseGuards(DevOnlyGuard)
  @Get("email-preview/:template")
  async emailPreview(@Param("template") template: string, @Res() res: Response) {
    const frontendUrl = this.configService.get<string>("APP_FRONTEND_URL", "http://localhost:3002");
    const resetUrl = `${frontendUrl.replace(/\/$/, "")}/reset-password?token=preview-token`;
    const html =
      template === "ally-welcome"
        ? buildAllyWelcomeEmail({
            displayName: "Alex Tremblay",
            allyTypeLabel: "Gardien compétent",
            frontendUrl
          })
        : template === "ally-profile-updated"
          ? buildAllyProfileUpdatedEmail({
              displayName: "Alex Tremblay",
              frontendUrl
            })
          : template === "ally-approved"
            ? buildAllyAdminStatusEmail({
                displayName: "Alex Tremblay",
                verificationStatus: "VERIFIED",
                publishStatus: "PUBLISHED",
                onboardingState: "PUBLISHED",
                frontendUrl
              })
            : template === "ally-rejected"
              ? buildAllyAdminStatusEmail({
                  displayName: "Alex Tremblay",
                  verificationStatus: "REJECTED",
                  publishStatus: "HIDDEN",
                  onboardingState: "SUSPENDED",
                  frontendUrl
                })
              : template === "team-new-ally"
                ? buildTeamNewAllyEmail({
                    displayName: "Alex Tremblay",
                    email: "alex@example.test",
                    allyTypeLabel: "Gardien compétent",
                    city: "Montréal",
                    frontendUrl
                  })
                : template === "team-new-family"
                  ? buildTeamNewFamilyEmail({
                      displayName: "Famille Bouchard",
                      email: "famille@example.test",
                      city: "Montréal",
                      frontendUrl
                    })
                  : template === "password-reset"
                    ? buildPasswordResetEmail({ resetUrl, frontendUrl })
                    : null;

    if (!html) {
      throw new NotFoundException("Template email inconnu.");
    }
    res.type("html").send(html);
  }
}
