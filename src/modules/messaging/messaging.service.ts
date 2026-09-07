import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import {
  Prisma,
  ResourceOnboardingState,
  ResourcePublishStatus,
  ResourceVerificationStatus,
  Role,
  UserStatus
} from "@prisma/client";
import { JwtPayload } from "../../common/types/jwt-payload.type";
import { PrismaService } from "../../prisma/prisma.service";
import { SubscriptionAccessService } from "../billing/subscription-access.service";
import { CreateConversationDto } from "./dto/create-conversation.dto";
import { SendMessageDto } from "./dto/send-message.dto";

const participantViewSelect = {
  id: true,
  displayName: true
} as const;

const participantInternalSelect = {
  id: true,
  displayName: true,
  userId: true
} as const;

const conversationListSelect = {
  id: true,
  createdAt: true,
  updatedAt: true,
  family: { select: participantViewSelect },
  resource: { select: participantViewSelect },
  _count: { select: { messages: true } }
} satisfies Prisma.ConversationSelect;

const conversationDetailSelect = {
  id: true,
  createdAt: true,
  updatedAt: true,
  family: { select: participantInternalSelect },
  resource: { select: participantInternalSelect },
  messages: {
    select: {
      id: true,
      content: true,
      createdAt: true,
      senderUserId: true
    },
    orderBy: { createdAt: "asc" }
  }
} satisfies Prisma.ConversationSelect;

type ConversationListRecord = Prisma.ConversationGetPayload<{ select: typeof conversationListSelect }>;
type ConversationDetailRecord = Prisma.ConversationGetPayload<{ select: typeof conversationDetailSelect }>;

@Injectable()
export class MessagingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptionAccessService: SubscriptionAccessService
  ) {}

  async createConversation(currentUser: JwtPayload, dto: CreateConversationDto) {
    await this.assertCurrentMessagingUser(currentUser);
    if (currentUser.role !== Role.FAMILY) {
      throw new ForbiddenException("Seul un compte famille peut démarrer une conversation.");
    }
    const premium = await this.subscriptionAccessService.hasActiveFamilySubscription(currentUser.sub);
    if (!premium) {
      throw new ForbiddenException("Un abonnement famille actif est requis pour contacter un allié.");
    }

    const family = await this.prisma.familyProfile.findUnique({
      where: { userId: currentUser.sub },
      select: { id: true }
    });
    if (!family) {
      throw new NotFoundException("Profil de famille introuvable.");
    }
    const resource = await this.prisma.resourceProfile.findUnique({
      where: { id: dto.resourceProfileId },
      select: {
        id: true,
        publishStatus: true,
        verificationStatus: true,
        onboardingState: true
      }
    });
    if (!resource) {
      throw new NotFoundException("Allié introuvable.");
    }
    if (
      resource.publishStatus !== ResourcePublishStatus.PUBLISHED ||
      resource.verificationStatus !== ResourceVerificationStatus.VERIFIED ||
      (resource.onboardingState !== ResourceOnboardingState.VERIFIED &&
        resource.onboardingState !== ResourceOnboardingState.PUBLISHED)
    ) {
      throw new NotFoundException("Allié introuvable.");
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
      },
      select: { id: true }
    });

    await this.prisma.message.create({
      data: {
        conversationId: conversation.id,
        senderUserId: currentUser.sub,
        content: dto.initialMessage
      },
      select: { id: true }
    });

    return this.findAccessibleConversationDetail(currentUser, conversation.id);
  }

  async listConversations(currentUser: JwtPayload) {
    await this.assertCurrentMessagingUser(currentUser);
    const conversations = await this.prisma.conversation.findMany({
      where: this.buildParticipantWhere(currentUser),
      select: conversationListSelect,
      orderBy: { updatedAt: "desc" }
    });
    return conversations.map((conversation) => this.toConversationListView(conversation));
  }

  async sendMessage(currentUser: JwtPayload, conversationId: string, dto: SendMessageDto) {
    await this.assertCurrentMessagingUser(currentUser);
    if (currentUser.role === Role.ADMIN) {
      throw new ForbiddenException("Les comptes administrateur ont un accès en lecture seule aux conversations");
    }
    const conversation = await this.findAccessibleConversationDetail(currentUser, conversationId);
    if (currentUser.role === Role.FAMILY) {
      const premium = await this.subscriptionAccessService.hasActiveFamilySubscription(currentUser.sub);
      if (!premium) {
        throw new ForbiddenException("Votre abonnement famille a expiré.");
      }
    }
    await this.prisma.message.create({
      data: {
        conversationId: conversation.id,
        senderUserId: currentUser.sub,
        content: dto.content
      },
      select: { id: true }
    });
    return this.findAccessibleConversationDetail(currentUser, conversationId);
  }

  async getConversationById(currentUser: JwtPayload, conversationId: string) {
    await this.assertCurrentMessagingUser(currentUser);
    return this.findAccessibleConversationDetail(currentUser, conversationId);
  }

  private async findAccessibleConversationDetail(currentUser: JwtPayload, conversationId: string) {
    const conversation = await this.prisma.conversation.findFirst({
      where: {
        id: conversationId,
        ...this.buildParticipantWhere(currentUser)
      },
      select: conversationDetailSelect
    });
    if (!conversation) {
      throw new NotFoundException("Conversation introuvable.");
    }
    return this.toConversationDetailView(conversation);
  }

  private async assertCurrentMessagingUser(currentUser: JwtPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: currentUser.sub },
      select: { role: true, status: true }
    });
    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException("Votre compte est désactivé.");
    }
    if (user.role !== currentUser.role) {
      throw new ForbiddenException("Votre session ne correspond plus à votre compte.");
    }
  }

  private buildParticipantWhere(currentUser: JwtPayload): Prisma.ConversationWhereInput {
    if (currentUser.role === Role.ADMIN) {
      return {};
    }
    if (currentUser.role === Role.FAMILY) {
      return { family: { is: { userId: currentUser.sub } } };
    }
    if (currentUser.role === Role.RESOURCE) {
      return { resource: { is: { userId: currentUser.sub } } };
    }
    throw new ForbiddenException("Vous ne pouvez pas accéder aux conversations.");
  }

  private toConversationListView(conversation: ConversationListRecord) {
    return {
      id: conversation.id,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      family: this.toParticipantView(conversation.family),
      resource: this.toParticipantView(conversation.resource),
      messageCount: conversation._count.messages
    };
  }

  private toConversationDetailView(conversation: ConversationDetailRecord) {
    return {
      id: conversation.id,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      family: this.toParticipantView(conversation.family),
      resource: this.toParticipantView(conversation.resource),
      messages: conversation.messages.map((message) => ({
        id: message.id,
        content: message.content,
        createdAt: message.createdAt,
        senderRole: this.resolveSenderRole(message.senderUserId, conversation)
      }))
    };
  }

  private toParticipantView(participant: { id: string; displayName: string }) {
    return {
      id: participant.id,
      displayName: participant.displayName
    };
  }

  private resolveSenderRole(
    senderUserId: string,
    conversation: Pick<ConversationDetailRecord, "family" | "resource">
  ): "FAMILY" | "RESOURCE" {
    if (senderUserId === conversation.family.userId) {
      return Role.FAMILY;
    }
    if (senderUserId === conversation.resource.userId) {
      return Role.RESOURCE;
    }
    throw new ForbiddenException("L'auteur de ce message ne participe pas à la conversation.");
  }
}
