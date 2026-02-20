import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";

export class RefreshDto {
  @ApiPropertyOptional({ description: "Optionnel si le refresh token est envoyé en cookie httpOnly" })
  @IsOptional()
  @IsString()
  refreshToken?: string;
}
