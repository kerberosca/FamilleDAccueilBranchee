import { ApiProperty } from "@nestjs/swagger";
import { IsString, MinLength } from "class-validator";

export class CreateConversationDto {
  @ApiProperty()
  @IsString()
  resourceProfileId!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  initialMessage!: string;
}
