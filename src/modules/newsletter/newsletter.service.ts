import { BadRequestException, ConflictException, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { CyberimpactService, NEWSLETTER_UNAVAILABLE } from "./cyberimpact.service";
import { SubscribeNewsletterDto } from "./newsletter.dto";

export const CONSENT_VERSION = "fab-infolettre-2026-10-12";
export const CONSENT_TEXT = "En cliquant sur « Je m’inscris », je consens à recevoir par courriel les nouvelles de FAB et les détails de son lancement, envoyés par Forméduc (Famille d’accueil branchée). Je peux me désabonner en tout temps grâce au lien dans chaque courriel.";
type FormPayload = { id: string; issuedAt: number; source: "site" | "congres"; binding: string; consentVersion: string };
type RequestContext = { ip: string; userAgent: string };

@Injectable()
export class NewsletterService {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly cyberimpact: CyberimpactService
  ) {}

  challenge(source: "site" | "congres", context: RequestContext) {
    this.ensureConfigured();
    const payload: FormPayload = { id: randomUUID(), issuedAt: Date.now(), source, binding: this.binding(context), consentVersion: CONSENT_VERSION };
    const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
    return { formToken: `${encoded}.${this.sign(encoded)}`, consentText: CONSENT_TEXT, consentVersion: CONSENT_VERSION };
  }

  async subscribe(dto: SubscribeNewsletterDto, context: RequestContext) {
    this.ensureConfigured();
    const payload = this.verifyToken(dto.formToken, dto.source, context);
    if (dto.website || !dto.consent) throw new BadRequestException("Le formulaire n’a pas pu être validé. Rechargez la page et réessayez.");

    let proof;
    try {
      // La preuve est durable AVANT l'ajout chez Cyberimpact, même si l'envoi échoue.
      proof = await this.prisma.newsletterConsent.create({ data: {
        requestId: payload.id, email: dto.email, firstName: dto.firstName, source: dto.source,
        consentVersion: CONSENT_VERSION, consentText: CONSENT_TEXT,
        ipAddress: context.ip.slice(0, 64), userAgent: context.userAgent.slice(0, 500)
      } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const previous = await this.prisma.newsletterConsent.findUnique({ where: { requestId: payload.id } });
        if (previous?.status === "SYNCED" && previous.email === dto.email && previous.source === dto.source) return { subscribed: true };
        throw new ConflictException("Cette demande a déjà été envoyée. Rechargez la page avant de réessayer.");
      }
      throw new ServiceUnavailableException(NEWSLETTER_UNAVAILABLE);
    }

    try {
      const memberId = await this.cyberimpact.subscribe(dto.email, dto.firstName, dto.source, proof.id);
      await this.prisma.newsletterConsent.update({ where: { id: proof.id }, data: {
        status: "SYNCED", providerMemberId: memberId, completedAt: new Date()
      } });
      return { subscribed: true };
    } catch (error) {
      // En cas d'erreur après l'ajout, un nouvel essai vérifie les groupes sans redéclencher le bienvenue.
      await this.prisma.newsletterConsent.update({ where: { id: proof.id }, data: { status: "FAILED" } }).catch(() => undefined);
      if (error instanceof BadRequestException || error instanceof ServiceUnavailableException) throw error;
      throw new ServiceUnavailableException(NEWSLETTER_UNAVAILABLE);
    }
  }

  private ensureConfigured() {
    if (this.config.get<string>("NEWSLETTER_ENABLED") !== "true" ||
      !this.config.get<string>("CYBERIMPACT_API_TOKEN") || !this.config.get<string>("NEWSLETTER_FORM_SECRET")) {
      throw new ServiceUnavailableException(NEWSLETTER_UNAVAILABLE);
    }
  }

  private sign(value: string) {
    return createHmac("sha256", this.config.getOrThrow<string>("NEWSLETTER_FORM_SECRET")).update(value).digest("base64url");
  }

  private binding(context: RequestContext) {
    return this.sign(`${context.ip}\n${context.userAgent}`);
  }

  private verifyToken(token: string, source: string, context: RequestContext): FormPayload {
    try {
      const parts = token.split(".");
      if (parts.length !== 2) throw new Error();
      const signature = Buffer.from(parts[1]);
      const expected = Buffer.from(this.sign(parts[0]));
      if (signature.length !== expected.length || !timingSafeEqual(signature, expected)) throw new Error();
      const payload = JSON.parse(Buffer.from(parts[0], "base64url").toString()) as FormPayload;
      const age = Date.now() - payload.issuedAt;
      if (!payload.id || !Number.isFinite(age) || age < 1000 || age > 30 * 60_000 ||
        payload.source !== source || payload.binding !== this.binding(context) || payload.consentVersion !== CONSENT_VERSION) throw new Error();
      return payload;
    } catch {
      throw new BadRequestException("Le formulaire a expiré ou n’a pas pu être validé. Réessayez.");
    }
  }
}
