import { Body, Controller, Get, Param, Patch, Post, Query, Res, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Role } from "@prisma/client";
import type { Response } from "express";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { JwtPayload } from "../../common/types/jwt-payload.type";
import { CompleteLessonDto } from "./dto/complete-lesson.dto";
import { SubmitAssessmentDto } from "./dto/submit-assessment.dto";
import { TrainingService } from "./training.service";

@ApiTags("training")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: "training", version: "1" })
export class TrainingController {
  constructor(private readonly trainingService: TrainingService) {}

  @Roles(Role.RESOURCE)
  @Get("me")
  getMyCourse(@CurrentUser() user: JwtPayload) {
    return this.trainingService.getMyCourse(user.sub);
  }

  @Roles(Role.RESOURCE)
  @Get("me/lessons/:lessonKey")
  openLesson(@CurrentUser() user: JwtPayload, @Param("lessonKey") lessonKey: string) {
    return this.trainingService.openLesson(user.sub, lessonKey);
  }

  @Roles(Role.RESOURCE)
  @Patch("me/lessons/:lessonKey/complete")
  completeLesson(@CurrentUser() user: JwtPayload, @Param("lessonKey") lessonKey: string, @Body() dto: CompleteLessonDto) {
    return this.trainingService.completeLesson(user.sub, lessonKey, dto.confirmed);
  }

  @Roles(Role.RESOURCE)
  @Post("me/quiz/submit")
  submitQuiz(@CurrentUser() user: JwtPayload, @Body() dto: SubmitAssessmentDto) {
    return this.trainingService.submitQuiz(user.sub, dto.answers);
  }

  /** Alias temporaire pour les interfaces chargées avant la mise à jour. */
  @Roles(Role.RESOURCE)
  @Post("me/formative/submit")
  submitLegacyQuiz(@CurrentUser() user: JwtPayload, @Body() dto: SubmitAssessmentDto) {
    return this.trainingService.submitQuiz(user.sub, dto.answers);
  }

  @Roles(Role.RESOURCE)
  @Get("me/certificate")
  async getMyCertificate(@CurrentUser() user: JwtPayload, @Res() response: Response) {
    const certificate = await this.trainingService.getCertificateForUser(user.sub);
    response.setHeader("Content-Type", "application/pdf");
    response.setHeader("Content-Disposition", `attachment; filename="${certificate.filename}"`);
    response.send(certificate.buffer);
  }

  @Roles(Role.ADMIN)
  @Get("admin/enrollments")
  listForAdmin(
    @Query("query") query?: string,
    @Query("status") status?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string
  ) {
    return this.trainingService.listForAdmin({ query, status, page: Number(page ?? 1), pageSize: Number(pageSize ?? 20) });
  }

  @Roles(Role.ADMIN)
  @Post("admin/enrollments/:enrollmentId/reset-attempts")
  resetAttempts(@CurrentUser() user: JwtPayload, @Param("enrollmentId") enrollmentId: string) {
    return this.trainingService.resetQuizAttempts(enrollmentId, user.sub);
  }

  @Roles(Role.ADMIN)
  @Post("admin/enrollments/:enrollmentId/emails/enable")
  enableEmails(@CurrentUser() user: JwtPayload, @Param("enrollmentId") enrollmentId: string) {
    return this.trainingService.enableEmailAutomation(enrollmentId, user.sub);
  }

  @Roles(Role.ADMIN)
  @Post("admin/enrollments/:enrollmentId/emails/pause")
  pauseEmails(@CurrentUser() user: JwtPayload, @Param("enrollmentId") enrollmentId: string) {
    return this.trainingService.pauseEmailAutomation(enrollmentId, user.sub);
  }

  @Roles(Role.ADMIN)
  @Get("admin/enrollments/:enrollmentId/certificate")
  async getCertificate(@Param("enrollmentId") enrollmentId: string, @Res() response: Response) {
    const certificate = await this.trainingService.getCertificateForAdmin(enrollmentId);
    response.setHeader("Content-Type", "application/pdf");
    response.setHeader("Content-Disposition", `attachment; filename="${certificate.filename}"`);
    response.send(certificate.buffer);
  }
}
