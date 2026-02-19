import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, ResourceOnboardingState, ResourcePublishStatus, ResourceVerificationStatus, Role } from "@prisma/client";
import { SubscriptionAccessService } from "../billing/subscription-access.service";
import { PrismaService } from "../../prisma/prisma.service";
import { JwtPayload } from "../../common/types/jwt-payload.type";
import { UsersService } from "../users/users.service";
import { BulkModerateResourceDto } from "./dto/bulk-moderate-resource.dto";
import { ModerateResourceDto } from "./dto/moderate-resource.dto";
import { UpdateFamilyProfileDto } from "./dto/update-family-profile.dto";
import { UpdateResourceProfileDto } from "./dto/update-resource-profile.dto";

@Injectable()
export class ProfilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptionAccessService: SubscriptionAccessService,
    private readonly usersService: UsersService
  ) {}

  async getMyProfile(user: JwtPayload) {
    if (user.role === Role.FAMILY) {
      const profile = await this.prisma.familyProfile.findUnique({ where: { userId: user.sub } });
      if (!profile) {
        throw new NotFoundException("Family profile not found");
      }
      return profile;
    }
    if (user.role === Role.RESOURCE) {
      const profile = await this.prisma.resourceProfile.findUnique({ where: { userId: user.sub } });
      if (!profile) {
        throw new NotFoundException("Resource profile not found");
      }
      return this.toResourcePrivateView(profile);
    }
    return { userRole: Role.ADMIN };
  }

  async updateMyFamilyProfile(user: JwtPayload, dto: UpdateFamilyProfileDto) {
    if (user.role !== Role.FAMILY) {
      throw new ForbiddenException("Only FAMILY can update this profile");
    }
    return this.prisma.familyProfile.update({
      where: { userId: user.sub },
      data: {
        ...dto,
        postalCode: dto.postalCode ? normalizePostalCode(dto.postalCode) : undefined,
        availability: toJson(dto.availability)
      }
    });
  }

  async updateMyResourceProfile(user: JwtPayload, dto: UpdateResourceProfileDto) {
    if (user.role !== Role.RESOURCE) {
      throw new ForbiddenException("Only RESOURCE can update this profile");
    }
    const updated = await this.prisma.resourceProfile.update({
      where: { userId: user.sub },
      data: {
        ...dto,
        postalCode: dto.postalCode ? normalizePostalCode(dto.postalCode) : undefined,
        hourlyRate: dto.hourlyRate ?? undefined,
        availability: toJson(dto.availability)
      }
    });
    return this.toResourcePrivateView(updated);
  }

  async moderateResource(resourceId: string, dto: ModerateResourceDto, actorUserId?: string) {
    const updated = await this.prisma.resourceProfile.update({
      where: { id: resourceId },
      data: {
        verificationStatus: dto.verificationStatus,
        publishStatus: dto.publishStatus,
        onboardingState: dto.onboardingState
      }
    });
    if (actorUserId) {
      await this.usersService.logAdminAction(actorUserId, "RESOURCE_MODERATED", "RESOURCE_PROFILE", resourceId, {
        ...dto
      });
    }
    return updated;
  }

  async bulkModerateResources(resourceIds: string[], dto: BulkModerateResourceDto, actorUserId: string) {
    const result = await this.prisma.resourceProfile.updateMany({
      where: { id: { in: resourceIds } },
      data: {
        verificationStatus: dto.verificationStatus,
        publishStatus: dto.publishStatus,
        onboardingState: dto.onboardingState
      }
    });
    await this.usersService.logAdminAction(actorUserId, "RESOURCE_BULK_MODERATED", "RESOURCE_PROFILE", "bulk", {
      resourceIds,
      verificationStatus: dto.verificationStatus,
      publishStatus: dto.publishStatus,
      onboardingState: dto.onboardingState
    });
    return { updatedCount: result.count };
  }

  async listResourcesForAdmin(filters: {
    query?: string;
    verificationStatus?: string;
    publishStatus?: string;
    onboardingState?: string;
    page?: number;
    pageSize?: number;
    sortBy?: string;
    sortOrder?: string;
  }) {
    const query = (filters.query ?? "").trim();
    const verificationStatus =
      filters.verificationStatus && isVerificationStatus(filters.verificationStatus)
        ? filters.verificationStatus
        : undefined;
    const publishStatus =
      filters.publishStatus && isPublishStatus(filters.publishStatus) ? filters.publishStatus : undefined;
    const onboardingState =
      filters.onboardingState && isOnboardingState(filters.onboardingState) ? filters.onboardingState : undefined;
    const page = clamp(filters.page, 1, 9999, 1);
    const pageSize = clamp(filters.pageSize, 1, 50, 10);
    const skip = (page - 1) * pageSize;
    const sortOrder = filters.sortOrder === "asc" ? "asc" : "desc";
    const orderBy = toResourceOrderBy(filters.sortBy, sortOrder);

    const where = {
      ...(verificationStatus ? { verificationStatus } : {}),
      ...(publishStatus ? { publishStatus } : {}),
      ...(onboardingState ? { onboardingState } : {}),
      ...(query
        ? {
            OR: [
              { displayName: { contains: query, mode: "insensitive" as const } },
              { city: { contains: query, mode: "insensitive" as const } },
              { postalCode: { startsWith: query.toUpperCase().replace(/\s+/g, "") } },
              { user: { email: { contains: query, mode: "insensitive" as const } } }
            ]
          }
        : {})
    };

    const [total, resources] = await this.prisma.$transaction([
      this.prisma.resourceProfile.count({ where }),
      this.prisma.resourceProfile.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              status: true,
              role: true,
              createdAt: true,
              updatedAt: true
            }
          }
        },
        orderBy,
        skip,
        take: pageSize
      })
    ]);

    return {
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      items: resources.map((resource) => ({
        id: resource.id,
        userId: resource.userId,
        displayName: resource.displayName,
        city: resource.city,
        region: resource.region,
        postalCode: resource.postalCode,
        skillsTags: resource.skillsTags,
        verificationStatus: resource.verificationStatus,
        publishStatus: resource.publishStatus,
        onboardingState: resource.onboardingState,
        contactEmail: resource.contactEmail,
        contactPhone: resource.contactPhone,
        updatedAt: resource.updatedAt,
        user: resource.user
      }))
    };
  }

  async getResourcePublicOrPremium(resourceId: string, currentUser?: JwtPayload) {
    const resource = await this.prisma.resourceProfile.findUnique({
      where: { id: resourceId },
      include: { user: true }
    });
    if (!resource) {
      throw new NotFoundException("Resource not found");
    }
    const premium = await this.canSeeSensitiveResourceInfo(currentUser);
    return premium ? this.toResourcePremiumView(resource) : this.toResourcePublicView(resource);
  }

  private async canSeeSensitiveResourceInfo(currentUser?: JwtPayload): Promise<boolean> {
    if (!currentUser || currentUser.role !== Role.FAMILY) {
      return false;
    }
    return this.subscriptionAccessService.hasActiveFamilySubscription(currentUser.sub);
  }

  private toResourcePublicView(resource: Prisma.ResourceProfileGetPayload<{ include: { user: true } }> | any) {
    return {
      id: resource.id,
      displayName: resource.displayName,
      city: resource.city,
      region: resource.region,
      postalCode: resource.postalCode,
      skillsTags: resource.skillsTags,
      hourlyRate: resource.hourlyRate,
      averageRating: resource.averageRating,
      bio: resource.bio,
      verificationStatus: resource.verificationStatus,
      publishStatus: resource.publishStatus
    };
  }

  private toResourcePremiumView(resource: Prisma.ResourceProfileGetPayload<{ include: { user: true } }> | any) {
    return {
      ...this.toResourcePublicView(resource),
      contactEmail: resource.contactEmail,
      contactPhone: resource.contactPhone
    };
  }

  private toResourcePrivateView(resource: Prisma.ResourceProfileGetPayload<{}> | any) {
    return {
      id: resource.id,
      userId: resource.userId,
      displayName: resource.displayName,
      postalCode: resource.postalCode,
      city: resource.city,
      region: resource.region,
      bio: resource.bio,
      skillsTags: resource.skillsTags,
      hourlyRate: resource.hourlyRate,
      availability: resource.availability,
      verificationStatus: resource.verificationStatus,
      publishStatus: resource.publishStatus,
      onboardingState: resource.onboardingState,
      contactEmail: resource.contactEmail,
      contactPhone: resource.contactPhone
    };
  }
}

