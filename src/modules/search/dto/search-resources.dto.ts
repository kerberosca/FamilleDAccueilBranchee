import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsOptional, IsString, Min } from "class-validator";

export class SearchResourcesDto {
  @ApiProperty({ description: "Code postal (exact ou prefix 3 caracteres)" })
  @IsString()
  postalCode!: string;

  @ApiPropertyOptional({ description: "Tags separes par virgule" })
  @IsOptional()
  @IsString()
  tags?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;
}
