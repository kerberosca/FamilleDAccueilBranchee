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
      OR: [{ postalCode: normalizedPostalCode }, { postalCode: { startsWith: prefix } }]
    };
    const premium = await this.hasFullSearchAccess(user);
    const take = premium ? PREMIUM_PAGE_SIZE : PREVIEW_LIMIT;
    const skip = premium ? (page - 1) * PREMIUM_PAGE_SIZE : 0;

    const allPostalMatches = await this.prisma.resourceProfile.findMany({
      where,
      orderBy: [{ averageRating: "desc" }, { createdAt: "desc" }]
    });
    const matchingResources =
      tags.length > 0
        ? allPostalMatches.filter((resource) => hasSomeNormalizedTag(resource.skillsTags, tags))
        : allPostalMatches;
    const totalFound = matchingResources.length;
    const resources = matchingResources.slice(skip, skip + take);

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
              averageRating: decimalToNumber(resource.averageRating),
              hourlyRate: decimalToNumber(resource.hourlyRate),
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
              averageRating: decimalToNumber(resource.averageRating),
              hourlyRate: decimalToNumber(resource.hourlyRate)
            }
      )
    };
  }

  /** Famille abonnée ou administrateur : résultats complets (contacts, pagination). */
  private async hasFullSearchAccess(user?: JwtPayload): Promise<boolean> {
    if (!user) {
      return false;
    }
    if (user.role === Role.ADMIN) {
      return true;
    }
    if (user.role !== Role.FAMILY) {
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

function hasSomeNormalizedTag(resourceTags: string[], searchedTags: string[]): boolean {
  const normalizedResourceTags = resourceTags.map(normalizeTag);
  return searchedTags.some((searchedTag) => {
    const normalizedSearchedTag = normalizeTag(searchedTag);
    return normalizedResourceTags.some((resourceTag) => resourceTag.includes(normalizedSearchedTag));
  });
}

function normalizeTag(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function normalizePostalCode(value: string): string {
  return value.replace(/\s+/g, "").toUpperCase();
}

function decimalToNumber(value: unknown): number | null {
  if (value == null) {
    return null;
  }
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (typeof value === "object" && "toNumber" in value && typeof value.toNumber === "function") {
    return value.toNumber();
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
