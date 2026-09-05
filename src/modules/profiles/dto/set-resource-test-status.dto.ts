import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean } from "class-validator";

export class SetResourceTestStatusDto {
  @ApiProperty({ description: "Identifie un profil réservé aux essais internes." })
  @IsBoolean()
  isInternalTest!: boolean;
}
