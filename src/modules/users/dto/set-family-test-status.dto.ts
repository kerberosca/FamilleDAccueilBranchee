import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean } from "class-validator";

export class SetFamilyTestStatusDto {
  @ApiProperty()
  @IsBoolean()
  isInternalTest!: boolean;
}
