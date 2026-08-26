import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  Prisma,
  ResourcePublishStatus,
  TrainingAssessmentType,
  TrainingEmailStatus,
  TrainingReminderType,
  TrainingStatus
} from "@prisma/client";
import { randomBytes } from "crypto";
import { PrismaService } from "../../prisma/prisma.service";
import {
  buildAllyTrainingEmail,
  buildTeamTrainingAttentionEmail
} from "../email/fab-email.templates";
import { EmailService } from "../email/email.service";
import { UsersService } from "../users/users.service";
import { buildCertificatePdf } from "./certificate-pdf";
import {
  ALLY_COURSE_TITLE,
  ALLY_COURSE_VERSION,
  ALLY_TRAINING_LESSONS,
  QUIZ_QUESTIONS,
  TrainingQuestion,
  publicQuestion
} from "./training-content";

const MAX_QUIZ_ATTEMPTS = 3;
const QUIZ_PASS_PERCENT = 60;
const REMINDER_DELAYS = [
  [TrainingReminderType.ASSIGNMENT, 0],
  [TrainingReminderType.DAY_3, 3],
  [TrainingReminderType.DAY_7, 7],
  [TrainingReminderType.DAY_14, 14]
] as const;

const INITIAL_REMINDER_TYPES = REMINDER_DELAYS.map(([type]) => type);
const EMAIL_ELIGIBLE_STATUSES = [
  TrainingStatus.NOT_STARTED,
  TrainingStatus.IN_PROGRESS
];

type TrainingEmailAutomationStatus = "ACTIVE" | "PAUSED" | "SCHEDULED" | "MISCONFIGURED";

