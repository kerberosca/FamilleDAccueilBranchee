import { ApiProperty } from "@nestjs/swagger";
import { Equals, IsBoolean } from "class-validator";

export class CompleteLessonDto {
  @ApiProperty({ example: true, description: "Confirmation explicite que le contenu du module a été consulté." })
  @IsBoolean()
  @Equals(true, { message: "Confirmez avoir consulté le contenu du module." })
  confirmed!: boolean;
}
