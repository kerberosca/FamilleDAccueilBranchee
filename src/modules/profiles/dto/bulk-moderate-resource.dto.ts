import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { ResourceOnboardingState, ResourcePublishStatus, ResourceVerificationStatus } from "@prisma/client";
import { ArrayMinSize, IsArray, IsEnum, IsOptional, IsString } from "class-validator";

export class BulkModerateResourceDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  resourceIds!: string[];

  @ApiPropertyOptional({ enum: ResourceVerificationStatus })
  @IsOptional()
  @IsEnum(ResourceVerificationStatus)
  verificationStatus?: ResourceVerificationStatus;

  @ApiPropertyOptional({ enum: ResourcePublishStatus })
  @IsOptional()
  @IsEnum(ResourcePublishStatus)
  publishStatus?: ResourcePublishStatus;

  @ApiPropertyOptional({ enum: ResourceOnboardingState })
  @IsOptional()
  @IsEnum(ResourceOnboardingState)
  onboardingState?: ResourceOnboardingState;
}
