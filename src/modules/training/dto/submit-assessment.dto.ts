import { IsObject } from "class-validator";

export class SubmitAssessmentDto {
  @IsObject()
  answers!: Record<string, number>;
}
