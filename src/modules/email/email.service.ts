import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Resend } from "resend";

export type SendMailOptions = {
  to: string;
  subject: string;
  html: string;
  /** Optionnel : expéditeur (sinon EMAIL_FROM) */
  from?: string;
};

export type SendMailResult = {
  ok: boolean;
  error?: string;
  messageId?: string;
  delivered: boolean;
};

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly resend: Resend | null = null;
  private readonly from: string;
  private readonly deliveryMode: "live" | "log" | "allowlist";
  private readonly allowlist: Set<string>;

  constructor(private readonly configService: ConfigService) {
    const apiKey = (this.configService.get<string>("RESEND_API_KEY", "") ?? "").trim();
    this.from =
      (this.configService.get<string>("EMAIL_FROM", "") ?? "").trim() ||
      "FAB <onboarding@resend.dev>";
    const configuredMode = (this.configService.get<string>("EMAIL_DELIVERY_MODE", "") ?? "").trim().toLowerCase();
    this.deliveryMode =
      configuredMode === "live" || configuredMode === "allowlist" || configuredMode === "log"
        ? configuredMode
        : this.configService.get<string>("NODE_ENV") === "production"
          ? "live"
          : "log";
    this.allowlist = new Set(
      (this.configService.get<string>("EMAIL_ALLOWLIST", "") ?? "")
        .split(",")
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean)
    );
    if (apiKey) {
      this.resend = new Resend(apiKey);
      this.logger.log(`Resend configuré : mode courriel ${this.deliveryMode}.`);
    } else {
      this.logger.warn(
        "RESEND_API_KEY non configuré : les emails ne seront pas envoyés (log uniquement)."
      );
    }
  }

  /**
   * Envoie un email. Si Resend n'est pas configuré, log le contenu et retourne sans erreur.
   */
  async send(options: SendMailOptions): Promise<SendMailResult> {
    const { to, subject, html, from } = options;
    const fromAddress = from ?? this.from;

    const normalizedTo = to.trim().toLowerCase();
    const blockedByMode =
      this.deliveryMode === "log" ||
      (this.deliveryMode === "allowlist" && !this.allowlist.has(normalizedTo));
    if (!this.resend || blockedByMode) {
      const reason = !this.resend ? "pas de clé" : `mode ${this.deliveryMode}`;
      this.logger.log(`[Email simulé - ${reason}] to=${to} subject=${subject}`);
      this.logger.debug(html);
      return { ok: true, delivered: false };
    }

    try {
      const { data, error } = await this.resend.emails.send({
        from: fromAddress,
        to: [to],
        subject,
        html
      });
      if (error) {
        this.logger.warn(`Envoi email échoué: ${error.message} (to=${to})`);
        return { ok: false, error: error.message, delivered: false };
      }
      this.logger.log(`Email envoyé: ${data?.id} -> ${to}`);
      return { ok: true, messageId: data?.id, delivered: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Envoi email exception: ${message} (to=${to})`);
      return { ok: false, error: message, delivered: false };
    }
  }
}
