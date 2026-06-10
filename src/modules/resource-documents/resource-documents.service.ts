import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  StreamableFile
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ResourceDocument, ResourceDocumentType, Role } from "@prisma/client";
import { createReadStream, promises as fs } from "fs";
import { extname, join, resolve } from "path";
import { randomBytes } from "crypto";
import { JwtPayload } from "../../common/types/jwt-payload.type";
import { PrismaService } from "../../prisma/prisma.service";
import { UsersService } from "../users/users.service";

const ACCEPTED_TYPES: Record<string, { extension: string; mimeTypes: string[] }> = {
  ".pdf": { extension: "pdf", mimeTypes: ["application/pdf"] },
  ".doc": { extension: "doc", mimeTypes: ["application/msword"] },
  ".docx": {
    extension: "docx",
    mimeTypes: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"]
  },
  ".jpg": { extension: "jpg", mimeTypes: ["image/jpeg"] },
  ".jpeg": { extension: "jpeg", mimeTypes: ["image/jpeg"] },
  ".png": { extension: "png", mimeTypes: ["image/png"] }
};

const REQUIRED_BASE_TYPES = [ResourceDocumentType.BACKGROUND_CHECK] as const;
const UPLOADABLE_DOCUMENT_TYPES = [ResourceDocumentType.BACKGROUND_CHECK, ResourceDocumentType.RCR_PROOF] as const;

type UploadedFile = {
  originalname?: string;
  mimetype?: string;
  size?: number;
  buffer?: Buffer;
};

