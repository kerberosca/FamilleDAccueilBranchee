import { AllyType, Role } from "@prisma/client";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsArray, IsEmail, IsEnum, IsObject, IsOptional, IsString, Matches, MaxLength, MinLength, ValidateIf } from "class-validator";

export class RegisterDto {
  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiProperty({ minLength: 8, maxLength: 72, description: "Au moins 8 caractères, une majuscule, un chiffre, un caractère spécial" })
  @IsString()
  @MinLength(8, { message: "Le mot de passe doit contenir au moins 8 caractères." })
  @MaxLength(72)
  @Matches(/^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).*$/, {
    message: "Le mot de passe doit contenir au moins une majuscule, un chiffre et un caractère spécial."
  })
  password!: string;

  @ApiProperty({ enum: [Role.FAMILY, Role.RESOURCE] })
  @IsEnum(Role)
  role!: Role;

  @ApiProperty()
  @IsString()
  displayName!: string;

  @ApiProperty()
  @IsString()
  postalCode!: string;

  @ApiProperty()
  @IsString()
  city!: string;

  @ApiProperty()
  @IsString()
  region!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bio?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  /** Type d'allié (obligatoire quand role = RESOURCE). */
  @ApiPropertyOptional({ enum: ["MENAGE", "GARDIENS", "AUTRES"] })
  @IsOptional()
  @IsEnum(AllyType)
  allyType?: AllyType;

  /** Téléphone (obligatoire pour les alliés — formulaire répit). */
  @ApiPropertyOptional()
  @ValidateIf((o: RegisterDto) => o.role === Role.RESOURCE)
  @IsString()
  @MinLength(8, { message: "Un numéro de téléphone valide est requis." })
  contactPhone?: string;

  /**
   * Formulaire complet « Devenir allié répit » (JSON).
   * Obligatoire si role = RESOURCE ; validé côté serveur.
   */
  @ApiPropertyOptional()
  @ValidateIf((o: RegisterDto) => o.role === Role.RESOURCE)
  @IsObject()
  allyRegistration?: unknown;
}
