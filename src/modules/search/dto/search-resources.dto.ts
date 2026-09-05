import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { ResourceServiceDeliveryMode } from "@prisma/client";
import { IsIn, IsInt, IsOptional, IsString, Min } from "class-validator";

export class SearchResourcesDto {
  @ApiProperty({ description: "Code postal (exact ou prefix 3 caracteres)" })
  @IsString()
  postalCode!: string;

  @ApiPropertyOptional({ description: "Tags separes par virgule" })
  @IsOptional()
  @IsString()
  tags?: string;

  @ApiPropertyOptional({
    enum: [ResourceServiceDeliveryMode.IN_PERSON, ResourceServiceDeliveryMode.REMOTE],
    default: ResourceServiceDeliveryMode.IN_PERSON
  })
  @IsOptional()
  @IsIn([ResourceServiceDeliveryMode.IN_PERSON, ResourceServiceDeliveryMode.REMOTE])
  deliveryMode?: ResourceServiceDeliveryMode;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;
}
