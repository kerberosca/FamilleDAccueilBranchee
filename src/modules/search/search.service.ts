import { Injectable } from "@nestjs/common";
import { ResourceOnboardingState, ResourcePublishStatus, ResourceVerificationStatus, Role } from "@prisma/client";
import { JwtPayload } from "../../common/types/jwt-payload.type";
import { PrismaService } from "../../prisma/prisma.service";
import { SubscriptionAccessService } from "../billing/subscription-access.service";
import { SearchResourcesDto } from "./dto/search-resources.dto";

const PREMIUM_PAGE_SIZE = 10;
const PREVIEW_LIMIT = 3;

@Injectable()
export class SearchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptionAccessService: SubscriptionAccessService
  ) {}

  async searchResources(query: SearchResourcesDto, user?: JwtPayload) {
    const normalizedPostalCode = normalizePostalCode(query.postalCode);
    const prefix = normalizedPostalCode.slice(0, 3);
    const tags = splitTags(query.tags);
    const page = query.page ?? 1;

    const where = {
      publishStatus: ResourcePublishStatus.PUBLISHED,
      verificationStatus: ResourceVerificationStatus.VERIFIED,
      onboardingState: { in: [ResourceOnboardingState.VERIFIED, ResourceOnboardingState.PUBLISHED] },
      OR: [{ postalCode: normalizedPostalCode }, { postalCode: { startsWith: prefix } }],
      ...(tags.length > 0 ? { skillsTags: { hasSome: tags } } : {})
    };

    const totalFound = await this.prisma.resourceProfile.count({ where });
    const premium = await this.isPremiumFamily(user);
    const take = premium ? PREMIUM_PAGE_SIZE : PREVIEW_LIMIT;
    const skip = premium ? (page - 1) * PREMIUM_PAGE_SIZE : 0;

    const resources = await this.prisma.resourceProfile.findMany({
      where,
      orderBy: [{ averageRating: "desc" }, { createdAt: "desc" }],
      skip,
      take
    });

    return {
      totalFound,
      page: premium ? page : 1,
      pageSize: take,
      limitedPreview: !premium,
      matchingStrategy: "MVP postal exact or first-3-prefix match. Upgrade later to geospatial.",
      results: resources.map((resource) =>
        premium
          ? {
              id: resource.id,
              displayName: resource.displayName,
              city: resource.city,
              region: resource.region,
              postalCode: resource.postalCode,
              skillsTags: resource.skillsTags,
              averageRating: resource.averageRating,
              hourlyRate: resource.hourlyRate,
              bio: resource.bio,
              contactEmail: resource.contactEmail,
              contactPhone: resource.contactPhone
            }
          : {
              id: resource.id,
              displayName: resource.displayName,
              city: resource.city,
              region: resource.region,
              skillsTags: resource.skillsTags,
              averageRating: resource.averageRating,
              hourlyRate: resource.hourlyRate
            }
      )
    };
  }

  private async isPremiumFamily(user?: JwtPayload): Promise<boolean> {
    if (!user || user.role !== Role.FAMILY) {
      return false;
    }
    return this.subscriptionAccessService.hasActiveFamilySubscription(user.sub);
  }
}

function splitTags(tags?: string): string[] {
  if (!tags) {
    return [];
  }
  return tags
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function normalizePostalCode(value: string): string {
  return value.replace(/\s+/g, "").toUpperCase();
}