@Injectable()
export class ResourceDocumentsService {
  private readonly storageDir: string;
  private readonly maxBytes: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly usersService: UsersService
  ) {
    this.storageDir = resolve(
      this.configService.get<string>("RESOURCE_DOCUMENTS_DIR", "/app/private/uploads/resource-documents")
    );
    const maxMb = Number(this.configService.get<string>("RESOURCE_DOCUMENT_MAX_MB", "10"));
    this.maxBytes = Math.max(1, Number.isFinite(maxMb) ? maxMb : 10) * 1024 * 1024;
  }

  async listMine(user: JwtPayload) {
    const profile = await this.getResourceProfileForUser(user.sub);
    const documents = await this.listActiveDocuments(profile.id);
    return {
      documents: documents.map(toDocumentDto),
      requirements: this.buildRequirements(documents, profile.allyRegistration)
    };
  }

  async listForAdmin(resourceId: string) {
    const profile = await this.prisma.resourceProfile.findUnique({ where: { id: resourceId } });
    if (!profile) {
      throw new NotFoundException("Profil allie introuvable.");
    }
    const documents = await this.listActiveDocuments(resourceId);
    return {
      documents: documents.map(toDocumentDto),
      requirements: this.buildRequirements(documents, profile.allyRegistration)
    };
  }

  async uploadMine(user: JwtPayload, type: ResourceDocumentType, file: UploadedFile | undefined) {
    if (!UPLOADABLE_DOCUMENT_TYPES.includes(type as (typeof UPLOADABLE_DOCUMENT_TYPES)[number])) {
      throw new BadRequestException("Type de document invalide.");
    }
    if (!file?.buffer || !file.originalname || !file.mimetype || !file.size) {
      throw new BadRequestException("Fichier manquant.");
    }
    const profile = await this.getResourceProfileForUser(user.sub);
    const validated = this.validateFile(file);
    await fs.mkdir(this.storageDir, { recursive: true });
    const storedName = `${profile.id}-${type.toLowerCase()}-${randomBytes(16).toString("hex")}.${validated.extension}`;
    const absolutePath = this.resolveStoredPath(storedName);
    const oldDocuments = await this.prisma.resourceDocument.findMany({
      where: { resourceProfileId: profile.id, type, deletedAt: null }
    });

    await fs.writeFile(absolutePath, file.buffer, { flag: "wx" });
    try {
      await this.prisma.$transaction([
        this.prisma.resourceDocument.updateMany({
          where: { resourceProfileId: profile.id, type, deletedAt: null },
          data: { deletedAt: new Date() }
        }),
        this.prisma.resourceDocument.create({
          data: {
            resourceProfileId: profile.id,
            type,
            originalName: sanitizeOriginalName(file.originalname),
            storedName,
            mimeType: validated.mimeType,
            sizeBytes: file.size
          }
        })
      ]);
    } catch (error) {
      await fs.unlink(absolutePath).catch(() => undefined);
      throw error;
    }
    await Promise.all(oldDocuments.map((document) => fs.unlink(this.resolveStoredPath(document.storedName)).catch(() => undefined)));

    return this.listMine(user);
  }

  async deleteDocument(user: JwtPayload, documentId: string) {
    const document = await this.prisma.resourceDocument.findUnique({
      where: { id: documentId },
      include: { resourceProfile: true }
    });
    if (!document || document.deletedAt) {
      throw new NotFoundException("Document introuvable.");
    }
    const isOwner = user.role === Role.RESOURCE && document.resourceProfile.userId === user.sub;
    const isAdmin = user.role === Role.ADMIN;
    if (!isOwner && !isAdmin) {
      throw new ForbiddenException("Acces refuse.");
    }

    await this.prisma.resourceDocument.update({
      where: { id: documentId },
      data: { deletedAt: new Date() }
    });
    await fs.unlink(this.resolveStoredPath(document.storedName)).catch(() => undefined);
    if (isAdmin) {
      await this.usersService.logAdminAction(user.sub, "RESOURCE_DOCUMENT_DELETED", "RESOURCE_DOCUMENT", document.id, {
        resourceProfileId: document.resourceProfileId,
        type: document.type,
        originalName: document.originalName
      });
    }
    return { success: true };
  }

  async deleteFilesForResourceProfile(resourceProfileId: string) {
    const documents = await this.prisma.resourceDocument.findMany({
      where: { resourceProfileId, deletedAt: null }
    });
    await Promise.all(documents.map((document) => fs.unlink(this.resolveStoredPath(document.storedName)).catch(() => undefined)));
    await this.prisma.resourceDocument.updateMany({
      where: { resourceProfileId, deletedAt: null },
      data: { deletedAt: new Date() }
    });
  }

  async downloadDocument(user: JwtPayload, documentId: string) {
    const document = await this.prisma.resourceDocument.findUnique({
      where: { id: documentId },
      include: { resourceProfile: true }
    });
    if (!document || document.deletedAt) {
      throw new NotFoundException("Document introuvable.");
    }
    const isOwner = user.role === Role.RESOURCE && document.resourceProfile.userId === user.sub;
    const isAdmin = user.role === Role.ADMIN;
    if (!isOwner && !isAdmin) {
      throw new ForbiddenException("Acces refuse.");
    }
    const path = this.resolveStoredPath(document.storedName);
    await fs.access(path).catch(() => {
      throw new NotFoundException("Fichier introuvable sur le serveur.");
    });
    if (isAdmin) {
      await this.usersService.logAdminAction(user.sub, "RESOURCE_DOCUMENT_DOWNLOADED", "RESOURCE_DOCUMENT", document.id, {
        resourceProfileId: document.resourceProfileId,
        type: document.type,
        originalName: document.originalName
      });
    }
    return {
      file: new StreamableFile(createReadStream(path)),
      document
    };
  }

  async assertResourceDocumentsComplete(resourceIds: string[]) {
    const resources = await this.prisma.resourceProfile.findMany({
      where: { id: { in: resourceIds } },
      include: { documents: { where: { deletedAt: null } } }
    });
    const incomplete = resources.filter((resource) => !this.buildRequirements(resource.documents, resource.allyRegistration).complete);
    if (incomplete.length > 0) {
      throw new BadRequestException(
        `Documents requis manquants pour ${incomplete.length} profil(s) allie(s).`
      );
    }
  }

  buildRequirements(documents: Pick<ResourceDocument, "type">[], allyRegistration: unknown) {
    const required: ResourceDocumentType[] = [...REQUIRED_BASE_TYPES];
    if (hasValidRcr(allyRegistration)) {
      required.push(ResourceDocumentType.RCR_PROOF);
    }
    const present = new Set(documents.map((document) => document.type));
    const missing = required.filter((type) => !present.has(type));
    return { required, missing, complete: missing.length === 0 };
  }

  private async getResourceProfileForUser(userId: string) {
    const profile = await this.prisma.resourceProfile.findUnique({ where: { userId } });
    if (!profile) {
      throw new NotFoundException("Profil allie introuvable.");
    }
    return profile;
  }

  private async listActiveDocuments(resourceProfileId: string) {
    return this.prisma.resourceDocument.findMany({
      where: { resourceProfileId, deletedAt: null },
      orderBy: { uploadedAt: "desc" }
    });
  }

  private validateFile(file: UploadedFile) {
    if (!file.size || file.size > this.maxBytes) {
      throw new BadRequestException(`Fichier trop volumineux. Maximum ${Math.round(this.maxBytes / 1024 / 1024)} Mo.`);
    }
    const extension = extname(file.originalname ?? "").toLowerCase();
    const accepted = ACCEPTED_TYPES[extension];
    if (!accepted || !file.mimetype || !accepted.mimeTypes.includes(file.mimetype)) {
      throw new BadRequestException("Type de fichier refuse. Formats acceptes : PDF, DOC, DOCX, JPG, PNG.");
    }
    return { extension: accepted.extension, mimeType: file.mimetype };
  }

  private resolveStoredPath(storedName: string) {
    const path = resolve(join(this.storageDir, storedName));
    if (!path.startsWith(`${this.storageDir}\\`) && !path.startsWith(`${this.storageDir}/`)) {
      throw new BadRequestException("Chemin de fichier invalide.");
    }
    return path;
  }
}

function toDocumentDto(document: ResourceDocument) {
  return {
    id: document.id,
    type: document.type,
    originalName: document.originalName,
    mimeType: document.mimeType,
    sizeBytes: document.sizeBytes,
    uploadedAt: document.uploadedAt
  };
}

function sanitizeOriginalName(value: string) {
  return value.replace(/[\\/:*?"<>|]/g, "_").slice(0, 180);
}

function hasValidRcr(allyRegistration: unknown) {
  if (!allyRegistration || typeof allyRegistration !== "object") {
    return false;
  }
  const section2 = (allyRegistration as { section2?: { rcrValid?: unknown } }).section2;
  return section2?.rcrValid === "yes";
}
