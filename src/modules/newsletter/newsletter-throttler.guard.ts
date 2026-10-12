import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Reflector } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModuleOptions, ThrottlerStorage, InjectThrottlerOptions, InjectThrottlerStorage } from "@nestjs/throttler";
import { Request } from "express";
import { newsletterClientIp } from "./newsletter-client-ip";

@Injectable()
export class NewsletterThrottlerGuard extends ThrottlerGuard {
  constructor(
    @InjectThrottlerOptions() options: ThrottlerModuleOptions,
    @InjectThrottlerStorage() storage: ThrottlerStorage,
    reflector: Reflector,
    private readonly config: ConfigService
  ) {
    super(options, storage, reflector);
  }

  protected async getTracker(request: Request): Promise<string> {
    return newsletterClientIp(request, this.config);
  }
}
