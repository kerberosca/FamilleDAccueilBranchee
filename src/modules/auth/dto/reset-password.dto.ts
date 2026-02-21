import { ApiProperty } from "@nestjs/swagger";
import { IsString, Matches, MaxLength, MinLength } from "class-validator";

export class ResetPasswordDto {
  @ApiProperty({ description: "Token reçu par email (lien de réinitialisation)" })
  @IsString()
  token!: string;

  @ApiProperty({ minLength: 8, maxLength: 72, description: "Au moins 8 caractères, une majuscule, un chiffre, un caractère spécial" })
  @IsString()
  @MinLength(8, { message: "Le mot de passe doit contenir au moins 8 caractères." })
  @MaxLength(72)
  @Matches(/^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).*$/, {
    message: "Le mot de passe doit contenir au moins une majuscule, un chiffre et un caractère spécial."
  })
  newPassword!: string;
}
