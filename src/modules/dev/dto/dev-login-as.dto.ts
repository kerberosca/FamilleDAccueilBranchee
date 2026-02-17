import { ApiProperty } from "@nestjs/swagger";
import { IsEnum } from "class-validator";

export enum DevLoginAsRole {
  ADMIN = "ADMIN",
  FAMILLE = "FAMILLE",
  RESSOURCE = "RESSOURCE"
}

export class DevLoginAsDto {
  @ApiProperty({ enum: DevLoginAsRole })
  @IsEnum(DevLoginAsRole)
  role!: DevLoginAsRole;
}
