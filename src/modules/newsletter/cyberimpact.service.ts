import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

const API_URL = "https://api.cyberimpact.com";
export const NEWSLETTER_UNAVAILABLE = "L’inscription est temporairement indisponible. Réessayez dans quelques minutes.";

@Injectable()
export class CyberimpactService {
  private readonly logger = new Logger(CyberimpactService.name);

  constructor(private readonly config: ConfigService) {}

  async subscribe(email: string, firstName: string, source: "site" | "congres", proofId: string) {
    const key = encodeURIComponent(email);
    const groups = [this.config.getOrThrow<string>("CYBERIMPACT_LAUNCH_GROUP_ID")];
    if (source === "congres") groups.push(this.config.getOrThrow<string>("CYBERIMPACT_CONGRESS_GROUP_ID"));

    await this.ensureSubscribedAddress(key);
    let member = await this.request("GET", `/members/${key}`, undefined, true);
    if (!member) {
      const response = await this.rawRequest("POST", "/members", {
        email, firstname: firstName, language: "fr_ca", groups: groups.join(","),
        note: `Inscription infolettre FAB (${source}). Preuve de consentement FAB : ${proofId}.`
      });
      if (response.ok) return this.memberId(await this.readJson(response));
      if (response.status !== 400 && response.status !== 409) this.unavailable(response.status);
      // Une inscription simultanée peut avoir créé le contact entre les deux requêtes.
      await this.ensureSubscribedAddress(key);
      member = await this.request("GET", `/members/${key}`, undefined, true);
      if (!member) this.unavailable(response.status);
    }

    const membership = await this.request("GET", `/members/${key}/groups?limit=10000`);
    const rows = Array.isArray(membership) ? membership : membership?.groups;
    if (!Array.isArray(rows)) this.unavailable();
    const current = new Set(rows.map((group: { id: number | string }) => String(group.id)));
    const missing = groups.filter(group => !current.has(group));
    if (missing.length) {
      await this.ensureSubscribedAddress(key);
      // Ajouter uniquement les groupes manquants; conserver prénom et autres groupes.
      await this.request("POST", `/members/${key}/groups`, { groups: missing.join(",") });
    }
    return this.memberId(member);
  }

  private async ensureSubscribedAddress(key: string) {
    const response = await this.rawRequest("GET", `/members/unsubscribed/${key}`);
    if (response.status === 404) return;
    if (response.ok) {
      throw new BadRequestException("Cette adresse ne peut pas être inscrite directement. Écrivez à info@familledaccueilbranchee.ca pour vous réinscrire.");
    }
    this.unavailable(response.status);
  }

  private memberId(member: any): string {
    if (typeof member?.id !== "number" && typeof member?.id !== "string") this.unavailable();
    return String(member.id);
  }

  private async request(method: string, path: string, body?: object, allowNotFound = false): Promise<any> {
    const response = await this.rawRequest(method, path, body);
    if (allowNotFound && response.status === 404) return null;
    if (!response.ok) this.unavailable(response.status);
    return this.readJson(response);
  }

  private async rawRequest(method: string, path: string, body?: object): Promise<Response> {
    try {
      return await fetch(`${API_URL}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${this.config.getOrThrow<string>("CYBERIMPACT_API_TOKEN")}`,
          "Content-Type": "application/json", Accept: "application/json"
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(8000),
        redirect: "error"
      });
    } catch {
      this.unavailable();
    }
  }

  private async readJson(response: Response): Promise<any> {
    try {
      const data = await response.json();
      if (!data || typeof data !== "object") this.unavailable(response.status);
      return data;
    } catch {
      this.unavailable(response.status);
    }
  }

  private unavailable(status?: number): never {
    // Ne jamais journaliser le jeton, le courriel ni la réponse du fournisseur.
    this.logger.warn(`Cyberimpact indisponible${status ? ` (HTTP ${status})` : ""}`);
    throw new ServiceUnavailableException(NEWSLETTER_UNAVAILABLE);
  }
}
