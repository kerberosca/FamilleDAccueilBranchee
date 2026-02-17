import { CanActivate, ExecutionContext, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class DevOnlyGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(_context: ExecutionContext): boolean {
    const nodeEnv = this.configService.get<string>("NODE_ENV", "development");
    const devBypass = this.configService.get<string>("DEV_BYPASS_AUTH", "false");
    const enabled = nodeEnv !== "production" && devBypass === "true";
    if (!enabled) {
      throw new NotFoundException();
    }
    return true;
  }
}
