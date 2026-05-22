import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AllyType, BackgroundCheckStatus, ResourceOnboardingState, ResourcePublishStatus, ResourceVerificationStatus } from "@prisma/client";

export type AllyWebhookEvent = "ally.application.created" | "ally.application.updated" | "ally.application.moderated";

export type AllyWebhookPayload = {
  schemaVersion: "1.0";
  event: AllyWebhookEvent;
  occurredAt: string;
  resourceId: string;
  userId: string;
  displayName: string;
  email: string;
  phone: string | null;
  allyType: AllyType | null;
  city: string;
  region: string;
  postalCode: string;
  verificationStatus: ResourceVerificationStatus;
  publishStatus: ResourcePublishStatus;
  onboardingState: ResourceOnboardingState;
  backgroundCheckStatus: BackgroundCheckStatus;
};

type AllyWebhookResource = {
  id: string;
  userId: string;
  displayName: string;
  contactPhone: string | null;
  allyType: AllyType | null;
  city: string;
  region: string;
  postalCode: string;
  verificationStatus: ResourceVerificationStatus;
  publishStatus: ResourcePublishStatus;
  onboardingState: ResourceOnboardingState;
  backgroundCheckStatus: BackgroundCheckStatus;
  user: {
    email: string;
  };
};

@Injectable()
export class AllyWebhooksService {
  private readonly logger = new Logger(AllyWebhooksService.name);

  constructor(private readonly configService: ConfigService) {}

  async sendApplicationEvent(event: AllyWebhookEvent, resource: AllyWebhookResource) {
    const url = (this.configService.get<string>("N8N_ALLY_WEBHOOK_URL", "") ?? "").trim();
    const secret = (this.configService.get<string>("N8N_ALLY_WEBHOOK_SECRET", "") ?? "").trim();

    if (!url || !secret) {
      this.logger.debug(`Webhook n8n allié ignoré (${event}) : configuration absente.`);
      return;
    }

    const payload: AllyWebhookPayload = {
      schemaVersion: "1.0",
      event,
      occurredAt: new Date().toISOString(),
      resourceId: resource.id,
      userId: resource.userId,
      displayName: resource.displayName,
      email: resource.user.email,
      phone: resource.contactPhone ?? null,
      allyType: resource.allyType ?? null,
      city: resource.city,
      region: resource.region,
      postalCode: resource.postalCode,
      verificationStatus: resource.verificationStatus,
      publishStatus: resource.publishStatus,
      onboardingState: resource.onboardingState,
      backgroundCheckStatus: resource.backgroundCheckStatus
    };

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-FAB-Webhook-Secret": secret
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        this.logger.warn(`Webhook n8n allié ${event} refusé (${response.status}): ${body.slice(0, 500)}`);
        return;
      }

      this.logger.log(`Webhook n8n allié envoyé: ${event} (${resource.id})`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Webhook n8n allié ${event} échoué: ${message}`);
    }
  }
}
