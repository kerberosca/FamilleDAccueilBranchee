import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { DevController } from "./dev.controller";
import { DevService } from "./dev.service";
import { DevOnlyGuard } from "./guards/dev-only.guard";

@Module({
  imports: [AuthModule],
  controllers: [DevController],
  providers: [DevService, DevOnlyGuard]
})
export class DevModule {}
