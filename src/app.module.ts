import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ThrottlerModule } from "@nestjs/throttler";
import * as Joi from "joi";
import { AuthModule } from "./modules/auth/auth.module";
import { BillingModule } from "./modules/billing/billing.module";
import { DevModule } from "./modules/dev/dev.module";
import { HealthModule } from "./modules/health/health.module";
import { MaintenanceModule } from "./modules/maintenance/maintenance.module";
import { MessagingModule } from "./modules/messaging/messaging.module";
import { ProfilesModule } from "./modules/profiles/profiles.module";
import { SearchModule } from "./modules/search/search.module";
import { UsersModule } from "./modules/users/users.module";
import { PrismaModule } from "./prisma/prisma.module";

const isProduction = process.env.NODE_ENV === "production";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        NODE_ENV: Joi.string().valid("development", "test", "production").default("development"),
        PORT: Joi.number().default(3000),
        DATABASE_URL: Joi.string().uri().required(),
        JWT_ACCESS_SECRET: Joi.string().min(8).required(),
        JWT_REFRESH_SECRET: Joi.string().min(8).required(),
        JWT_ACCESS_EXPIRES_IN: Joi.string().default("15m"),
        JWT_REFRESH_EXPIRES_IN: Joi.string().default("30d"),
        DEV_BYPASS_AUTH: Joi.string().valid("true", "false").default("false"),
        CORS_ORIGINS: Joi.string().required(),
        APP_FRONTEND_URL: Joi.string().uri().required(),
        ADMIN_EMAIL: Joi.string().email({ tlds: { allow: false } }).required(),
        ADMIN_PASSWORD: Joi.string().min(8).required(),
        STRIPE_SECRET_KEY: Joi.string().allow("").optional(),
        STRIPE_RESOURCE_ONBOARDING_PRICE_ID: Joi.string().allow("").optional(),
        STRIPE_FAMILY_SUBSCRIPTION_PRICE_ID: Joi.string().allow("").optional(),
        STRIPE_WEBHOOK_SECRET: Joi.string().allow("").optional()
      })
    }),
    ThrottlerModule.forRoot([
      { ttl: 60_000, limit: 60 }
    ]),
    PrismaModule,
    MaintenanceModule,
    AuthModule,
    ProfilesModule,
    SearchModule,
    BillingModule,
    HealthModule,
    MessagingModule,
    UsersModule,
    ...(!isProduction ? [DevModule] : [])
  ]
})
export class AppModule {}
