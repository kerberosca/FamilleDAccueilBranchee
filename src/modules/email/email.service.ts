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

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly resend: Resend | null = null;
  private readonly from: string;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>("RESEND_API_KEY", "");
    this.from =
      this.configService.get<string>("EMAIL_FROM", "") ||
      "FAB <onboarding@resend.dev>";
    if (apiKey) {
      this.resend = new Resend(apiKey);
    } else {
      this.logger.warn(
        "RESEND_API_KEY non configuré : les emails ne seront pas envoyés (log uniquement)."
      );
    }
  }

  /**
   * Envoie un email. Si Resend n'est pas configuré, log le contenu et retourne sans erreur.
   */
  async send(options: SendMailOptions): Promise<{ ok: boolean; error?: string }> {
    const { to, subject, html, from } = options;
    const fromAddress = from ?? this.from;

    if (!this.resend) {
      this.logger.log(`[Email non envoyé - pas de clé] to=${to} subject=${subject}`);
      return { ok: true };
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
        return { ok: false, error: error.message };
      }
      this.logger.log(`Email envoyé: ${data?.id} -> ${to}`);
      return { ok: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Envoi email exception: ${message} (to=${to})`);
      return { ok: false, error: message };
    }
  }
}
