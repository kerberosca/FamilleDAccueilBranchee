import { ApiProperty } from "@nestjs/swagger";
import { UserStatus } from "@prisma/client";
import { ArrayMinSize, IsArray, IsEnum, IsString } from "class-validator";

export class BulkUpdateUserStatusDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  userIds!: string[];

  @ApiProperty({ enum: UserStatus })
  @IsEnum(UserStatus)
  status!: UserStatus;
}
