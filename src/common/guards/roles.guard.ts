import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Role, UserStatus } from "@prisma/client";
import { ROLES_KEY } from "../decorators/roles.decorator";
import { JwtPayload } from "../types/jwt-payload.type";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass()
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as JwtPayload | undefined;
    if (!user) {
      throw new ForbiddenException("Accès refusé.");
    }
    if (user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException("Votre compte est désactivé.");
    }
    if (!requiredRoles.includes(user.role)) {
      throw new ForbiddenException("Vous n'avez pas les droits requis pour effectuer cette action.");
    }
    return true;
  }
}
