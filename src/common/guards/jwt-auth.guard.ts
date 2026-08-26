import { ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AuthGuard } from "@nestjs/passport";
import { UserStatus } from "@prisma/client";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";
import { JwtPayload } from "../types/jwt-payload.type";

@Injectable()
export class JwtAuthGuard extends AuthGuard("jwt") {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass()
    ]);
    if (isPublic) {
      return true;
    }
    return super.canActivate(context);
  }

  handleRequest<TUser = JwtPayload>(err: unknown, user: TUser) {
    if (err || !user) {
      throw new UnauthorizedException("Votre session est invalide ou a expiré.");
    }
    const payload = user as unknown as JwtPayload;
    if (payload.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException("Votre compte est désactivé.");
    }
    return user;
  }
}
