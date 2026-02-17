import { Injectable, NotFoundException } from "@nestjs/common";
import { Role, UserStatus } from "@prisma/client";
import { AuthService } from "../auth/auth.service";
import { PrismaService } from "../../prisma/prisma.service";
import { DevLoginAsRole } from "./dto/dev-login-as.dto";

const DEV_ROLE_EMAIL: Record<DevLoginAsRole, string> = {
  [DevLoginAsRole.ADMIN]: "admin@local.test",
  [DevLoginAsRole.FAMILLE]: "famille@local.test",
  [DevLoginAsRole.RESSOURCE]: "ressource@local.test"
};

const DEV_ROLE_TO_REAL_ROLE: Record<DevLoginAsRole, Role> = {
  [DevLoginAsRole.ADMIN]: Role.ADMIN,
  [DevLoginAsRole.FAMILLE]: Role.FAMILY,
  [DevLoginAsRole.RESSOURCE]: Role.RESOURCE
};

@Injectable()
export class DevService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService
  ) {}

  async loginAs(role: DevLoginAsRole) {
    const email = DEV_ROLE_EMAIL[role];
    const expectedRole = DEV_ROLE_TO_REAL_ROLE[role];
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        role: true,
        status: true
      }
    });
    if (!user || user.role !== expectedRole) {
      throw new NotFoundException(`Seed user not found for role ${role}`);
    }
    if (user.status !== UserStatus.ACTIVE) {
      throw new NotFoundException(`Seed user for role ${role} is not active`);
    }

    const tokens = await this.authService.issueTokensForUser(user.id);
    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role
      },
      ...tokens
    };
  }
}
