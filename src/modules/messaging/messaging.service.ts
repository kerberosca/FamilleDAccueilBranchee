import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { ResourceOnboardingState, ResourcePublishStatus, ResourceVerificationStatus, Role } from "@prisma/client";
import { JwtPayload } from "../../common/types/jwt-payload.type";
import { PrismaService } from "../../prisma/prisma.service";
import { SubscriptionAccessService } from "../billing/subscription-access.service";
import { CreateConversationDto } from "./dto/create-conversation.dto";
import { SendMessageDto } from "./dto/send-message.dto";

@Injectable()
export class MessagingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptionAccessService: SubscriptionAccessService
  ) {}

  async createConversation(currentUser: JwtPayload, dto: CreateConversationDto) {
    if (currentUser.role !== Role.FAMILY) {
      throw new ForbiddenException("Only FAMILY can initiate a conversation");
    }
    const premium = await this.subscriptionAccessService.hasActiveFamilySubscription(currentUser.sub);
    if (!premium) {
      throw new ForbiddenException("Family subscription is required to contact resources");
    }

    const family = await this.prisma.familyProfile.findUnique({ where: { userId: currentUser.sub } });
    if (!family) {
      throw new NotFoundException("Family profile not found");
    }
    const resource = await this.prisma.resourceProfile.findUnique({ where: { id: dto.resourceProfileId } });
    if (!resource) {
      throw new NotFoundException("Resource not found");
    }
    if (
      resource.publishStatus !== ResourcePublishStatus.PUBLISHED ||
      resource.verificationStatus !== ResourceVerificationStatus.VERIFIED ||
      (resource.onboardingState !== ResourceOnboardingState.VERIFIED &&
        resource.onboardingState !== ResourceOnboardingState.PUBLISHED)
    ) {
      throw new ForbiddenException("Resource is not available for contact");
    }

    const conversation = await this.prisma.conversation.upsert({
      where: {
        familyId_resourceId: {
          familyId: family.id,
          resourceId: resource.id
        }
      },
      update: {},
      create: {
        familyId: family.id,
        resourceId: resource.id
      }
    });

    await this.prisma.message.create({
      data: {
        conversationId: conversation.id,
        senderUserId: currentUser.sub,
        content: dto.initialMessage
      }
    });

    return this.getConversationById(currentUser, conversation.id);
  }

  async listConversations(currentUser: JwtPayload) {
    if (currentUser.role === Role.FAMILY) {
      const family = await this.prisma.familyProfile.findUnique({ where: { userId: currentUser.sub } });
      if (!family) {
        return [];
      }
      return this.prisma.conversation.findMany({
        where: { familyId: family.id },
        include: {
          resource: true,
          messages: { orderBy: { createdAt: "asc" }, take: 50 }
        },
        orderBy: { updatedAt: "desc" }
      });
    }
    if (currentUser.role === Role.RESOURCE) {
      const resource = await this.prisma.resourceProfile.findUnique({ where: { userId: currentUser.sub } });
      if (!resource) {
        return [];
      }
      return this.prisma.conversation.findMany({
        where: { resourceId: resource.id },
        include: {
          family: true,
          messages: { orderBy: { createdAt: "asc" }, take: 50 }
        },
        orderBy: { updatedAt: "desc" }
      });
    }
    return [];
  }

  async sendMessage(currentUser: JwtPayload, conversationId: string, dto: SendMessageDto) {
    const conversation = await this.getConversationById(currentUser, conversationId);
    if (currentUser.role === Role.FAMILY) {
      const premium = await this.subscriptionAccessService.hasActiveFamilySubscription(currentUser.sub);
      if (!premium) {
        throw new ForbiddenException("Family subscription expired");
      }
    }
    await this.prisma.message.create({
      data: {
        conversationId: conversation.id,
        senderUserId: currentUser.sub,
        content: dto.content
      }
    });
    return this.getConversationById(currentUser, conversationId);
  }

  async getConversationById(currentUser: JwtPayload, conversationId: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        family: true,
        resource: true,
        messages: { orderBy: { createdAt: "asc" } }
      }
    });
    if (!conversation) {
      throw new NotFoundException("Conversation not found");
    }

    const isFamilyOwner = conversation.family.userId === currentUser.sub;
    const isResourceOwner = conversation.resource.userId === currentUser.sub;
    if (!isFamilyOwner && !isResourceOwner) {
      throw new ForbiddenException("Not part of this conversation");
    }
    return conversation;
  }
}
