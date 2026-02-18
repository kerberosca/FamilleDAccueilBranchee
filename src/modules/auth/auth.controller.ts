import { Body, Controller, HttpCode, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Throttle, ThrottlerGuard } from "@nestjs/throttler";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Public } from "../../common/decorators/public.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { JwtPayload } from "../../common/types/jwt-payload.type";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { RefreshDto } from "./dto/refresh.dto";
import { RegisterDto } from "./dto/register.dto";
import { RequestPasswordResetDto } from "./dto/request-password-reset.dto";
import { VerifyEmailDto } from "./dto/verify-email.dto";

@ApiTags("auth")
@Controller({ path: "auth", version: "1" })
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post("register")
  async register(@Body() body: RegisterDto) {
    return this.authService.register(body);
  }

  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("login")
  async login(@Body() body: LoginDto) {
    return this.authService.login(body.email, body.password);
  }

  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post("refresh")
  async refresh(@Body() body: RefreshDto) {
    return this.authService.refreshWithToken(body.refreshToken);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  @Post("logout")
  async logout(@CurrentUser() user: JwtPayload) {
    return this.authService.logout(user.sub);
  }

  @Public()
  @Post("verify-email")
  async verifyEmail(@Body() body: VerifyEmailDto) {
    return this.authService.verifyEmail(body.token);
  }

  @Public()
  @Post("request-password-reset")
  async requestPasswordReset(@Body() body: RequestPasswordResetDto) {
    return this.authService.requestPasswordReset(body.email);
  }
}
