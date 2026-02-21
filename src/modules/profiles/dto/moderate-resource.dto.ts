import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  BackgroundCheckStatus,
  ResourceOnboardingState,
  ResourcePublishStatus,
  ResourceVerificationStatus
} from "@prisma/client";
import { IsEnum, IsOptional } from "class-validator";

export class ModerateResourceDto {
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

  @ApiPropertyOptional({ enum: BackgroundCheckStatus, description: "Antécédents judiciaires (ex: PENDING, RECEIVED)" })
  @IsOptional()
  @IsEnum(BackgroundCheckStatus)
  backgroundCheckStatus?: BackgroundCheckStatus;
}
