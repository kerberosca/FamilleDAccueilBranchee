import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Role } from "@prisma/client";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Public } from "../../common/decorators/public.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { JwtPayload } from "../../common/types/jwt-payload.type";
import { SetMaintenanceDto } from "./dto/set-maintenance.dto";
import { MaintenanceService } from "./maintenance.service";

@ApiTags("maintenance")
@Controller({ path: "maintenance", version: "1" })
export class MaintenanceController {
  constructor(private readonly maintenanceService: MaintenanceService) {}

  @Public()
  @Get("status")
  async getStatus() {
    return this.maintenanceService.getState();
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Post()
  async setMaintenance(@CurrentUser() user: JwtPayload, @Body() body: SetMaintenanceDto) {
    return this.maintenanceService.setEnabled(body.enabled, user.sub);
  }
}
