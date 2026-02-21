import { ApiPropertyOptional } from "@nestjs/swagger";
import { BackgroundCheckStatus } from "@prisma/client";
import { Type } from "class-transformer";
import { IsArray, IsEnum, IsNumber, IsObject, IsOptional, IsString } from "class-validator";

export class UpdateResourceProfileDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  displayName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  postalCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  region?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bio?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  skillsTags?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  hourlyRate?: number;

  @ApiPropertyOptional()
  @IsOptional()
  availability?: Record<string, unknown> | string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contactEmail?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contactPhone?: string;

  /** Réponses au questionnaire allié (clés = id question, valeurs = réponse string). Modifiable par la suite. */
  @ApiPropertyOptional({ description: "Réponses questionnaire (ex: { q1: \"...\", q2: \"...\" })" })
  @IsOptional()
  @IsObject()
  questionnaireAnswers?: Record<string, string>;

  /** Statut vérification antécédents judiciaires. L'allié peut passer NOT_REQUESTED → REQUESTED (engagement). */
  @ApiPropertyOptional({ enum: BackgroundCheckStatus })
  @IsOptional()
  @IsEnum(BackgroundCheckStatus)
  backgroundCheckStatus?: BackgroundCheckStatus;
}
