import { Body, Controller, Get, Param, Patch, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Role } from "@prisma/client";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { OptionalJwtAuthGuard } from "../../common/guards/optional-jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { JwtPayload } from "../../common/types/jwt-payload.type";
import { BulkModerateResourceDto } from "./dto/bulk-moderate-resource.dto";
import { ModerateResourceDto } from "./dto/moderate-resource.dto";
import { UpdateFamilyProfileDto } from "./dto/update-family-profile.dto";
import { UpdateResourceProfileDto } from "./dto/update-resource-profile.dto";
import { ProfilesService } from "./profiles.service";

@ApiTags("profiles")
@Controller({ path: "profiles", version: "1" })
export class ProfilesController {
  constructor(private readonly profilesService: ProfilesService) {}

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get("me")
  async getMyProfile(@CurrentUser() user: JwtPayload) {
    return this.profilesService.getMyProfile(user);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.FAMILY)
  @Patch("family/me")
  async updateMyFamilyProfile(@CurrentUser() user: JwtPayload, @Body() dto: UpdateFamilyProfileDto) {
    return this.profilesService.updateMyFamilyProfile(user, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.RESOURCE)
  @Patch("resource/me")
  async updateMyResourceProfile(@CurrentUser() user: JwtPayload, @Body() dto: UpdateResourceProfileDto) {
    return this.profilesService.updateMyResourceProfile(user, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Get("resources/admin")
  async listResourcesForAdmin(
    @Query("query") query?: string,
    @Query("verificationStatus") verificationStatus?: string,
    @Query("publishStatus") publishStatus?: string,
    @Query("onboardingState") onboardingState?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
    @Query("sortBy") sortBy?: string,
    @Query("sortOrder") sortOrder?: string
  ) {
    return this.profilesService.listResourcesForAdmin({
      query,
      verificationStatus,
      publishStatus,
      onboardingState,
      page: Number(page ?? 1),
      pageSize: Number(pageSize ?? 10),
      sortBy,
      sortOrder
    });
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Patch("resources/moderation/bulk")
  async bulkModerateResources(@CurrentUser() user: JwtPayload, @Body() dto: BulkModerateResourceDto) {
    return this.profilesService.bulkModerateResources(dto.resourceIds, dto, user.sub);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Patch("resource/:resourceId/moderation")
  async moderateResource(@CurrentUser() user: JwtPayload, @Param("resourceId") resourceId: string, @Body() dto: ModerateResourceDto) {
    return this.profilesService.moderateResource(resourceId, dto, user.sub);
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get("resource/:resourceId")
  async getResource(@Param("resourceId") resourceId: string, @CurrentUser() user?: JwtPayload) {
    return this.profilesService.getResourcePublicOrPremium(resourceId, user);
  }
}
