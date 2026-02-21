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
import { randomBytes } from "crypto";
import { EmailService } from "../email/email.service";
import { MaintenanceService } from "../maintenance/maintenance.service";
import { PrismaService } from "../../prisma/prisma.service";
import { RegisterDto } from "./dto/register.dto";

const PASSWORD_RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 h

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
    private readonly emailService: EmailService,
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
    const normalizedEmail = email.toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (!user || user.status !== UserStatus.ACTIVE) {
      return { message: "Si cet email est connu, un lien a été envoyé." };
    }
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MS);
    await this.prisma.passwordResetToken.create({
      data: { userId: user.id, token, expiresAt }
    });
    const frontendUrl = this.configService.get<string>("APP_FRONTEND_URL", "http://localhost:5173");
    const resetUrl = `${frontendUrl.replace(/\/$/, "")}/reset-password?token=${token}`;

    const html = `
      <p>Bonjour,</p>
      <p>Une réinitialisation de mot de passe a été demandée pour ce compte. Cliquez sur le lien ci-dessous pour définir un nouveau mot de passe :</p>
      <p><a href="${resetUrl}">Réinitialiser mon mot de passe</a></p>
      <p>Ce lien est valable 1 heure.</p>
      <p>Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet email.</p>
    `.trim();

    this.logger.log(`Envoi email reset vers ${normalizedEmail}...`);
    const result = await this.emailService.send({
      to: normalizedEmail,
      subject: "Réinitialisation de votre mot de passe",
      html
    });
    if (!result.ok) {
      this.logger.warn(`Envoi email reset échoué pour ${normalizedEmail}: ${result.error}`);
    } else {
      this.logger.log(`Email reset traité pour ${normalizedEmail} (ok=${result.ok}).`);
    }
    return { message: "Si cet email est connu, un lien a été envoyé." };
  }

  async resetPassword(token: string, newPassword: string) {
    const record = await this.prisma.passwordResetToken.findUnique({
      where: { token },
      include: { user: true }
    });
    if (!record || record.expiresAt < new Date()) {
      throw new BadRequestException("Lien invalide ou expiré.");
    }
    const passwordHash = await argon2.hash(newPassword);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash }
      }),
      this.prisma.passwordResetToken.deleteMany({ where: { userId: record.userId } })
    ]);
    return { success: true, message: "Mot de passe mis à jour." };
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
