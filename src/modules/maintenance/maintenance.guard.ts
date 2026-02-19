import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { Role } from "@prisma/client";
import { Request } from "express";
import { MaintenanceService } from "./maintenance.service";

const ALLOWED_PATH_PREFIXES = [
  "/v1/health",
  "/api/v1/health",
  "/v1/maintenance",
  "/api/v1/maintenance",
  "/v1/auth",
  "/api/v1/auth"
];

@Injectable()
export class MaintenanceGuard implements CanActivate {
  constructor(
    private readonly maintenanceService: MaintenanceService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const path = request.url?.split("?")[0] ?? request.path ?? "";

    const allowed = ALLOWED_PATH_PREFIXES.some((prefix) => path.endsWith(prefix) || path.includes(prefix));
    if (allowed) {
      return true;
    }

    const isActive = await this.maintenanceService.isActive();
    if (!isActive) {
      return true;
    }

    const token = this.getBearerToken(request);
    if (token) {
      try {
        const payload = await this.jwtService.verifyAsync<{ sub: string; role: Role }>(token, {
          secret: this.configService.getOrThrow<string>("JWT_ACCESS_SECRET")
        });
        if (payload?.role === Role.ADMIN) {
          return true;
        }
      } catch {
        // Token invalide ou expiré : on renvoie 503
      }
    }

    throw new ServiceUnavailableException({
      statusCode: 503,
      message: "Maintenance en cours",
      error: "Service Unavailable"
    });
  }

  private getBearerToken(request: Request): string | null {
    const auth = request.headers.authorization;
    if (!auth || typeof auth !== "string" || !auth.startsWith("Bearer ")) {
      return null;
    }
    return auth.slice(7).trim() || null;
  }
}
