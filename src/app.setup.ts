import { ClassSerializerInterceptor, ValidationPipe, VersioningType } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Reflector } from "@nestjs/core";
import { INestApplication } from "@nestjs/common";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";
import cookieParser from "cookie-parser";
import helmet from "helmet";

export function setupApp(app: INestApplication) {
  const configService = app.get(ConfigService);

  app.use(cookieParser());

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: "cross-origin" }
    })
  );

  app.setGlobalPrefix("api");
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: "1" });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true
    })
  );
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));
  app.useGlobalFilters(new HttpExceptionFilter());

  const corsOrigins = parseCorsOrigins(configService.getOrThrow<string>("CORS_ORIGINS"));
  app.enableCors({
    origin: corsOrigins,
    credentials: true
  });
}

function parseCorsOrigins(value: string): string[] {
  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}