function normalizePostalCode(postalCode: string): string {
  return postalCode.replace(/\s+/g, "").toUpperCase();
}

function toJson(input: unknown): Prisma.InputJsonValue | undefined {
  if (typeof input === "undefined") {
    return undefined;
  }
  if (typeof input === "string") {
    try {
      return JSON.parse(input) as Prisma.InputJsonValue;
    } catch {
      throw new ForbiddenException("Invalid availability JSON");
    }
  }
  return input as Prisma.InputJsonValue;
}

function isVerificationStatus(value: string): value is ResourceVerificationStatus {
  return Object.values(ResourceVerificationStatus).includes(value as ResourceVerificationStatus);
}

function isPublishStatus(value: string): value is ResourcePublishStatus {
  return Object.values(ResourcePublishStatus).includes(value as ResourcePublishStatus);
}

function isOnboardingState(value: string): value is ResourceOnboardingState {
  return Object.values(ResourceOnboardingState).includes(value as ResourceOnboardingState);
}

function clamp(value: number | undefined, min: number, max: number, fallback: number): number {
  if (!value || Number.isNaN(value)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, value));
}

function toResourceOrderBy(sortBy?: string, sortOrder: "asc" | "desc" = "desc") {
  if (sortBy === "displayName") {
    return [{ displayName: sortOrder }];
  }
  if (sortBy === "verificationStatus") {
    return [{ verificationStatus: sortOrder }, { updatedAt: "desc" as const }];
  }
  if (sortBy === "publishStatus") {
    return [{ publishStatus: sortOrder }, { updatedAt: "desc" as const }];
  }
  return [{ updatedAt: sortOrder }];
}