@Injectable()
export class TrainingService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TrainingService.name);
  private timer?: NodeJS.Timeout;
  private processingEmails = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
    private readonly usersService: UsersService
  ) {}

  async onModuleInit() {
    if (!this.isEnabled()) return;
    try {
      await this.prepareEmailAutomation();
    } catch (error) {
      this.logger.warn(`Préparation des parcours alliés reportée: ${toErrorMessage(error)}`);
      return;
    }

    const emailAutomation = this.getEmailAutomationState();
    if (emailAutomation.status === "PAUSED") {
      this.logger.warn("Relances de formation en pause (ALLY_TRAINING_EMAILS_ENABLED n'est pas true).");
    } else if (emailAutomation.status === "MISCONFIGURED") {
      this.logger.error("Relances de formation bloquées: ALLY_TRAINING_EMAILS_START_AT doit être une date ISO valide.");
    } else if (emailAutomation.status === "SCHEDULED") {
      this.logger.log(`Relances de formation programmées pour ${emailAutomation.startAt?.toISOString()}.`);
    }

    if (
      this.configService.get<string>("NODE_ENV") !== "test" &&
      emailAutomation.requested &&
      emailAutomation.startAt
    ) {
      const configured = Number(this.configService.get<string>("TRAINING_EMAIL_POLL_INTERVAL_MS", "60000"));
      const interval = Number.isFinite(configured) ? Math.max(10_000, configured) : 60_000;
      this.timer = setInterval(() => void this.processDueEmails(), interval);
      this.timer.unref();
      setTimeout(() => void this.processDueEmails(), 2_000).unref();
    }
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async backfillExistingAllies() {
    const resources = await this.prisma.resourceProfile.findMany({ select: { id: true } });
    let created = 0;
    for (const resource of resources) {
      const enrollment = await this.ensureEnrollment(resource.id);
      if (enrollment.created) created += 1;
    }
    this.logger.log(`Parcours alliés prêts: ${resources.length} (${created} créés).`);
    return { total: resources.length, created };
  }

  async prepareEmailAutomation() {
    const migratedAssessments = await this.normalizeLegacyAssessmentStates();
    const backfill = await this.backfillExistingAllies();
    const startAt = this.getConfiguredEmailStartAt();
    const rescheduled = startAt ? await this.rebasePendingInitialReminders(startAt) : 0;
    return { ...backfill, migratedAssessments, rescheduled, emailAutomation: this.publicEmailAutomationState() };
  }

  async normalizeLegacyAssessmentStates() {
    const legacy = await this.prisma.trainingEnrollment.findMany({
      where: {
        status: { in: [TrainingStatus.EXAM_AVAILABLE, TrainingStatus.ATTENTION_REQUIRED] },
        certificate: null,
        attempts: { none: { type: TrainingAssessmentType.QUIZ } }
      },
      select: { id: true }
    });
    if (!legacy.length) return 0;

    const enrollmentIds = legacy.map((item) => item.id);
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.trainingEnrollment.updateMany({
        where: { id: { in: enrollmentIds } },
        data: { status: TrainingStatus.IN_PROGRESS, attemptsResetAt: now, lastActivityAt: now }
      }),
      this.prisma.trainingEmailLog.updateMany({
        where: {
          enrollmentId: { in: enrollmentIds },
          type: TrainingReminderType.ATTENTION,
          status: { in: [TrainingEmailStatus.PENDING, TrainingEmailStatus.PROCESSING] }
        },
        data: {
          status: TrainingEmailStatus.SKIPPED,
          processingAt: null,
          lastError: "Ancienne évaluation remplacée par le test officiel de 13 questions"
        }
      })
    ]);
    this.logger.log(`Anciennes évaluations remises à zéro: ${legacy.length}.`);
    return legacy.length;
  }

  async ensureEnrollment(resourceProfileId: string) {
    const existing = await this.prisma.trainingEnrollment.findUnique({
      where: { resourceProfileId_courseVersion: { resourceProfileId, courseVersion: ALLY_COURSE_VERSION } }
    });
    const enrollment =
      existing ??
      (await this.prisma.trainingEnrollment.create({
        data: { resourceProfileId, courseVersion: ALLY_COURSE_VERSION }
      }));
    await this.scheduleInitialReminders(enrollment.id, enrollment.assignedAt);
    return { enrollment, created: !existing };
  }

  async getMyCourse(userId: string) {
    const enrollment = await this.getEnrollmentForUser(userId, true);
    return this.toCourseView(enrollment);
  }

  async openLesson(userId: string, lessonKey: string) {
    const lesson = this.getLessonDefinition(lessonKey);
    const enrollment = await this.getEnrollmentForUser(userId, true);
    await this.assertPreviousLessonsComplete(enrollment.id, lesson.number);
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.trainingLessonProgress.upsert({
        where: { enrollmentId_lessonKey: { enrollmentId: enrollment.id, lessonKey } },
        create: { enrollmentId: enrollment.id, lessonKey, visitedAt: now },
        update: { visitedAt: now }
      }),
      this.prisma.trainingEnrollment.update({
        where: { id: enrollment.id },
        data: {
          currentLessonKey: lessonKey,
          startedAt: enrollment.startedAt ?? now,
          lastActivityAt: now,
          ...(enrollment.status === TrainingStatus.NOT_STARTED ? { status: TrainingStatus.IN_PROGRESS } : {})
        }
      })
    ]);
    return lesson;
  }

  async completeLesson(userId: string, lessonKey: string, confirmed: boolean) {
    if (!confirmed) {
      throw new BadRequestException("Confirmez avoir consulté le contenu du module avant de le terminer.");
    }
    const lesson = this.getLessonDefinition(lessonKey);
    const enrollment = await this.getEnrollmentForUser(userId, true);
    await this.assertPreviousLessonsComplete(enrollment.id, lesson.number);
    const now = new Date();
    const nextLesson = ALLY_TRAINING_LESSONS[lesson.number];
    await this.prisma.$transaction([
      this.prisma.trainingLessonProgress.upsert({
        where: { enrollmentId_lessonKey: { enrollmentId: enrollment.id, lessonKey } },
        create: { enrollmentId: enrollment.id, lessonKey, visitedAt: now, completedAt: now },
        update: { completedAt: now, visitedAt: now }
      }),
      this.prisma.trainingEnrollment.update({
        where: { id: enrollment.id },
        data: {
          currentLessonKey: nextLesson?.key ?? lessonKey,
          startedAt: enrollment.startedAt ?? now,
          lastActivityAt: now,
          ...(enrollment.status === TrainingStatus.NOT_STARTED ? { status: TrainingStatus.IN_PROGRESS } : {})
        }
      })
    ]);
    return this.getMyCourse(userId);
  }

  async submitQuiz(userId: string, answers: Record<string, number>) {
    const enrollment = await this.getEnrollmentForUser(userId, true);
    await this.assertAllLessonsComplete(enrollment.id);
    if (enrollment.status === TrainingStatus.PASSED) {
      throw new BadRequestException("La formation est déjà réussie.");
    }
    const activeAttempts = await this.getActiveQuizAttemptsCount(enrollment);
    if (enrollment.status === TrainingStatus.ATTENTION_REQUIRED || activeAttempts >= MAX_QUIZ_ATTEMPTS) {
      throw new ForbiddenException("Les trois tentatives ont été utilisées. Communiquez avec l'équipe FAB.");
    }
    const graded = gradeQuestions(QUIZ_QUESTIONS, answers);
    const totalAttempts = await this.prisma.trainingAssessmentAttempt.count({
      where: { enrollmentId: enrollment.id, type: TrainingAssessmentType.QUIZ }
    });
    const attemptNumber = totalAttempts + 1;
    const pass = graded.scorePercent >= QUIZ_PASS_PERCENT;
    const now = new Date();
    const feedback = graded.feedback
      .filter((item) => !item.correct)
      .map((item) => ({ questionId: item.questionId, explanation: item.explanation }));

    if (pass) {
      const profile = await this.prisma.resourceProfile.findUniqueOrThrow({ where: { id: enrollment.resourceProfileId } });
      const certificate = await this.prisma.$transaction(async (tx) => {
        await tx.trainingAssessmentAttempt.create({
          data: {
            enrollmentId: enrollment.id,
            type: TrainingAssessmentType.QUIZ,
            attemptNumber,
            answers,
            scorePercent: graded.scorePercent,
            passed: true,
            submittedAt: now
          }
        });
        await tx.trainingEnrollment.update({
          where: { id: enrollment.id },
          data: { status: TrainingStatus.PASSED, completedAt: now, lastActivityAt: now }
        });
        await tx.trainingEmailLog.updateMany({
          where: { enrollmentId: enrollment.id, status: { in: [TrainingEmailStatus.PENDING, TrainingEmailStatus.PROCESSING] } },
          data: { status: TrainingEmailStatus.SKIPPED, lastError: "Formation réussie" }
        });
        const createdCertificate = await tx.trainingCertificate.upsert({
          where: { enrollmentId: enrollment.id },
          update: {},
          create: {
            enrollmentId: enrollment.id,
            certificateCode: createCertificateCode(),
            participantName: profile.displayName,
            courseTitle: ALLY_COURSE_TITLE,
            courseVersion: ALLY_COURSE_VERSION,
            scorePercent: graded.scorePercent,
            issuedAt: now
          }
        });
        await tx.trainingEmailLog.upsert({
          where: { enrollmentId_type: { enrollmentId: enrollment.id, type: TrainingReminderType.SUCCESS } },
          update: { status: TrainingEmailStatus.PENDING, scheduledFor: now, lastError: null },
          create: { enrollmentId: enrollment.id, type: TrainingReminderType.SUCCESS, scheduledFor: now }
        });
        return createdCertificate;
      });
      setTimeout(() => void this.processDueEmails(), 0).unref();
      return {
        passed: true,
        scorePercent: graded.scorePercent,
        correctAnswers: graded.correctCount,
        totalQuestions: QUIZ_QUESTIONS.length,
        attemptNumber,
        completedAt: now,
        attemptsRemaining: MAX_QUIZ_ATTEMPTS - activeAttempts - 1,
        feedback,
        certificateAvailable: true,
        certificateCode: certificate.certificateCode
      };
    }

    const attemptsAfter = activeAttempts + 1;
    const attentionRequired = attemptsAfter >= MAX_QUIZ_ATTEMPTS;
    await this.prisma.$transaction(async (tx) => {
      await tx.trainingAssessmentAttempt.create({
        data: {
          enrollmentId: enrollment.id,
          type: TrainingAssessmentType.QUIZ,
          attemptNumber,
          answers,
          scorePercent: graded.scorePercent,
          passed: false,
          submittedAt: now
        }
      });
      await tx.trainingEnrollment.update({
        where: { id: enrollment.id },
        data: {
          status: attentionRequired ? TrainingStatus.ATTENTION_REQUIRED : TrainingStatus.IN_PROGRESS,
          lastActivityAt: now
        }
      });
      if (attentionRequired) {
        await tx.trainingEmailLog.upsert({
          where: { enrollmentId_type: { enrollmentId: enrollment.id, type: TrainingReminderType.ATTENTION } },
          update: { status: TrainingEmailStatus.PENDING, scheduledFor: now, lastError: null },
          create: { enrollmentId: enrollment.id, type: TrainingReminderType.ATTENTION, scheduledFor: now }
        });
      }
    });
    if (attentionRequired) {
      setTimeout(() => void this.processDueEmails(), 0).unref();
    }
    return {
      passed: false,
      scorePercent: graded.scorePercent,
      attemptsRemaining: Math.max(0, MAX_QUIZ_ATTEMPTS - attemptsAfter),
      feedback,
      attentionRequired
    };
  }

  async assertTrainingPassedForPublication(resourceProfileId: string, currentPublishStatus?: ResourcePublishStatus) {
    if (currentPublishStatus === ResourcePublishStatus.PUBLISHED) return;
    const enrollment = await this.prisma.trainingEnrollment.findUnique({
      where: { resourceProfileId_courseVersion: { resourceProfileId, courseVersion: ALLY_COURSE_VERSION } }
    });
    if (!enrollment || enrollment.status !== TrainingStatus.PASSED) {
      throw new BadRequestException("La formation allié doit être réussie avant la publication du profil.");
    }
  }

  async assertTrainingsPassedForPublication(resourceIds: string[]) {
    const blocked = await this.prisma.resourceProfile.findMany({
      where: {
        id: { in: resourceIds },
        publishStatus: { not: ResourcePublishStatus.PUBLISHED },
        OR: [
          { trainingEnrollments: { none: { courseVersion: ALLY_COURSE_VERSION } } },
          { trainingEnrollments: { some: { courseVersion: ALLY_COURSE_VERSION, status: { not: TrainingStatus.PASSED } } } }
        ]
      },
      select: { id: true, displayName: true }
    });
    if (blocked.length) {
      throw new BadRequestException(
        `Formation non réussie pour: ${blocked.map((resource) => resource.displayName).join(", ")}.`
      );
    }
  }

  async listForAdmin(filters: { query?: string; status?: string; page?: number; pageSize?: number }) {
    const page = Math.max(1, Math.floor(filters.page ?? 1));
    const pageSize = Math.min(50, Math.max(1, Math.floor(filters.pageSize ?? 20)));
    const query = (filters.query ?? "").trim();
    const status = isTrainingStatus(filters.status) ? filters.status : undefined;
    const where: Prisma.TrainingEnrollmentWhereInput = {
      ...(status ? { status } : {}),
      ...(query
        ? {
            resourceProfile: {
              OR: [
                { displayName: { contains: query, mode: "insensitive" } },
                { user: { email: { contains: query, mode: "insensitive" } } }
              ]
            }
          }
        : {})
    };
    const [total, enrollments, grouped] = await this.prisma.$transaction([
      this.prisma.trainingEnrollment.count({ where }),
      this.prisma.trainingEnrollment.findMany({
        where,
        include: {
          resourceProfile: { include: { user: { select: { email: true } } } },
          lessonProgress: true,
          attempts: { orderBy: { submittedAt: "desc" } },
          certificate: true,
          emailLogs: { orderBy: { scheduledFor: "asc" } }
        },
        orderBy: [{ status: "asc" }, { lastActivityAt: "desc" }, { assignedAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize
      }),
      this.prisma.trainingEnrollment.groupBy({
        by: ["status"],
        orderBy: { status: "asc" },
        _count: { status: true }
      })
    ]);
    const stats: Record<string, number> = Object.fromEntries(Object.values(TrainingStatus).map((value) => [value, 0]));
    grouped.forEach((item) => (stats[item.status] = (item._count as { status: number }).status));
    stats[TrainingStatus.IN_PROGRESS] += stats[TrainingStatus.EXAM_AVAILABLE];
    stats[TrainingStatus.EXAM_AVAILABLE] = 0;
    return {
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      stats,
      emailAutomation: this.publicEmailAutomationState(),
      items: enrollments.map((enrollment) => this.toAdminView(enrollment))
    };
  }

  async resetQuizAttempts(enrollmentId: string, actorUserId: string) {
    const enrollment = await this.prisma.trainingEnrollment.findUnique({
      where: { id: enrollmentId },
      include: { resourceProfile: true }
    });
    if (!enrollment) throw new NotFoundException("Parcours allié introuvable.");
    if (enrollment.status === TrainingStatus.PASSED) {
      throw new BadRequestException("La formation est déjà réussie.");
    }
    const updated = await this.prisma.trainingEnrollment.update({
      where: { id: enrollmentId },
      data: { status: TrainingStatus.IN_PROGRESS, attemptsResetAt: new Date(), lastActivityAt: new Date() }
    });
    await this.usersService.logAdminAction(actorUserId, "ALLY_TRAINING_ATTEMPTS_RESET", "TRAINING_ENROLLMENT", enrollmentId, {
      resourceProfileId: enrollment.resourceProfileId,
      displayName: enrollment.resourceProfile.displayName
    });
    return { id: updated.id, status: updated.status };
  }

  async getCertificateForUser(userId: string) {
    const enrollment = await this.getEnrollmentForUser(userId, false);
    return this.certificatePayload(enrollment.id);
  }

  async getCertificateForAdmin(enrollmentId: string) {
    return this.certificatePayload(enrollmentId);
  }

  async processDueEmails() {
    if (this.processingEmails || !this.isEnabled() || !this.getEmailAutomationState().enabled) return;
    this.processingEmails = true;
    try {
      const stale = new Date(Date.now() - 10 * 60_000);
      await this.prisma.trainingEmailLog.updateMany({
        where: { status: TrainingEmailStatus.PROCESSING, processingAt: { lt: stale } },
        data: { status: TrainingEmailStatus.PENDING, processingAt: null }
      });
      const due = await this.prisma.trainingEmailLog.findMany({
        where: {
          status: TrainingEmailStatus.PENDING,
          scheduledFor: { lte: new Date() },
          OR: [
            { type: TrainingReminderType.ATTENTION },
            { enrollment: { status: { in: [TrainingStatus.PASSED, TrainingStatus.ATTENTION_REQUIRED] } } },
            {
              enrollment: {
                resourceProfile: {
                  user: { emailVerifiedAt: { not: null } }
                }
              }
            }
          ]
        },
        orderBy: { scheduledFor: "asc" },
        take: 20
      });
      for (const emailLog of due) await this.processEmailLog(emailLog.id);
    } catch (error) {
      this.logger.warn(`Traitement des relances échoué: ${toErrorMessage(error)}`);
    } finally {
      this.processingEmails = false;
    }
  }

  private async processEmailLog(id: string) {
    const claimed = await this.prisma.trainingEmailLog.updateMany({
      where: { id, status: TrainingEmailStatus.PENDING },
      data: { status: TrainingEmailStatus.PROCESSING, processingAt: new Date() }
    });
    if (!claimed.count) return;
    const log = await this.prisma.trainingEmailLog.findUnique({
      where: { id },
      include: {
        enrollment: {
          include: {
            resourceProfile: { include: { user: { select: { email: true, emailVerifiedAt: true } } } },
            lessonProgress: true
          }
        }
      }
    });
    if (!log) return;
    const { enrollment } = log;
    if (!this.shouldSend(log.type, enrollment.status)) {
      await this.prisma.trainingEmailLog.update({
        where: { id },
        data: { status: TrainingEmailStatus.SKIPPED, processingAt: null, lastError: "Condition non applicable" }
      });
      return;
    }
    const frontendUrl = this.configService.get<string>("APP_FRONTEND_URL", "http://localhost:3002");
    const progress = progressPercent(enrollment.lessonProgress);
    const recipient =
      log.type === TrainingReminderType.ATTENTION
        ? this.getNotificationEmail()
        : enrollment.resourceProfile.user.email;
    const message =
      log.type === TrainingReminderType.ATTENTION
        ? {
            subject: "Intervention requise - examen allié FAB",
            html: buildTeamTrainingAttentionEmail({
              displayName: enrollment.resourceProfile.displayName,
              email: enrollment.resourceProfile.user.email,
              frontendUrl
            })
          }
        : {
            subject: trainingEmailSubject(log.type),
            html: buildAllyTrainingEmail({
              displayName: enrollment.resourceProfile.displayName,
              kind: log.type,
              progressPercent: progress,
              frontendUrl
            })
          };
    const result = await this.emailService.send({ to: recipient, ...message });
    if (result.ok) {
      await this.prisma.trainingEmailLog.update({
        where: { id },
        data: {
          status: TrainingEmailStatus.SENT,
          sentAt: new Date(),
          processingAt: null,
          providerMessageId: result.messageId ?? null,
          lastError: result.delivered ? null : "Courriel simulé par la configuration locale"
        }
      });
      return;
    }
    const retryCount = log.retryCount + 1;
    await this.prisma.trainingEmailLog.update({
      where: { id },
      data: {
        status: retryCount >= 5 ? TrainingEmailStatus.FAILED : TrainingEmailStatus.PENDING,
        processingAt: null,
        retryCount,
        scheduledFor: new Date(Date.now() + Math.min(24 * 60, 5 * 2 ** retryCount) * 60_000),
        lastError: result.error ?? "Erreur d'envoi"
      }
    });
  }

  private shouldSend(type: TrainingReminderType, status: TrainingStatus) {
    if (type === TrainingReminderType.ASSIGNMENT) {
      return status !== TrainingStatus.PASSED && status !== TrainingStatus.ATTENTION_REQUIRED;
    }
    if (type === TrainingReminderType.DAY_3) return status === TrainingStatus.NOT_STARTED;
    if (type === TrainingReminderType.DAY_7 || type === TrainingReminderType.DAY_14) {
      return status !== TrainingStatus.PASSED && status !== TrainingStatus.ATTENTION_REQUIRED;
    }
    if (type === TrainingReminderType.SUCCESS) return status === TrainingStatus.PASSED;
    return type === TrainingReminderType.ATTENTION && status === TrainingStatus.ATTENTION_REQUIRED;
  }

  private async getEnrollmentForUser(userId: string, createIfMissing: boolean) {
    const profile = await this.prisma.resourceProfile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundException("Profil allié introuvable.");
    if (createIfMissing) await this.ensureEnrollment(profile.id);
    const enrollment = await this.prisma.trainingEnrollment.findUnique({
      where: { resourceProfileId_courseVersion: { resourceProfileId: profile.id, courseVersion: ALLY_COURSE_VERSION } },
      include: { lessonProgress: true, attempts: { orderBy: { submittedAt: "desc" } }, certificate: true, emailLogs: true }
    });
    if (!enrollment) throw new NotFoundException("Formation allié non assignée.");
    return enrollment;
  }

  private async assertPreviousLessonsComplete(enrollmentId: string, lessonNumber: number) {
    if (lessonNumber <= 1) return;
    const previousKeys = ALLY_TRAINING_LESSONS.slice(0, lessonNumber - 1).map((lesson) => lesson.key);
    const completed = await this.prisma.trainingLessonProgress.count({
      where: { enrollmentId, lessonKey: { in: previousKeys }, completedAt: { not: null } }
    });
    if (completed !== previousKeys.length) throw new BadRequestException("Terminez le module précédent avant de continuer.");
  }

  private async assertAllLessonsComplete(enrollmentId: string) {
    const completed = await this.prisma.trainingLessonProgress.count({ where: { enrollmentId, completedAt: { not: null } } });
    if (completed !== ALLY_TRAINING_LESSONS.length) {
      throw new BadRequestException("Terminez les huit modules avant le test officiel.");
    }
  }

  private getLessonDefinition(key: string) {
    const lesson = ALLY_TRAINING_LESSONS.find((item) => item.key === key);
    if (!lesson) throw new NotFoundException("Module de formation introuvable.");
    return lesson;
  }

  private async getActiveQuizAttemptsCount(enrollment: { id: string; attemptsResetAt: Date | null }) {
    return this.prisma.trainingAssessmentAttempt.count({
      where: {
        enrollmentId: enrollment.id,
        type: TrainingAssessmentType.QUIZ,
        ...(enrollment.attemptsResetAt ? { submittedAt: { gt: enrollment.attemptsResetAt } } : {})
      }
    });
  }

  private toCourseView(enrollment: Awaited<ReturnType<TrainingService["getEnrollmentForUser"]>>) {
    const completed = new Set(enrollment.lessonProgress.filter((item) => item.completedAt).map((item) => item.lessonKey));
    const quizAttempts = enrollment.attempts.filter(
      (attempt) =>
        attempt.type === TrainingAssessmentType.QUIZ &&
        (!enrollment.attemptsResetAt || attempt.submittedAt > enrollment.attemptsResetAt)
    );
    const passedAttempt = quizAttempts.find((attempt) => attempt.passed);
    const finalResult = enrollment.certificate
      ? {
          scorePercent: enrollment.certificate.scorePercent,
          correctAnswers: Math.round((enrollment.certificate.scorePercent / 100) * QUIZ_QUESTIONS.length),
          totalQuestions: QUIZ_QUESTIONS.length,
          attemptNumber: passedAttempt?.attemptNumber ?? null,
          completedAt: enrollment.completedAt ?? enrollment.certificate.issuedAt
        }
      : null;
    return {
      id: enrollment.id,
      courseVersion: enrollment.courseVersion,
      title: ALLY_COURSE_TITLE,
      status:
        enrollment.status === TrainingStatus.EXAM_AVAILABLE
          ? TrainingStatus.IN_PROGRESS
          : enrollment.status,
      assignedAt: enrollment.assignedAt,
      startedAt: enrollment.startedAt,
      lastActivityAt: enrollment.lastActivityAt,
      completedAt: enrollment.completedAt,
      currentLessonKey: enrollment.currentLessonKey ?? ALLY_TRAINING_LESSONS[0].key,
      progressPercent: progressPercent(enrollment.lessonProgress),
      attemptsUsed: quizAttempts.length,
      attemptsRemaining: Math.max(0, MAX_QUIZ_ATTEMPTS - quizAttempts.length),
      certificateAvailable: Boolean(enrollment.certificate),
      finalResult,
      lessons: ALLY_TRAINING_LESSONS.map((lesson) => ({
        key: lesson.key,
        number: lesson.number,
        title: lesson.title,
        summary: lesson.summary,
        estimatedMinutes: lesson.estimatedMinutes,
        completed: completed.has(lesson.key),
        locked: ALLY_TRAINING_LESSONS.slice(0, lesson.number - 1).some((previous) => !completed.has(previous.key))
      })),
      quizQuestions: QUIZ_QUESTIONS.map(publicQuestion),
      // Compatibilité temporaire avec une interface déjà chargée avant le déploiement.
      formativeQuestions: QUIZ_QUESTIONS.map(publicQuestion)
    };
  }

  private toAdminView(enrollment: any) {
    const quizAttempts = enrollment.attempts.filter(
      (attempt: any) =>
        attempt.type === TrainingAssessmentType.QUIZ &&
        (!enrollment.attemptsResetAt || attempt.submittedAt > enrollment.attemptsResetAt)
    );
    return {
      id: enrollment.id,
      status:
        enrollment.status === TrainingStatus.EXAM_AVAILABLE
          ? TrainingStatus.IN_PROGRESS
          : enrollment.status,
      displayName: enrollment.resourceProfile.displayName,
      email: enrollment.resourceProfile.user.email,
      resourceProfileId: enrollment.resourceProfileId,
      publishStatus: enrollment.resourceProfile.publishStatus,
      verificationStatus: enrollment.resourceProfile.verificationStatus,
      progressPercent: progressPercent(enrollment.lessonProgress),
      completedLessons: enrollment.lessonProgress.filter((item: any) => item.completedAt).length,
      assignedAt: enrollment.assignedAt,
      lastActivityAt: enrollment.lastActivityAt,
      completedAt: enrollment.completedAt,
      attemptsUsed: quizAttempts.length,
      attemptsRemaining: Math.max(0, MAX_QUIZ_ATTEMPTS - quizAttempts.length),
      overdue:
        enrollment.status !== TrainingStatus.PASSED &&
        Date.now() - enrollment.assignedAt.getTime() >= 14 * 24 * 60 * 60_000,
      certificateAvailable: Boolean(enrollment.certificate),
      nextReminder:
        enrollment.emailLogs.find((log: any) => log.status === TrainingEmailStatus.PENDING)?.scheduledFor ?? null,
      attempts: enrollment.attempts.map((attempt: any) => ({
        id: attempt.id,
        type: attempt.type,
        attemptNumber: attempt.attemptNumber,
        scorePercent: attempt.scorePercent,
        passed: attempt.passed,
        submittedAt: attempt.submittedAt
      })),
      emailLogs: enrollment.emailLogs.map((log: any) => ({
        type: log.type,
        status: log.status,
        scheduledFor: log.scheduledFor,
        sentAt: log.sentAt,
        retryCount: log.retryCount,
        lastError: log.lastError
      }))
    };
  }

  private async scheduleInitialReminders(enrollmentId: string, assignedAt: Date) {
    const startAt = this.getConfiguredEmailStartAt();
    const baseline = startAt && assignedAt < startAt ? startAt : assignedAt;
    await Promise.all(
      REMINDER_DELAYS.map(([type, days]) =>
        this.prisma.trainingEmailLog.upsert({
          where: { enrollmentId_type: { enrollmentId, type } },
          update: {},
          create: { enrollmentId, type, scheduledFor: new Date(baseline.getTime() + days * 24 * 60 * 60_000) }
        })
      )
    );
  }

  private async rebasePendingInitialReminders(startAt: Date) {
    const enrollments = await this.prisma.trainingEnrollment.findMany({
      where: { status: { in: EMAIL_ELIGIBLE_STATUSES } },
      select: {
        id: true,
        assignedAt: true,
        emailLogs: {
          where: { status: TrainingEmailStatus.PENDING, type: { in: INITIAL_REMINDER_TYPES } },
          select: { id: true, type: true, scheduledFor: true }
        }
      }
    });
    let rescheduled = 0;
    for (const enrollment of enrollments) {
      const baseline = enrollment.assignedAt < startAt ? startAt : enrollment.assignedAt;
      for (const log of enrollment.emailLogs) {
        const reminder = REMINDER_DELAYS.find(([type]) => type === log.type);
        if (!reminder) continue;
        const scheduledFor = new Date(baseline.getTime() + reminder[1] * 24 * 60 * 60_000);
        if (log.scheduledFor.getTime() === scheduledFor.getTime()) continue;
        const updated = await this.prisma.trainingEmailLog.updateMany({
          where: { id: log.id, status: TrainingEmailStatus.PENDING },
          data: { scheduledFor }
        });
        rescheduled += updated.count;
      }
    }
    if (rescheduled) {
      this.logger.log(`${rescheduled} relance(s) en attente recalée(s) depuis ${startAt.toISOString()}.`);
    }
    return rescheduled;
  }

  private async certificatePayload(enrollmentId: string) {
    const certificate = await this.prisma.trainingCertificate.findUnique({ where: { enrollmentId } });
    if (!certificate) throw new NotFoundException("Certificat non disponible.");
    return {
      filename: `certificat-allie-fab-${certificate.certificateCode}.pdf`,
      buffer: buildCertificatePdf({
        participantName: certificate.participantName,
        issuedAt: certificate.issuedAt,
        certificateCode: certificate.certificateCode
      })
    };
  }

  private getNotificationEmail() {
    const explicit = (this.configService.get<string>("NOTIFICATION_EMAIL", "") ?? "").trim();
    if (explicit) return explicit;
    return this.configService.get<string>("ADMIN_EMAIL", "admin@fab.local");
  }

  private isEnabled() {
    return this.configService.get<string>("ALLY_TRAINING_ENABLED", "true") !== "false";
  }

  private getConfiguredEmailStartAt() {
    const raw = (this.configService.get<string>("ALLY_TRAINING_EMAILS_START_AT", "") ?? "").trim();
    if (!raw) return null;
    const timestamp = Date.parse(raw);
    return Number.isNaN(timestamp) ? null : new Date(timestamp);
  }

  private getEmailAutomationState(now = new Date()): {
    requested: boolean;
    enabled: boolean;
    status: TrainingEmailAutomationStatus;
    startAt: Date | null;
  } {
    const requested = this.configService.get<string>("ALLY_TRAINING_EMAILS_ENABLED", "false") === "true";
    const rawStartAt = (this.configService.get<string>("ALLY_TRAINING_EMAILS_START_AT", "") ?? "").trim();
    const startAt = this.getConfiguredEmailStartAt();
    if (!requested) return { requested, enabled: false, status: "PAUSED", startAt };
    if (!rawStartAt || !startAt) return { requested, enabled: false, status: "MISCONFIGURED", startAt: null };
    if (startAt > now) return { requested, enabled: false, status: "SCHEDULED", startAt };
    return { requested, enabled: true, status: "ACTIVE", startAt };
  }

  private publicEmailAutomationState() {
    const state = this.getEmailAutomationState();
    return {
      enabled: state.enabled,
      status: state.status,
      startAt: state.startAt?.toISOString() ?? null
    };
  }
}

function gradeQuestions(questions: TrainingQuestion[], answers: Record<string, number>) {
  const missing = questions.filter((question) => !Number.isInteger(answers[question.id]));
  if (missing.length) throw new BadRequestException("Répondez à toutes les questions avant de soumettre.");
  const correct = questions.filter((question) => answers[question.id] === question.correctIndex).length;
  return {
    scorePercent: Math.round((correct / questions.length) * 100),
    correctCount: correct,
    feedback: questions.map((question) => ({
      questionId: question.id,
      correct: answers[question.id] === question.correctIndex,
      correctIndex: question.correctIndex,
      explanation: question.explanation
    }))
  };
}

function progressPercent(progress: { completedAt: Date | null }[]) {
  return Math.round((progress.filter((item) => item.completedAt).length / ALLY_TRAINING_LESSONS.length) * 100);
}

function trainingEmailSubject(type: Exclude<TrainingReminderType, "ATTENTION">) {
  return {
    ASSIGNMENT: "Votre formation allié FAB est prête",
    DAY_3: "Votre formation allié FAB vous attend",
    DAY_7: "Continuez votre formation allié FAB",
    DAY_14: "Dernier rappel pour votre formation allié FAB",
    SUCCESS: "Félicitations - votre formation allié FAB est réussie"
  }[type];
}

function createCertificateCode() {
  return `FAB-${new Date().getFullYear()}-${randomBytes(4).toString("hex").toUpperCase()}`;
}

function isTrainingStatus(value?: string): value is TrainingStatus {
  return Boolean(value && Object.values(TrainingStatus).includes(value as TrainingStatus));
}

function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
