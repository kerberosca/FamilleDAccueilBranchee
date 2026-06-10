import { Module } from "@nestjs/common";
import { UsersModule } from "../users/users.module";
import { ResourceDocumentsController } from "./resource-documents.controller";
import { ResourceDocumentsService } from "./resource-documents.service";

@Module({
  imports: [UsersModule],
  controllers: [ResourceDocumentsController],
  providers: [ResourceDocumentsService],
  exports: [ResourceDocumentsService]
})
export class ResourceDocumentsModule {}
