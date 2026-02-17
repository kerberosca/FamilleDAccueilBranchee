import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";
import { setupApp } from "./app.setup";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  setupApp(app);

  const isProduction = process.env.NODE_ENV === "production";
  if (!isProduction) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle("Famille d'accueil branchée API")
      .setDescription("Backend MVP marketplace FR-CA")
      .setVersion("1.0.0")
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup("docs", app, document);
  }

  await app.listen(process.env.PORT ?? 3000);
}

bootstrap();
