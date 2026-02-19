import { Controller, Get, Param, Patch, Body, UseGuards, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Role } from "@prisma/client";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { JwtPayload } from "../../common/types/jwt-payload.type";
import { BulkUpdateUserStatusDto } from "./dto/bulk-update-user-status.dto";
import { UpdateUserRoleDto } from "./dto/update-user-role.dto";
import { UpdateUserStatusDto } from "./dto/update-user-status.dto";
import { UsersService } from "./users.service";

@ApiTags("users")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: "users", version: "1" })
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get("me")
  async me(@CurrentUser() user: JwtPayload) {
    return this.usersService.getById(user.sub);
  }

  @Roles(Role.ADMIN)
  @Get("admin/audit")
  async listAuditLogs(@Query("page") page?: string, @Query("pageSize") pageSize?: string) {
    return this.usersService.listAdminAuditLogs({
      page: Number(page ?? 1),
      pageSize: Number(pageSize ?? 20)
    });
  }

  @Roles(Role.ADMIN)
  @Get("families")
  async listFamilies(
    @Query("query") query?: string,
    @Query("status") status?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
    @Query("sortBy") sortBy?: string,
    @Query("sortOrder") sortOrder?: string
  ) {
    return this.usersService.listFamilies({
      query,
      status,
      page: Number(page ?? 1),
      pageSize: Number(pageSize ?? 10),
      sortBy,
      sortOrder
    });
  }

  @Roles(Role.ADMIN)
  @Patch("status/bulk")
  async bulkUpdateStatus(@CurrentUser() user: JwtPayload, @Body() body: BulkUpdateUserStatusDto) {
    return this.usersService.bulkUpdateStatus(body.userIds, body.status, user.sub);
  }

  @Roles(Role.ADMIN)
  @Patch(":userId/status")
  async updateStatus(@CurrentUser() user: JwtPayload, @Param("userId") userId: string, @Body() body: UpdateUserStatusDto) {
    return this.usersService.updateStatus(userId, body.status, user.sub);
  }

  @Roles(Role.ADMIN)
  @Patch(":userId/role")
  async updateRole(@CurrentUser() user: JwtPayload, @Param("userId") userId: string, @Body() body: UpdateUserRoleDto) {
    return this.usersService.updateRole(userId, body.role, user.sub);
  }
}
