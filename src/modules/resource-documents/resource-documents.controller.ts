import {
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { ResourceDocumentType, Role } from "@prisma/client";
import { Response } from "express";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { JwtPayload } from "../../common/types/jwt-payload.type";
import { ResourceDocumentsService } from "./resource-documents.service";

@ApiTags("resource-documents")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller({ path: "resource-documents", version: "1" })
export class ResourceDocumentsController {
  constructor(private readonly documentsService: ResourceDocumentsService) {}

  @UseGuards(RolesGuard)
  @Roles(Role.RESOURCE)
  @Get("me")
  async listMine(@CurrentUser() user: JwtPayload) {
    return this.documentsService.listMine(user);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.RESOURCE)
  @Post("me")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 10 * 1024 * 1024 } }))
  async uploadMine(
    @CurrentUser() user: JwtPayload,
    @Query("type") type: ResourceDocumentType,
    @UploadedFile() file: unknown
  ) {
    return this.documentsService.uploadMine(user, type, file as Parameters<ResourceDocumentsService["uploadMine"]>[2]);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Get("admin/resource/:resourceId")
  async listForAdmin(@Param("resourceId") resourceId: string) {
    return this.documentsService.listForAdmin(resourceId);
  }

  @Delete(":documentId")
  async deleteDocument(@CurrentUser() user: JwtPayload, @Param("documentId") documentId: string) {
    return this.documentsService.deleteDocument(user, documentId);
  }

  @Get(":documentId/download")
  @Header("X-Content-Type-Options", "nosniff")
  async downloadDocument(
    @CurrentUser() user: JwtPayload,
    @Param("documentId") documentId: string,
    @Res({ passthrough: true }) res: Response
  ) {
    const { file, document } = await this.documentsService.downloadDocument(user, documentId);
    res.setHeader("Content-Type", document.mimeType);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${encodeURIComponent(document.originalName)}"`
    );
    return file;
  }
}
