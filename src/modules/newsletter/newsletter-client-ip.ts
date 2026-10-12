import { isIP } from "node:net";
import { Request } from "express";
import { ConfigService } from "@nestjs/config";

export function newsletterClientIp(request: Request, config: ConfigService): string {
  // Activer seulement derrière Caddy avec l'API liée à 127.0.0.1.
  // Caddy remplace X-Forwarded-For; ne jamais faire confiance à un accès direct public.
  if (config.get<string>("NEWSLETTER_TRUST_PROXY") === "true") {
    const forwarded = request.headers["x-forwarded-for"];
    if (typeof forwarded === "string") {
      const addresses = forwarded.split(",");
      const address = addresses[addresses.length - 1]?.trim();
      if (address && isIP(address)) return address;
    }
  }
  return request.ip || request.socket.remoteAddress || "unknown";
}
