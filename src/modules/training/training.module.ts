import { Module } from "@nestjs/common";
import { EmailModule } from "../email/email.module";
import { UsersModule } from "../users/users.module";
import { TrainingController } from "./training.controller";
import { TrainingService } from "./training.service";

@Module({
  imports: [EmailModule, UsersModule],
  controllers: [TrainingController],
  providers: [TrainingService],
  exports: [TrainingService]
})
export class TrainingModule {}
