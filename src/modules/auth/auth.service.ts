import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import {
  ResourceOnboardingState,
  ResourcePublishStatus,
  ResourceVerificationStatus,
  Role,
  User,
  UserStatus
} from "@prisma/client";
import * as argon2 from "argon2";
import { MaintenanceService } from "../maintenance/maintenance.service";
import { PrismaService } from "../../prisma/prisma.service";
import { RegisterDto } from "./dto/register.dto";

type TokenPair = {
  accessToken: string;
  refreshToken: string;
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly maintenanceService: MaintenanceService
  ) {}

  async register(input: RegisterDto) {
    if (input.role === Role.ADMIN) {
      throw new BadRequestException("ADMIN registration is disabled");
    }
    const existing = await this.prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
    if (existing) {
      throw new ConflictException("Email already in use");
    }

    const passwordHash = await argon2.hash(input.password);
    const created = await this.prisma.user.create({
      data: {
        email: input.email.toLowerCase(),
        passwordHash,
        role: input.role,
        status: UserStatus.ACTIVE,
        familyProfile:
          input.role === Role.FAMILY
            ? {
                create: {
                  displayName: input.displayName,
                  postalCode: normalizePostalCode(input.postalCode),
                  city: input.city,
                  region: input.region,
                  bio: input.bio,
                  needsTags: input.tags ?? []
                }
              }
            : undefined,
        resourceProfile:
          input.role === Role.RESOURCE
            ? {
                create: {
                  displayName: input.displayName,
                  postalCode: normalizePostalCode(input.postalCode),
                  city: input.city,
                  region: input.region,
                  bio: input.bio,
                  skillsTags: input.tags ?? [],
                  onboardingState: ResourceOnboardingState.PENDING_PAYMENT,
                  verificationStatus: ResourceVerificationStatus.DRAFT,
                  publishStatus: ResourcePublishStatus.HIDDEN
                }
              }
            : undefined
      }
    });

    const tokens = await this.generateAndPersistTokens(created);
    return {
      user: sanitizeUser(created),
      ...tokens,
      nextStepForResource:
        created.role === Role.RESOURCE ? "Create Stripe checkout via POST /api/v1/billing/resource/checkout-session" : null
    };
  }

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user) {
      throw new UnauthorizedException("Email ou mot de passe incorrect");
    }
    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException("Compte désactivé. Contactez l'administrateur.");
    }
    const ok = await argon2.verify(user.passwordHash, password);
    if (!ok) {
      throw new UnauthorizedException("Email ou mot de passe incorrect");
    }
    const maintenanceActive = await this.maintenanceService.isActive();
    if (maintenanceActive && user.role !== Role.ADMIN) {
      throw new ServiceUnavailableException("Connexion impossible pendant la maintenance.");
    }
    const tokens = await this.generateAndPersistTokens(user);
    return { user: sanitizeUser(user), ...tokens };
  }

  async refresh(userId: string, refreshToken: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.refreshTokenHash) {
      throw new UnauthorizedException("Invalid refresh token");
    }
    const tokenValid = await argon2.verify(user.refreshTokenHash, refreshToken);
    if (!tokenValid) {
      throw new UnauthorizedException("Invalid refresh token");
    }
    const maintenanceActive = await this.maintenanceService.isActive();
    if (maintenanceActive && user.role !== Role.ADMIN) {
      throw new ServiceUnavailableException("Connexion impossible pendant la maintenance.");
    }
    const tokens = await this.generateAndPersistTokens(user);
    return { user: sanitizeUser(user), ...tokens };
  }

  async refreshWithToken(refreshToken: string) {
    const payload = await this.jwtService.verifyAsync<{ sub: string }>(refreshToken, {
      secret: this.configService.getOrThrow<string>("JWT_REFRESH_SECRET")
    });
    return this.refresh(payload.sub, refreshToken);
  }

  async issueTokensForUser(userId: string): Promise<TokenPair> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException("User not found");
    }
    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException("Account disabled");
    }
    return this.generateAndPersistTokens(user);
  }

  async logout(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash: null }
    });
    return { success: true };
  }

  async requestPasswordReset(email: string) {
    this.logger.log(`Password reset requested for: ${email}`);
    return { success: true };
  }

  async verifyEmail(token: string) {
    this.logger.log(`Email verification token received: ${token}`);
    return { success: true };
  }

  private async generateAndPersistTokens(user: User): Promise<TokenPair> {
    const payload = {
      sub: user.id,
      role: user.role,
      status: user.status,
      email: user.email
    };
    const accessOptions = {
      secret: this.configService.getOrThrow<string>("JWT_ACCESS_SECRET"),
      expiresIn: this.configService.get("JWT_ACCESS_EXPIRES_IN", "15m")
    };
    const refreshOptions = {
      secret: this.configService.getOrThrow<string>("JWT_REFRESH_SECRET"),
      expiresIn: this.configService.get("JWT_REFRESH_EXPIRES_IN", "30d")
    };
    const accessToken = await this.jwtService.signAsync(payload, accessOptions as Parameters<JwtService["signAsync"]>[1]);
    const refreshToken = await this.jwtService.signAsync(payload, refreshOptions as Parameters<JwtService["signAsync"]>[1]);
    const refreshTokenHash = await argon2.hash(refreshToken);
    await this.prisma.user.update({ where: { id: user.id }, data: { refreshTokenHash } });
    return { accessToken, refreshToken };
  }
}

function sanitizeUser(user: User) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

function normalizePostalCode(postalCode: string): string {
  return postalCode.replace(/\s+/g, "").toUpperCase();
}
