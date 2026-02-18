import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { JwtModule } from "@nestjs/jwt";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { PrismaModule } from "../../prisma/prisma.module";
import { MaintenanceController } from "./maintenance.controller";
import { MaintenanceGuard } from "./maintenance.guard";
import { MaintenanceService } from "./maintenance.service";

@Module({
  imports: [
    PrismaModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>("JWT_ACCESS_SECRET")
      }),
      inject: [ConfigService]
    })
  ],
  controllers: [MaintenanceController],
  providers: [
    MaintenanceService,
    { provide: APP_GUARD, useClass: MaintenanceGuard }
  ],
  exports: [MaintenanceService]
})
export class MaintenanceModule {}
