import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Role } from "@prisma/client";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { SystemStatusService } from "./system-status.service";

@ApiTags("system-status")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller({ path: "system-status", version: "1" })
export class SystemStatusController {
  constructor(private readonly systemStatusService: SystemStatusService) {}

  @Get()
  async getStatus() {
    return this.systemStatusService.getStatus();
  }
}
