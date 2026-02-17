import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Role } from "@prisma/client";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { JwtPayload } from "../../common/types/jwt-payload.type";
import { CreateConversationDto } from "./dto/create-conversation.dto";
import { SendMessageDto } from "./dto/send-message.dto";
import { MessagingService } from "./messaging.service";

@ApiTags("messaging")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.FAMILY, Role.RESOURCE)
@Controller({ path: "messaging", version: "1" })
export class MessagingController {
  constructor(private readonly messagingService: MessagingService) {}

  @Post("conversations")
  async createConversation(@CurrentUser() user: JwtPayload, @Body() dto: CreateConversationDto) {
    return this.messagingService.createConversation(user, dto);
  }

  @Get("conversations")
  async listConversations(@CurrentUser() user: JwtPayload) {
    return this.messagingService.listConversations(user);
  }

  @Get("conversations/:conversationId")
  async getConversation(@CurrentUser() user: JwtPayload, @Param("conversationId") conversationId: string) {
    return this.messagingService.getConversationById(user, conversationId);
  }

  @Post("conversations/:conversationId/messages")
  async sendMessage(
    @CurrentUser() user: JwtPayload,
    @Param("conversationId") conversationId: string,
    @Body() dto: SendMessageDto
  ) {
    return this.messagingService.sendMessage(user, conversationId, dto);
  }
}
