import { ApiProperty } from "@nestjs/swagger";
import { IsString, MinLength } from "class-validator";

export class DeleteFamilyDto {
  @ApiProperty({
    description: "Raison administrative de la suppression definitive: doublon, compte test, demande legale, erreur d'inscription.",
    minLength: 5
  })
  @IsString()
  @MinLength(5)
  reason!: string;
}
