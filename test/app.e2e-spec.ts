import { INestApplication } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import {
  AllyType,
  BackgroundCheckStatus,
  ResourceDocumentType,
  ResourceOnboardingState,
  ResourcePublishStatus,
  ResourceServiceDeliveryMode,
  ResourceVerificationStatus,
  Role,
  SubscriptionStatus,
  TrainingEmailStatus,
  TrainingReminderType,
  TrainingStatus,
  UserStatus
} from "@prisma/client";
import * as argon2 from "argon2";
import { execSync } from "node:child_process";
import { join } from "node:path";
import request from "supertest";
import { setupApp } from "../src/app.setup";
import { AuthService } from "../src/modules/auth/auth.service";
import { StripeService } from "../src/modules/billing/stripe.service";
import { EmailService } from "../src/modules/email/email.service";
import { TrainingService } from "../src/modules/training/training.service";
import { PrismaService } from "../src/prisma/prisma.service";

const E2E_SCHEMA = "e2e_tests";

describe("Smoke e2e", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let familyUserId: string;

  const stripeCreateSessionMock = jest.fn(async () => ({
    url: "https://stripe.local/checkout/session-test",
    id: "cs_test_123"
  }));
  const emailSendMock = jest.fn(async () => ({ ok: true }));

  beforeAll(async () => {
    configureTestEnv();
    execSync("npx prisma db push --skip-generate", { stdio: "inherit", env: process.env });
    const { AppModule } = await import("../src/app.module");

    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule]
    })
      .overrideProvider(StripeService)
      .useValue({
        client: {
          checkout: {
            sessions: {
              create: stripeCreateSessionMock
            }
          },
          webhooks: {
            constructEvent: jest.fn()
          }
        }
      })
      .overrideProvider(EmailService)
      .useValue({
        send: emailSendMock
      })
      .compile();

    app = moduleFixture.createNestApplication();
    setupApp(app);
    await app.init();

    prisma = app.get(PrismaService);
    await cleanDatabase(prisma);
    const ids = await seedDevUsers(prisma);
    familyUserId = ids.familyUserId;
  }, 30_000);

  afterAll(async () => {
    if (prisma) {
      await cleanDatabase(prisma);
    }
    if (app) {
      await app.close();
    }
  });

  it("GET /api/v1/health retourne ok", async () => {
    const res = await request(app.getHttpServer()).get("/api/v1/health").expect(200);
    expect(res.body).toEqual({ status: "ok" });
  });

  it("POST /api/v1/dev/login-as puis GET /api/v1/users/me", async () => {
    const token = await loginAs("ADMIN");
    const me = await request(app.getHttpServer())
      .get("/api/v1/users/me")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(me.body.role).toBe("ADMIN");
    expect(me.body.passwordHash).toBeUndefined();
  });

  it("GET /api/v1/system-status est reserve aux admins", async () => {
    const adminToken = await loginAs("ADMIN");
    const familyToken = await loginAs("FAMILLE");

    const anonymous = await request(app.getHttpServer()).get("/api/v1/system-status").expect(401);
    expect(anonymous.body.message).toBe("Votre session est invalide ou a expiré.");

    const forbidden = await request(app.getHttpServer())
      .get("/api/v1/system-status")
      .set("Authorization", `Bearer ${familyToken}`)
      .expect(403);
    expect(forbidden.body.message).toBe("Vous n'avez pas les droits requis pour effectuer cette action.");

    const res = await request(app.getHttpServer())
      .get("/api/v1/system-status")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.generatedAt).toBeDefined();
    expect(res.body.host.uptimeSeconds).toEqual(expect.any(Number));
    expect(res.body.cpu.cores).toBeGreaterThan(0);
    expect(res.body.memory.totalBytes).toBeGreaterThan(0);
    expect(res.body.scope).toBe("os-visible-from-api-container");
  });

  it("GET /api/v1/search/resources retourne preview sans contact en public", async () => {
    const res = await request(app.getHttpServer()).get("/api/v1/search/resources?postalCode=H2X1Y4").expect(200);

    expect(typeof res.body.totalFound).toBe("number");
    expect(Array.isArray(res.body.results)).toBe(true);
    expect(res.body.results.length).toBeGreaterThan(0);
    expect(res.body.results[0].contactEmail).toBeUndefined();
    expect(res.body.results[0].contactPhone).toBeUndefined();
  });

  it("GET /api/v1/search/resources filtre les etiquettes sans tenir compte de la casse", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/v1/search/resources?postalCode=H2X1Y4&tags=tutorat")
      .expect(200);

    expect(res.body.totalFound).toBeGreaterThan(0);
    expect(res.body.results[0].displayName).toBe("Ressource Locale");
  });

  it("recherche le tutorat a distance partout au Quebec et conserve la recherche locale en personne", async () => {
    const tag = "scenario-prestation-e2e";
    await prisma.resourceProfile.createMany({
      data: [
        {
          userId: (
            await prisma.user.create({
              data: {
                email: "tutorat.remote@local.test",
                passwordHash: "hash",
                role: Role.RESOURCE,
                status: UserStatus.ACTIVE,
                emailVerifiedAt: new Date()
              }
            })
          ).id,
          allyType: AllyType.AUTRES,
          displayName: "Tutorat distance e2e",
          postalCode: "G1V2M2",
          city: "Quebec",
          region: "QC",
          skillsTags: [tag],
          serviceDeliveryMode: ResourceServiceDeliveryMode.REMOTE,
          verificationStatus: ResourceVerificationStatus.VERIFIED,
          publishStatus: ResourcePublishStatus.PUBLISHED,
          onboardingState: ResourceOnboardingState.PUBLISHED
        },
        {
          userId: (
            await prisma.user.create({
              data: {
                email: "tutorat.hybride@local.test",
                passwordHash: "hash",
                role: Role.RESOURCE,
                status: UserStatus.ACTIVE,
                emailVerifiedAt: new Date()
              }
            })
          ).id,
          allyType: AllyType.AUTRES,
          displayName: "Tutorat hybride e2e",
          postalCode: "H2X1Y4",
          city: "Montreal",
          region: "QC",
          skillsTags: [tag],
          serviceDeliveryMode: ResourceServiceDeliveryMode.BOTH,
          verificationStatus: ResourceVerificationStatus.VERIFIED,
          publishStatus: ResourcePublishStatus.PUBLISHED,
          onboardingState: ResourceOnboardingState.PUBLISHED
        },
        {
          userId: (
            await prisma.user.create({
              data: {
                email: "tutorat.presentiel@local.test",
                passwordHash: "hash",
                role: Role.RESOURCE,
                status: UserStatus.ACTIVE,
                emailVerifiedAt: new Date()
              }
            })
          ).id,
          allyType: AllyType.AUTRES,
          displayName: "Tutorat presentiel e2e",
          postalCode: "H2X2Y5",
          city: "Montreal",
          region: "QC",
          skillsTags: [tag],
          serviceDeliveryMode: ResourceServiceDeliveryMode.IN_PERSON,
          verificationStatus: ResourceVerificationStatus.VERIFIED,
          publishStatus: ResourcePublishStatus.PUBLISHED,
          onboardingState: ResourceOnboardingState.PUBLISHED
        }
      ]
    });

    const adminToken = await loginAs("ADMIN");
    const remote = await request(app.getHttpServer())
      .get(`/api/v1/search/resources?postalCode=H2X1Y4&tags=${tag}&deliveryMode=REMOTE`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    expect(remote.body.results.map((item: { displayName: string }) => item.displayName).sort()).toEqual([
      "Tutorat distance e2e",
      "Tutorat hybride e2e"
    ]);

    const inPerson = await request(app.getHttpServer())
      .get(`/api/v1/search/resources?postalCode=H2X1Y4&tags=${tag}&deliveryMode=IN_PERSON`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    expect(inPerson.body.results.map((item: { displayName: string }) => item.displayName).sort()).toEqual([
      "Tutorat hybride e2e",
      "Tutorat presentiel e2e"
    ]);

    await request(app.getHttpServer())
      .get(`/api/v1/search/resources?postalCode=H2X1Y4&tags=${tag}&deliveryMode=BOTH`)
      .expect(400);

    await prisma.user.deleteMany({
      where: {
        email: {
          in: ["tutorat.remote@local.test", "tutorat.hybride@local.test", "tutorat.presentiel@local.test"]
        }
      }
    });
  });

  it("GET /api/v1/profiles/resource/:id expose le detail public sans contact", async () => {
    const search = await request(app.getHttpServer()).get("/api/v1/search/resources?postalCode=H2X1Y4").expect(200);
    const resourceId = search.body.results[0].id;

    const res = await request(app.getHttpServer()).get(`/api/v1/profiles/resource/${resourceId}`).expect(200);

    expect(res.body.displayName).toBe("Ressource Locale");
    expect(res.body.contactEmail).toBeUndefined();
    expect(res.body.contactPhone).toBeUndefined();
    expect(res.body.canContact).toBe(false);
  });

  /** R2 / charge visiteur : pas de 401 sur la recherche publique (pas de refresh côté client dans ce scénario). */
  it("GET /api/v1/search/resources sans jeton supporte plusieurs appels consécutifs (200)", async () => {
    const server = app.getHttpServer();
    for (let i = 0; i < 15; i += 1) {
      await request(server).get("/api/v1/search/resources?postalCode=H2X1Y4").expect(200);
    }
  });

  /**
   * R4 : enchaîner des POST /auth/refresh légitimes reste sous la limite throttle (10 / 60 s sur refresh).
   * Simule un usage type « quelques pages /me » sans déclencher de 429.
   */
  it("POST /api/v1/auth/refresh en chaîne (8x) ne renvoie pas 429", async () => {
    const server = app.getHttpServer();
    const login = await request(server).post("/api/v1/dev/login-as").send({ role: "FAMILLE" }).expect(201);
    let refreshToken = login.body.refreshToken as string;
    expect(refreshToken).toBeDefined();

    for (let i = 0; i < 8; i += 1) {
      const res = await request(server)
        .post("/api/v1/auth/refresh")
        .send({ refreshToken })
        .expect(201);
      expect(res.body.accessToken).toBeDefined();
      const next = refreshTokenFromSetCookie(res);
      expect(next).toBeTruthy();
      refreshToken = next!;
    }
  });

  it("GET /api/v1/search/resources avec famille premium inclut les contacts", async () => {
    const token = await loginAs("FAMILLE");
    const res = await request(app.getHttpServer())
      .get("/api/v1/search/resources?postalCode=H2X1Y4")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(res.body.results[0].contactEmail).toBe("ressource@local.test");
    expect(res.body.results[0].contactPhone).toBe("514-555-0000");
  });

  /** S1 (option B) : administrateur — même niveau d’accès que famille premium (contacts, pagination). */
  it("GET /api/v1/search/resources avec jeton admin : limitedPreview false et contacts inclus", async () => {
    const token = await loginAs("ADMIN");
    const res = await request(app.getHttpServer())
      .get("/api/v1/search/resources?postalCode=H2X1Y4")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(res.body.limitedPreview).toBe(false);
    expect(res.body.pageSize).toBe(10);
    expect(res.body.results.length).toBeGreaterThan(0);
    expect(res.body.results[0].contactEmail).toBe("ressource@local.test");
    expect(res.body.results[0].contactPhone).toBe("514-555-0000");
  });

  it("GET /api/v1/profiles/resource/:id avec jeton admin inclut les contacts", async () => {
    const token = await loginAs("ADMIN");
    const search = await request(app.getHttpServer())
      .get("/api/v1/search/resources?postalCode=H2X1Y4")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    const resourceId = search.body.results[0].id;

    const res = await request(app.getHttpServer())
      .get(`/api/v1/profiles/resource/${resourceId}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(res.body.contactEmail).toBe("ressource@local.test");
    expect(res.body.contactPhone).toBe("514-555-0000");
    expect(res.body.canContact).toBe(false);
  });

  it("GET /api/v1/profiles/resource/:id avec famille premium autorise le contact", async () => {
    const token = await loginAs("FAMILLE");
    const search = await request(app.getHttpServer())
      .get("/api/v1/search/resources?postalCode=H2X1Y4")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    const resourceId = search.body.results[0].id;

    const res = await request(app.getHttpServer())
      .get(`/api/v1/profiles/resource/${resourceId}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(res.body.contactEmail).toBe("ressource@local.test");
    expect(res.body.contactPhone).toBe("514-555-0000");
    expect(res.body.canContact).toBe(true);
  });

  /** S3 : allié (ressource) — pas d’accès plein à la recherche. */
  it("GET /api/v1/search/resources avec jeton ressource : preview sans contacts", async () => {
    const token = await loginAs("RESSOURCE");
    const res = await request(app.getHttpServer())
      .get("/api/v1/search/resources?postalCode=H2X1Y4")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(res.body.limitedPreview).toBe(true);
    expect(res.body.pageSize).toBe(3);
    expect(res.body.results[0].contactEmail).toBeUndefined();
    expect(res.body.results[0].contactPhone).toBeUndefined();
  });

  /** S3 : famille sans abonnement actif — preview comme le visiteur. */
  it("GET /api/v1/search/resources avec famille sans abonnement : preview sans contacts", async () => {
    const authService = app.get(AuthService);
    const noSubFamily = await prisma.user.create({
      data: {
        email: "e2e_famille_sans_sub@local.test",
        passwordHash: "hash",
        role: Role.FAMILY,
        status: UserStatus.ACTIVE,
        familyProfile: {
          create: {
            displayName: "Famille sans abo e2e",
            postalCode: "H2X1Y4",
            city: "Montreal",
            region: "QC",
            bio: "e2e",
            needsTags: []
          }
        }
      }
    });
    const { accessToken } = await authService.issueTokensForUser(noSubFamily.id);
    const res = await request(app.getHttpServer())
      .get("/api/v1/search/resources?postalCode=H2X1Y4")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.limitedPreview).toBe(true);
    expect(res.body.pageSize).toBe(3);
    expect(res.body.results[0].contactEmail).toBeUndefined();
  });

  it("GET /api/v1/profiles/resource/:id avec famille sans abonnement interdit le contact", async () => {
    const authService = app.get(AuthService);
    const noSubFamily = await prisma.user.create({
      data: {
        email: "e2e_detail_famille_sans_sub@local.test",
        passwordHash: "hash",
        role: Role.FAMILY,
        status: UserStatus.ACTIVE,
        familyProfile: {
          create: {
            displayName: "Famille detail sans abo e2e",
            postalCode: "H2X1Y4",
            city: "Montreal",
            region: "QC",
            bio: "e2e",
            needsTags: []
          }
        }
      }
    });
    const { accessToken } = await authService.issueTokensForUser(noSubFamily.id);
    const search = await request(app.getHttpServer()).get("/api/v1/search/resources?postalCode=H2X1Y4").expect(200);
    const resourceId = search.body.results[0].id;

    const res = await request(app.getHttpServer())
      .get(`/api/v1/profiles/resource/${resourceId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.contactEmail).toBeUndefined();
    expect(res.body.contactPhone).toBeUndefined();
    expect(res.body.canContact).toBe(false);
  });

  it("PATCH /api/v1/profiles/resource/me refuse un tarif horaire negatif", async () => {
    const token = await loginAs("RESSOURCE");
    const res = await request(app.getHttpServer())
      .patch("/api/v1/profiles/resource/me")
      .set("Authorization", `Bearer ${token}`)
      .send({ hourlyRate: -5 })
      .expect(400);

    expect(res.body.message).toContain("Le tarif horaire doit etre un nombre positif.");
  });

  it("POST /api/v1/auth/register envoie un courriel de bienvenue aux allies", async () => {
    emailSendMock.mockClear();
    const legacyAllyRegistration = validAllyRegistration();

    await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({
        email: "nouvel.allie@local.test",
        password: "Bienvenue123!",
        role: Role.RESOURCE,
        displayName: "Nouvel Allie",
        postalCode: "H2X1Y4",
        city: "Montreal",
        region: "QC",
        allyType: AllyType.GARDIENS,
        contactPhone: "514-555-1212",
        allyRegistration: {
          ...legacyAllyRegistration,
          section2: {
            ...legacyAllyRegistration.section2,
            // Compatibilite avec les candidatures sauvegardees avant la fusion
            // des deux questions RCR dans le formulaire.
            rcrLevelC: "yes"
          }
        }
      })
      .expect(201);

    expect(emailSendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "nouvel.allie@local.test",
        subject: expect.stringContaining("Bienvenue"),
        html: expect.stringContaining("Bienvenue Nouvel Allie")
      })
    );
    expect(emailSendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "notifications@local.test",
        subject: "Nouvel allié à approuver sur FAB",
        html: expect.stringContaining("Un nouvel allié attend une approbation")
      })
    );
    const legacyProfile = await prisma.resourceProfile.findFirstOrThrow({
      where: { user: { email: "nouvel.allie@local.test" } }
    });
    expect(legacyProfile.serviceDeliveryMode).toBe(ResourceServiceDeliveryMode.IN_PERSON);
    expect(
      (legacyProfile.allyRegistration as { version: string; section3: { serviceDeliveryMode: string } }).version
    ).toBe("2026-09-allie-v2");
    expect(
      (legacyProfile.allyRegistration as { section3: { serviceDeliveryMode: string } }).section3.serviceDeliveryMode
    ).toBe(ResourceServiceDeliveryMode.IN_PERSON);
  });

  it("assigne automatiquement la formation apres une candidature allie complete", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({
        email: "formation.assignment@local.test",
        password: "Bienvenue123!",
        role: Role.RESOURCE,
        displayName: "Allie Formation Assignee",
        postalCode: "H2X1Y4",
        city: "Montreal",
        region: "QC",
        allyType: AllyType.AUTRES,
        contactPhone: "514-555-1212",
        allyRegistration: validAllyRegistration({
          version: "2026-09-allie-v2",
          serviceDeliveryMode: ResourceServiceDeliveryMode.REMOTE
        })
      })
      .expect(201);

    const enrollment = await prisma.trainingEnrollment.findFirst({
      where: { resourceProfile: { user: { email: "formation.assignment@local.test" } }, courseVersion: "faba-v1" },
      include: { emailLogs: true }
    });

    expect(enrollment).toBeTruthy();
    expect(enrollment?.status).toBe("NOT_STARTED");
    expect(enrollment?.emailLogs.map((log) => log.type).sort()).toEqual(
      ["ASSIGNMENT", "DAY_3", "DAY_7", "DAY_14"].sort()
    );
    const remoteTutor = await prisma.resourceProfile.findFirstOrThrow({
      where: { user: { email: "formation.assignment@local.test" } }
    });
    expect(remoteTutor.serviceDeliveryMode).toBe(ResourceServiceDeliveryMode.REMOTE);
    expect(remoteTutor.skillsTags).toContain("tutorat à distance");
    expect((remoteTutor.allyRegistration as { version: string }).version).toBe("2026-09-allie-v2");
  });

  it("POST /api/v1/auth/register notifie l'equipe quand une famille s'inscrit", async () => {
    emailSendMock.mockClear();

    await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({
        email: "nouvelle.famille@local.test",
        password: "Bienvenue123!",
        role: Role.FAMILY,
        displayName: "Famille Nouvelle",
        postalCode: "H2X1Y4",
        city: "Montreal",
        region: "QC",
        bio: "Famille e2e",
        tags: ["repit"]
      })
      .expect(201);

    expect(emailSendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "notifications@local.test",
        subject: "Nouvelle famille inscrite sur FAB",
        html: expect.stringContaining("Une nouvelle famille d'accueil s'est inscrite")
      })
    );
  });

  it("PATCH /api/v1/profiles/resource/me envoie un courriel de confirmation", async () => {
    emailSendMock.mockClear();
    const token = await loginAs("RESSOURCE");

    const updated = await request(app.getHttpServer())
      .patch("/api/v1/profiles/resource/me")
      .set("Authorization", `Bearer ${token}`)
      .send({
        displayName: "Ressource Locale",
        allyRegistration: validAllyRegistration({
          hourlyRateSuggested: "36",
          repitNuit: true,
          nightlyRateSuggested: "145",
          dailyRateSuggested: "210"
        })
      })
      .expect(200);

    expect(updated.body.hourlyRate).toBe(36);
    expect(updated.body.availability).toEqual(
      expect.objectContaining({ tarifParNuit: "145", tarifParJour: "210" })
    );
    expect(updated.body.allyRegistration.section3).toEqual(
      expect.objectContaining({ nightlyRateSuggested: "145", dailyRateSuggested: "210" })
    );

    expect(emailSendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "ressource@local.test",
        subject: expect.stringContaining("profil allié"),
        html: expect.stringContaining("Vos modifications ont été enregistrées")
      })
    );
  });

  it("structure les services et accepte un tarif forfaitaire pour l'entretien ménager", async () => {
    const token = await loginAs("RESSOURCE");

    const directUpdate = await request(app.getHttpServer())
      .patch("/api/v1/profiles/resource/me")
      .set("Authorization", `Bearer ${token}`)
      .send({ skillsTags: ["Service libre"], hourlyRate: 99 })
      .expect(400);
    expect(directUpdate.body.message).toContain("formulaire complet de candidature");

    const updated = await request(app.getHttpServer())
      .patch("/api/v1/profiles/resource/me")
      .set("Authorization", `Bearer ${token}`)
      .send({
        allyType: AllyType.MENAGE,
        contactPhone: "514-555-0000",
        allyRegistration: validAllyRegistration({ hourlyRateSuggested: "125", rateType: "FLAT" })
      })
      .expect(200);

    expect(updated.body.rateType).toBe("FLAT");
    expect(updated.body.hourlyRate).toBe(125);
    expect(updated.body.skillsTags).toContain("entretien régulier");
    expect(updated.body.skillsTags).not.toContain("Service libre");
  });

  it("refuse de publier un profil dont l'adresse de connexion n'est pas confirmée", async () => {
    const adminToken = await loginAs("ADMIN");
    const unverified = await prisma.user.create({
      data: {
        email: "publication.non.verifiee@local.test",
        passwordHash: "hash",
        role: Role.RESOURCE,
        status: UserStatus.ACTIVE,
        resourceProfile: {
          create: {
            displayName: "Allié non vérifié",
            postalCode: "H2X1Y4",
            city: "Montreal",
            region: "QC",
            skillsTags: ["Tutorat"]
          }
        }
      },
      include: { resourceProfile: true }
    });

    const result = await request(app.getHttpServer())
      .patch(`/api/v1/profiles/resource/${unverified.resourceProfile!.id}/moderation`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ publishStatus: ResourcePublishStatus.PUBLISHED })
      .expect(400);
    expect(result.body.message).toContain("adresse de connexion");
  });

  it("PATCH /api/v1/profiles/resource/:id/moderation envoie un courriel a l'allie", async () => {
    emailSendMock.mockClear();
    const token = await loginAs("ADMIN");
    const resource = await prisma.resourceProfile.findFirstOrThrow({
      where: { displayName: "Ressource Locale" }
    });
    await prisma.resourceDocument.createMany({
      data: [
        {
          resourceProfileId: resource.id,
          type: ResourceDocumentType.BACKGROUND_CHECK,
          originalName: "antecedents-test.pdf",
          storedName: "antecedents-test.pdf",
          mimeType: "application/pdf",
          sizeBytes: 1000
        },
        {
          resourceProfileId: resource.id,
          type: ResourceDocumentType.RCR_PROOF,
          originalName: "rcr-test.pdf",
          storedName: "rcr-test.pdf",
          mimeType: "application/pdf",
          sizeBytes: 1000
        }
      ]
    });

    await request(app.getHttpServer())
      .patch(`/api/v1/profiles/resource/${resource.id}/moderation`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        verificationStatus: ResourceVerificationStatus.VERIFIED,
        publishStatus: ResourcePublishStatus.PUBLISHED,
        onboardingState: ResourceOnboardingState.PUBLISHED
      })
      .expect(200);

    expect(emailSendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "ressource@local.test",
        subject: "Votre profil allié FAB est approuvé",
        html: expect.stringContaining("Votre profil allié est approuvé")
      })
    );
    const moderationEmail = (emailSendMock.mock.calls as unknown as Array<[{ html?: string }]>)[0]?.[0];
    expect(moderationEmail.html).toContain("Vérifié");
    expect(moderationEmail.html).toContain("Publié");
    expect(moderationEmail.html).not.toContain("VERIFIED");
    expect(moderationEmail.html).not.toContain("PUBLISHED");
  });

  it("GET /api/v1/search/resources avec abonnement actif expire : preview sans contacts", async () => {
    const authService = app.get(AuthService);
    const expiredFamily = await prisma.user.create({
      data: {
        email: "e2e_famille_sub_expiree@local.test",
        passwordHash: "hash",
        role: Role.FAMILY,
        status: UserStatus.ACTIVE,
        familyProfile: {
          create: {
            displayName: "Famille sub expiree e2e",
            postalCode: "H2X1Y4",
            city: "Montreal",
            region: "QC",
            bio: "e2e",
            needsTags: []
          }
        },
        subscriptions: {
          create: {
            status: SubscriptionStatus.ACTIVE,
            stripeCustomerId: "cus_expired_family",
            stripeSubscriptionId: "sub_expired_family",
            currentPeriodEnd: new Date(Date.now() - 24 * 60 * 60 * 1000)
          }
        }
      }
    });
    const { accessToken } = await authService.issueTokensForUser(expiredFamily.id);
    const res = await request(app.getHttpServer())
      .get("/api/v1/search/resources?postalCode=H2X1Y4")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.limitedPreview).toBe(true);
    expect(res.body.results[0].contactEmail).toBeUndefined();
    expect(res.body.results[0].contactPhone).toBeUndefined();
  });

  it("POST /billing/.../checkout-session renvoie une URL mockee", async () => {
    const familyToken = await loginAs("FAMILLE");
    const resourceToken = await loginAs("RESSOURCE");

    const familyCheckout = await request(app.getHttpServer())
      .post("/api/v1/billing/family/checkout-session")
      .set("Authorization", `Bearer ${familyToken}`)
      .expect(201);
    expect(familyCheckout.body.checkoutUrl).toContain("https://stripe.local/checkout/");
    expect(familyCheckout.body.sessionId).toBeDefined();

    const resourceCheckout = await request(app.getHttpServer())
      .post("/api/v1/billing/resource/checkout-session")
      .set("Authorization", `Bearer ${resourceToken}`)
      .expect(201);
    expect(resourceCheckout.body.checkoutUrl).toContain("https://stripe.local/checkout/");
    expect(resourceCheckout.body.sessionId).toBeDefined();
    expect(stripeCreateSessionMock).toHaveBeenCalled();
  });

  it("POST /api/v1/billing/stripe/webhook accepte un payload mock en test", async () => {
    const webhookPayload = {
      type: "checkout.session.completed",
      data: {
        object: {
          metadata: {
            kind: "FAMILY_SUBSCRIPTION",
            userId: familyUserId
          },
          customer: "cus_test_123",
          subscription: "sub_test_123"
        }
      }
    };

    const res = await request(app.getHttpServer()).post("/api/v1/billing/stripe/webhook").send(webhookPayload).expect(201);

    expect(res.body).toEqual({ received: true, validated: false, mocked: true });

    const createdSub = await prisma.subscription.findUnique({
      where: { stripeSubscriptionId: "sub_test_123" }
    });
    expect(createdSub?.status).toBe(SubscriptionStatus.ACTIVE);
  });

  it("POST /api/v1/billing/stripe/webhook ressource met le profil en attente verification", async () => {
    const resourceUser = await prisma.user.create({
      data: {
        email: "e2e_webhook_resource@local.test",
        passwordHash: "hash",
        role: Role.RESOURCE,
        status: UserStatus.ACTIVE,
        resourceProfile: {
          create: {
            displayName: "Ressource webhook e2e",
            postalCode: "H2X1Y4",
            city: "Montreal",
            region: "QC",
            bio: "e2e",
            skillsTags: ["Tutorat"],
            hourlyRate: 30,
            verificationStatus: ResourceVerificationStatus.DRAFT,
            publishStatus: ResourcePublishStatus.HIDDEN,
            onboardingState: ResourceOnboardingState.PENDING_PAYMENT,
            contactEmail: "e2e_webhook_resource@local.test",
            contactPhone: "514-555-1234"
          }
        }
      }
    });
    const webhookPayload = {
      type: "checkout.session.completed",
      data: {
        object: {
          metadata: {
            kind: "RESOURCE_ONBOARDING",
            userId: resourceUser.id
          },
          customer: "cus_resource_test"
        }
      }
    };

    const res = await request(app.getHttpServer()).post("/api/v1/billing/stripe/webhook").send(webhookPayload).expect(201);
    expect(res.body).toEqual({ received: true, validated: false, mocked: true });

    const profile = await prisma.resourceProfile.findUnique({ where: { userId: resourceUser.id } });
    expect(profile?.onboardingState).toBe(ResourceOnboardingState.PENDING_VERIFICATION);
    expect(profile?.verificationStatus).toBe(ResourceVerificationStatus.PENDING_VERIFICATION);
    expect(profile?.publishStatus).toBe(ResourcePublishStatus.HIDDEN);
  });

  it("POST /api/v1/billing/family/mock-activate exige une famille connectee", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/billing/family/mock-activate")
      .send({ userId: familyUserId })
      .expect((res) => expect([401, 403]).toContain(res.status));

    const familyToken = await loginAs("FAMILLE");
    const res = await request(app.getHttpServer())
      .post("/api/v1/billing/family/mock-activate")
      .set("Authorization", `Bearer ${familyToken}`)
      .expect(201);

    expect(res.body.success).toBe(true);
  });

  it("DELETE /api/v1/users/families/:userId supprime une famille et cree un audit log", async () => {
    const adminToken = await loginAs("ADMIN");
    const family = await prisma.user.create({
      data: {
        email: "e2e_delete_family@local.test",
        passwordHash: "hash",
        role: Role.FAMILY,
        status: UserStatus.ACTIVE,
        familyProfile: {
          create: {
            displayName: "Famille a supprimer e2e",
            postalCode: "H2X1Y4",
            city: "Montreal",
            region: "QC",
            bio: "e2e",
            needsTags: []
          }
        },
        subscriptions: {
          create: {
            status: SubscriptionStatus.ACTIVE,
            stripeCustomerId: "cus_delete_family",
            stripeSubscriptionId: "sub_delete_family"
          }
        }
      }
    });

    const res = await request(app.getHttpServer())
      .delete(`/api/v1/users/families/${family.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ reason: "Compte test e2e" })
      .expect(200);

    expect(res.body).toEqual({ success: true });
    await expect(prisma.user.findUnique({ where: { id: family.id } })).resolves.toBeNull();
    await expect(prisma.familyProfile.findUnique({ where: { userId: family.id } })).resolves.toBeNull();
    await expect(prisma.subscription.findMany({ where: { userId: family.id } })).resolves.toEqual([]);

    const audit = await prisma.adminAuditLog.findFirst({
      where: { action: "FAMILY_DELETED", targetId: family.id },
      orderBy: { createdAt: "desc" }
    });
    expect(audit).toBeTruthy();
    expect(audit?.payload).toMatchObject({
      reason: "Compte test e2e",
      email: "e2e_delete_family@local.test",
      displayName: "Famille a supprimer e2e"
    });
  });

  it("DELETE /api/v1/users/families/:userId refuse un compte non-famille", async () => {
    const adminToken = await loginAs("ADMIN");
    const resource = await prisma.user.findFirstOrThrow({ where: { role: Role.RESOURCE } });

    await request(app.getHttpServer())
      .delete(`/api/v1/users/families/${resource.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ reason: "Mauvais type de compte" })
      .expect(400);
  });

  it("CORS expose les headers pour localhost:3000", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/v1/health")
      .set("Origin", "http://localhost:3000")
      .expect(200);

    expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:3000");
  });

  it("DTO invalide retourne une erreur JSON normalisee", async () => {
    const res = await request(app.getHttpServer()).post("/api/v1/dev/login-as").send({ role: "INVALID" }).expect(400);

    expect(res.body.statusCode).toBe(400);
    expect(res.body.error).toBeDefined();
    expect(res.body.message).toBeDefined();
    expect(res.body.path).toBe("/api/v1/dev/login-as");
    expect(res.body.timestamp).toBeDefined();
  });

  it("POST /api/v1/auth/verify-email refuse un jeton inconnu", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/auth/verify-email")
      .send({ token: "jeton-inconnu" })
      .expect(400);

    expect(res.body.statusCode).toBe(400);
    expect(res.body.message).toBeDefined();
  });

  it("verifie l'adresse de connexion et permet de renvoyer un lien", async () => {
    emailSendMock.mockClear();
    const registered = await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({
        email: "verification.compte@local.test",
        password: "Bienvenue123!",
        role: Role.FAMILY,
        displayName: "Compte à vérifier",
        postalCode: "H2X1Y4",
        city: "Montreal",
        region: "QC"
      })
      .expect(201);

    expect(registered.body.user.emailVerifiedAt).toBeNull();
    const pendingUser = await prisma.user.findUniqueOrThrow({ where: { email: "verification.compte@local.test" } });
    expect(pendingUser.emailVerifiedAt).toBeNull();
    expect(await prisma.emailVerificationToken.count({ where: { userId: pendingUser.id } })).toBe(1);

    await request(app.getHttpServer())
      .post("/api/v1/auth/resend-email-verification")
      .set("Authorization", `Bearer ${registered.body.accessToken}`)
      .expect(200);

    const verificationMessages = (emailSendMock.mock.calls as unknown as Array<[{ subject?: string; html?: string }]>).filter(
      ([message]) => message.subject === "Confirmez votre adresse de connexion FAB"
    );
    expect(verificationMessages).toHaveLength(2);
    const html = verificationMessages.at(-1)?.[0].html ?? "";
    const rawToken = html.match(/verify-email\?token=([a-f0-9]+)/)?.[1];
    expect(rawToken).toBeTruthy();

    await request(app.getHttpServer())
      .post("/api/v1/auth/verify-email")
      .send({ token: rawToken })
      .expect(201);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: pendingUser.id } })).emailVerifiedAt).toBeTruthy();
    expect(await prisma.emailVerificationToken.count({ where: { userId: pendingUser.id } })).toBe(0);
  });

  it("POST /api/v1/auth/login authentifie puis logout invalide le refresh token", async () => {
    const password = "Bienvenue123!";
    const user = await prisma.user.create({
      data: {
        email: "e2e_login@local.test",
        passwordHash: await argon2.hash(password),
        role: Role.FAMILY,
        status: UserStatus.ACTIVE,
        familyProfile: {
          create: {
            displayName: "Famille login e2e",
            postalCode: "H2X1Y4",
            city: "Montreal",
            region: "QC",
            bio: "e2e",
            needsTags: ["repit"]
          }
        }
      }
    });

    await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email: "e2e_login@local.test", password: "Mauvais123!" })
      .expect(401);

    const login = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email: "E2E_LOGIN@LOCAL.TEST", password })
      .expect(201);

    expect(login.body.accessToken).toBeDefined();
    expect(login.body.user.email).toBe("e2e_login@local.test");
    expect(login.body.user.passwordHash).toBeUndefined();
    expect(refreshTokenFromSetCookie(login)).toBeTruthy();
    await expect(
      prisma.user.findUnique({ where: { id: user.id } }).then((saved) => saved?.refreshTokenHash ?? null)
    ).resolves.toBeTruthy();

    const logout = await request(app.getHttpServer())
      .post("/api/v1/auth/logout")
      .set("Authorization", `Bearer ${login.body.accessToken}`)
      .expect(200);

    expect(logout.body).toEqual({ success: true });
    await expect(
      prisma.user.findUnique({ where: { id: user.id } }).then((saved) => saved?.refreshTokenHash ?? null)
    ).resolves.toBeNull();
  });

  it("POST /api/v1/auth/request-password-reset puis reset-password changent le mot de passe", async () => {
    emailSendMock.mockClear();
    const user = await prisma.user.create({
      data: {
        email: "e2e_reset@local.test",
        passwordHash: await argon2.hash("Ancien123!"),
        role: Role.FAMILY,
        status: UserStatus.ACTIVE,
        familyProfile: {
          create: {
            displayName: "Famille reset e2e",
            postalCode: "H2X1Y4",
            city: "Montreal",
            region: "QC",
            bio: "e2e",
            needsTags: []
          }
        }
      }
    });

    const requestReset = await request(app.getHttpServer())
      .post("/api/v1/auth/request-password-reset")
      .send({ email: "E2E_RESET@LOCAL.TEST" })
      .expect(201);

    expect(requestReset.body.message).toBeDefined();
    expect(emailSendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "e2e_reset@local.test",
        subject: expect.stringContaining("mot de passe")
      })
    );

    const token = await prisma.passwordResetToken.findFirstOrThrow({ where: { userId: user.id } });

    await request(app.getHttpServer())
      .post("/api/v1/auth/reset-password")
      .send({ token: token.token, newPassword: "Nouveau123!" })
      .expect(201);

    await expect(prisma.passwordResetToken.count({ where: { userId: user.id } })).resolves.toBe(0);

    const login = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email: "e2e_reset@local.test", password: "Nouveau123!" })
      .expect(201);
    expect(login.body.accessToken).toBeDefined();

    await request(app.getHttpServer())
      .post("/api/v1/auth/reset-password")
      .send({ token: token.token, newPassword: "Encore123!" })
      .expect(400);
  });

  it("POST /api/v1/auth/refresh refuse un jeton manquant", async () => {
    const res = await request(app.getHttpServer()).post("/api/v1/auth/refresh").send({}).expect(401);

    expect(res.body.message).toBe("Votre session est invalide ou a expiré.");
  });

  it("POST /api/v1/auth/refresh refuse un jeton invalide avec un message français", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/auth/refresh")
      .send({ refreshToken: "jeton-invalide" })
      .expect(401);

    expect(res.body.message).toBe("Votre session est invalide ou a expiré.");
  });

  it("GET /api/v1/users/me refuse un jeton invalide avec un message français", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/v1/users/me")
      .set("Authorization", "Bearer jeton-invalide")
      .expect(401);

    expect(res.body.message).toBe("Votre session est invalide ou a expiré.");
  });

  it("DELETE /api/v1/auth/me supprime le compte connecte", async () => {
    const authService = app.get(AuthService);
    const user = await prisma.user.create({
      data: {
        email: "e2e_delete_me@local.test",
        passwordHash: "hash",
        role: Role.FAMILY,
        status: UserStatus.ACTIVE,
        familyProfile: {
          create: {
            displayName: "Famille delete me e2e",
            postalCode: "H2X1Y4",
            city: "Montreal",
            region: "QC",
            bio: "e2e",
            needsTags: []
          }
        }
      }
    });
    const { accessToken } = await authService.issueTokensForUser(user.id);

    await request(app.getHttpServer())
      .delete("/api/v1/auth/me")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    await expect(prisma.user.findUnique({ where: { id: user.id } })).resolves.toBeNull();
  });

  it("GET/PATCH /api/v1/profiles/me couvre les profils famille, ressource et admin", async () => {
    const familyToken = await loginAs("FAMILLE");
    const resourceToken = await loginAs("RESSOURCE");
    const adminToken = await loginAs("ADMIN");

    const familyProfile = await request(app.getHttpServer())
      .get("/api/v1/profiles/me")
      .set("Authorization", `Bearer ${familyToken}`)
      .expect(200);
    expect(familyProfile.body.displayName).toBe("Famille Locale");

    const updatedFamily = await request(app.getHttpServer())
      .patch("/api/v1/profiles/family/me")
      .set("Authorization", `Bearer ${familyToken}`)
      .send({
        displayName: "Famille Locale MAJ",
        postalCode: "h2x 1y4",
        needsTags: ["repit", "transport"],
        availability: { soir: true }
      })
      .expect(200);
    expect(updatedFamily.body.displayName).toBe("Famille Locale MAJ");
    expect(updatedFamily.body.postalCode).toBe("H2X1Y4");
    expect(updatedFamily.body.availability).toEqual({ soir: true });

    const resourceProfile = await request(app.getHttpServer())
      .get("/api/v1/profiles/me")
      .set("Authorization", `Bearer ${resourceToken}`)
      .expect(200);
    expect(resourceProfile.body.displayName).toBe("Ressource Locale");
    expect(resourceProfile.body.contactEmail).toBeDefined();

    const adminProfile = await request(app.getHttpServer())
      .get("/api/v1/profiles/me")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    expect(adminProfile.body).toEqual({ userRole: Role.ADMIN });
  });

  it("GET/PATCH /api/v1/profiles/resources/admin protege et modere en lot", async () => {
    const adminToken = await loginAs("ADMIN");
    const familyToken = await loginAs("FAMILLE");
    const created = await prisma.user.create({
      data: {
        email: "e2e_bulk_resource@local.test",
        passwordHash: "hash",
        role: Role.RESOURCE,
        status: UserStatus.ACTIVE,
        resourceProfile: {
          create: {
            displayName: "Ressource Bulk e2e",
            postalCode: "H2X1Y4",
            city: "Montreal",
            region: "QC",
            bio: "e2e",
            skillsTags: ["repit"],
            hourlyRate: 28,
            verificationStatus: ResourceVerificationStatus.PENDING_VERIFICATION,
            publishStatus: ResourcePublishStatus.HIDDEN,
            onboardingState: ResourceOnboardingState.PENDING_VERIFICATION,
            contactEmail: "bulk-resource@local.test",
            contactPhone: "514-555-4141",
            backgroundCheckStatus: BackgroundCheckStatus.REQUESTED
          }
        }
      },
      include: { resourceProfile: true }
    });
    const resourceId = created.resourceProfile!.id;

    await request(app.getHttpServer())
      .get("/api/v1/profiles/resources/admin")
      .set("Authorization", `Bearer ${familyToken}`)
      .expect(403);

    const list = await request(app.getHttpServer())
      .get("/api/v1/profiles/resources/admin?query=Bulk&pageSize=5")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    expect(list.body.total).toBe(1);
    expect(list.body.items[0].id).toBe(resourceId);
    expect(list.body.items[0].documentRequirements.missing).toContain(ResourceDocumentType.BACKGROUND_CHECK);

    const bulk = await request(app.getHttpServer())
      .patch("/api/v1/profiles/resources/moderation/bulk")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        resourceIds: [resourceId],
        verificationStatus: ResourceVerificationStatus.REJECTED,
        publishStatus: ResourcePublishStatus.SUSPENDED,
        onboardingState: ResourceOnboardingState.SUSPENDED,
        backgroundCheckStatus: BackgroundCheckStatus.RECEIVED
      })
      .expect(200);

    expect(bulk.body.updatedCount).toBe(1);
    const updated = await prisma.resourceProfile.findUniqueOrThrow({ where: { id: resourceId } });
    expect(updated.verificationStatus).toBe(ResourceVerificationStatus.REJECTED);
    expect(updated.publishStatus).toBe(ResourcePublishStatus.SUSPENDED);
    expect(updated.backgroundCheckStatus).toBe(BackgroundCheckStatus.RECEIVED);
  });

  it("reserve le statut de test interne aux admins et bloque toute validation ou publication", async () => {
    const adminToken = await loginAs("ADMIN");
    const familyToken = await loginAs("FAMILLE");
    const testUser = await prisma.user.create({
      data: {
        email: "profil.test.interne@local.test",
        passwordHash: "hash",
        role: Role.RESOURCE,
        status: UserStatus.ACTIVE,
        emailVerifiedAt: new Date(),
        resourceProfile: {
          create: {
            displayName: "Profil test interne e2e",
            postalCode: "H2X1Y4",
            city: "Montreal",
            region: "QC",
            skillsTags: ["profil-test-interne-e2e"],
            verificationStatus: ResourceVerificationStatus.VERIFIED,
            publishStatus: ResourcePublishStatus.PUBLISHED,
            onboardingState: ResourceOnboardingState.PUBLISHED
          }
        }
      },
      include: { resourceProfile: true }
    });
    const resourceId = testUser.resourceProfile!.id;
    await app.get(TrainingService).ensureEnrollment(resourceId);
    const emailCallsBeforeToggle = emailSendMock.mock.calls.length;

    await request(app.getHttpServer())
      .patch(`/api/v1/profiles/resource/${resourceId}/internal-test`)
      .set("Authorization", `Bearer ${familyToken}`)
      .send({ isInternalTest: true })
      .expect(403);

    const enabled = await request(app.getHttpServer())
      .patch(`/api/v1/profiles/resource/${resourceId}/internal-test`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ isInternalTest: true })
      .expect(200);
    expect(enabled.body).toEqual(
      expect.objectContaining({
        isInternalTest: true,
        changed: true,
        verificationStatus: ResourceVerificationStatus.PENDING_VERIFICATION,
        publishStatus: ResourcePublishStatus.HIDDEN,
        onboardingState: ResourceOnboardingState.PENDING_VERIFICATION
      })
    );
    expect(emailSendMock.mock.calls).toHaveLength(emailCallsBeforeToggle);

    const idempotent = await request(app.getHttpServer())
      .patch(`/api/v1/profiles/resource/${resourceId}/internal-test`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ isInternalTest: true })
      .expect(200);
    expect(idempotent.body.changed).toBe(false);

    const blocked = await request(app.getHttpServer())
      .patch(`/api/v1/profiles/resource/${resourceId}/moderation`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        verificationStatus: ResourceVerificationStatus.VERIFIED,
        publishStatus: ResourcePublishStatus.PUBLISHED,
        onboardingState: ResourceOnboardingState.PUBLISHED
      })
      .expect(400);
    expect(blocked.body.message).toContain("test interne");

    await request(app.getHttpServer())
      .patch("/api/v1/profiles/resources/moderation/bulk")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        resourceIds: [resourceId],
        verificationStatus: ResourceVerificationStatus.VERIFIED,
        publishStatus: ResourcePublishStatus.PUBLISHED,
        onboardingState: ResourceOnboardingState.PUBLISHED
      })
      .expect(400);

    await request(app.getHttpServer()).get(`/api/v1/profiles/resource/${resourceId}`).expect(404);
    const publicSearch = await request(app.getHttpServer())
      .get("/api/v1/search/resources?postalCode=H2X1Y4&tags=profil-test-interne-e2e")
      .expect(200);
    expect(publicSearch.body.totalFound).toBe(0);

    const defaultAdminList = await request(app.getHttpServer())
      .get("/api/v1/profiles/resources/admin?query=Profil%20test%20interne%20e2e")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    expect(defaultAdminList.body.total).toBe(0);
    const testAdminList = await request(app.getHttpServer())
      .get("/api/v1/profiles/resources/admin?query=Profil%20test%20interne%20e2e&testProfile=only")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    expect(testAdminList.body.total).toBe(1);
    expect(testAdminList.body.items[0].isInternalTest).toBe(true);

    const defaultTrainingList = await request(app.getHttpServer())
      .get("/api/v1/training/admin/enrollments?query=Profil%20test%20interne%20e2e")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    expect(defaultTrainingList.body.total).toBe(0);
    const testTrainingList = await request(app.getHttpServer())
      .get("/api/v1/training/admin/enrollments?query=Profil%20test%20interne%20e2e&testProfile=only")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    expect(testTrainingList.body.total).toBe(1);
    expect(testTrainingList.body.items[0].isInternalTest).toBe(true);

    const disabled = await request(app.getHttpServer())
      .patch(`/api/v1/profiles/resource/${resourceId}/internal-test`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ isInternalTest: false })
      .expect(200);
    expect(disabled.body).toEqual(
      expect.objectContaining({ isInternalTest: false, publishStatus: ResourcePublishStatus.HIDDEN })
    );
    expect(emailSendMock.mock.calls).toHaveLength(emailCallsBeforeToggle);

    const actions = await prisma.adminAuditLog.findMany({
      where: { targetId: resourceId },
      select: { action: true }
    });
    expect(actions.map((item) => item.action)).toEqual(
      expect.arrayContaining(["RESOURCE_INTERNAL_TEST_ENABLED", "RESOURCE_INTERNAL_TEST_DISABLED"])
    );
  });

  it("GET/PATCH /api/v1/users admin liste familles, statuts et audit", async () => {
    const adminToken = await loginAs("ADMIN");
    const family = await prisma.user.create({
      data: {
        email: "e2e_admin_family@local.test",
        passwordHash: "hash",
        role: Role.FAMILY,
        status: UserStatus.ACTIVE,
        familyProfile: {
          create: {
            displayName: "Famille admin e2e",
            postalCode: "H2X1Y4",
            city: "Montreal",
            region: "QC",
            bio: "e2e",
            needsTags: []
          }
        }
      }
    });

    const list = await request(app.getHttpServer())
      .get("/api/v1/users/families?query=admin&pageSize=5")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    expect(list.body.items.some((item: { id: string }) => item.id === family.id)).toBe(true);

    const banned = await request(app.getHttpServer())
      .patch(`/api/v1/users/${family.id}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: UserStatus.BANNED })
      .expect(200);
    expect(banned.body.status).toBe(UserStatus.BANNED);

    const bulk = await request(app.getHttpServer())
      .patch("/api/v1/users/status/bulk")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ userIds: [family.id], status: UserStatus.ACTIVE })
      .expect(200);
    expect(bulk.body.updatedCount).toBe(1);

    const adminMe = await request(app.getHttpServer())
      .get("/api/v1/users/me")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/api/v1/users/${adminMe.body.id}/role`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ role: Role.FAMILY })
      .expect(400);

    const audit = await request(app.getHttpServer())
      .get("/api/v1/users/admin/audit?pageSize=10")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    expect(audit.body.items.some((item: { action: string }) => item.action === "USER_STATUS_UPDATED")).toBe(true);
    expect(audit.body.items.some((item: { action: string }) => item.action === "USER_STATUS_BULK_UPDATED")).toBe(true);
  });

  it("POST/GET /api/v1/messaging couvre conversation famille-ressource", async () => {
    const authService = app.get(AuthService);
    const adminToken = await loginAs("ADMIN");
    const familyUser = await prisma.user.create({
      data: {
        email: "e2e_message_family@local.test",
        passwordHash: "hash",
        role: Role.FAMILY,
        status: UserStatus.ACTIVE,
        familyProfile: {
          create: {
            displayName: "Famille message e2e",
            postalCode: "H2X1Y4",
            city: "Montreal",
            region: "QC",
            bio: "e2e",
            needsTags: []
          }
        },
        subscriptions: {
          create: {
            status: SubscriptionStatus.ACTIVE,
            stripeCustomerId: "cus_message_family",
            stripeSubscriptionId: "sub_message_family"
          }
        }
      }
    });
    const resourceUser = await prisma.user.create({
      data: {
        email: "e2e_message_resource@local.test",
        passwordHash: "hash",
        role: Role.RESOURCE,
        status: UserStatus.ACTIVE,
        resourceProfile: {
          create: {
            displayName: "Ressource Message e2e",
            postalCode: "H2X1Y4",
            city: "Montreal",
            region: "QC",
            bio: "e2e",
            skillsTags: ["repit"],
            hourlyRate: 30,
            verificationStatus: ResourceVerificationStatus.VERIFIED,
            publishStatus: ResourcePublishStatus.PUBLISHED,
            onboardingState: ResourceOnboardingState.PUBLISHED,
            contactEmail: "message-resource@local.test",
            contactPhone: "514-555-4242"
          }
        }
      },
      include: { resourceProfile: true }
    });
    const { accessToken: familyToken } = await authService.issueTokensForUser(familyUser.id);
    const { accessToken: resourceToken } = await authService.issueTokensForUser(resourceUser.id);
    const resource = resourceUser.resourceProfile!;

    const created = await request(app.getHttpServer())
      .post("/api/v1/messaging/conversations")
      .set("Authorization", `Bearer ${familyToken}`)
      .send({
        resourceProfileId: resource.id,
        initialMessage: "Bonjour, etes-vous disponible samedi?"
      })
      .expect(201);

    expect(created.body.resource.id).toBe(resource.id);
    expect(created.body.messages).toHaveLength(1);
    expect(created.body.messages[0].content).toContain("samedi");
    const conversationId = created.body.id as string;

    const familyList = await request(app.getHttpServer())
      .get("/api/v1/messaging/conversations")
      .set("Authorization", `Bearer ${familyToken}`)
      .expect(200);
    expect(familyList.body.some((conversation: { id: string }) => conversation.id === conversationId)).toBe(true);

    const reply = await request(app.getHttpServer())
      .post(`/api/v1/messaging/conversations/${conversationId}/messages`)
      .set("Authorization", `Bearer ${resourceToken}`)
      .send({ content: "Oui, je suis disponible." })
      .expect(201);
    expect(reply.body.messages).toHaveLength(2);

    const adminRead = await request(app.getHttpServer())
      .get(`/api/v1/messaging/conversations/${conversationId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    expect(adminRead.body.messages).toHaveLength(2);

    await request(app.getHttpServer())
      .post(`/api/v1/messaging/conversations/${conversationId}/messages`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ content: "Message admin interdit" })
      .expect(403);

    const noSubFamily = await prisma.user.create({
      data: {
        email: "e2e_message_no_sub@local.test",
        passwordHash: "hash",
        role: Role.FAMILY,
        status: UserStatus.ACTIVE,
        familyProfile: {
          create: {
            displayName: "Famille message sans abo e2e",
            postalCode: "H2X1Y4",
            city: "Montreal",
            region: "QC",
            bio: "e2e",
            needsTags: []
          }
        }
      }
    });
    const { accessToken: noSubToken } = await authService.issueTokensForUser(noSubFamily.id);

    await request(app.getHttpServer())
      .post("/api/v1/messaging/conversations")
      .set("Authorization", `Bearer ${noSubToken}`)
      .send({
        resourceProfileId: resource.id,
        initialMessage: "Tentative sans abonnement"
      })
      .expect(403);
  });

  it("GET/POST/DELETE /api/v1/resource-documents couvre upload, download et audit admin", async () => {
    const authService = app.get(AuthService);
    const created = await prisma.user.create({
      data: {
        email: "e2e_docs_resource@local.test",
        passwordHash: "hash",
        role: Role.RESOURCE,
        status: UserStatus.ACTIVE,
        resourceProfile: {
          create: {
            displayName: "Ressource Docs e2e",
            postalCode: "H2X1Y4",
            city: "Montreal",
            region: "QC",
            bio: "e2e",
            skillsTags: ["repit"],
            hourlyRate: 31,
            verificationStatus: ResourceVerificationStatus.PENDING_VERIFICATION,
            publishStatus: ResourcePublishStatus.HIDDEN,
            onboardingState: ResourceOnboardingState.PENDING_VERIFICATION,
            contactEmail: "docs-resource@local.test",
            contactPhone: "514-555-3131",
            allyRegistration: validAllyRegistration(),
            backgroundCheckStatus: BackgroundCheckStatus.REQUESTED
          }
        }
      },
      include: { resourceProfile: true }
    });
    const resourceId = created.resourceProfile!.id;
    const { accessToken: resourceToken } = await authService.issueTokensForUser(created.id);
    const adminToken = await loginAs("ADMIN");
    const familyToken = await loginAs("FAMILLE");

    const initial = await request(app.getHttpServer())
      .get("/api/v1/resource-documents/me")
      .set("Authorization", `Bearer ${resourceToken}`)
      .expect(200);
    expect(initial.body.requirements.missing).toEqual(
      expect.arrayContaining([ResourceDocumentType.BACKGROUND_CHECK, ResourceDocumentType.RCR_PROOF])
    );

    await request(app.getHttpServer())
      .post(`/api/v1/resource-documents/me?type=${ResourceDocumentType.BACKGROUND_CHECK}`)
      .set("Authorization", `Bearer ${resourceToken}`)
      .expect(400);

    const background = await request(app.getHttpServer())
      .post(`/api/v1/resource-documents/me?type=${ResourceDocumentType.BACKGROUND_CHECK}`)
      .set("Authorization", `Bearer ${resourceToken}`)
      .attach("file", Buffer.from("fake pdf background"), {
        filename: "antecedents.pdf",
        contentType: "application/pdf"
      })
      .expect(201);
    expect(background.body.requirements.complete).toBe(false);
    expect(background.body.documents).toHaveLength(1);

    const rcr = await request(app.getHttpServer())
      .post(`/api/v1/resource-documents/me?type=${ResourceDocumentType.RCR_PROOF}`)
      .set("Authorization", `Bearer ${resourceToken}`)
      .attach("file", Buffer.from("fake pdf rcr"), {
        filename: "rcr.pdf",
        contentType: "application/pdf"
      })
      .expect(201);
    expect(rcr.body.requirements.complete).toBe(true);
    expect(rcr.body.documents).toHaveLength(2);

    const documentId = rcr.body.documents.find(
      (document: { type: ResourceDocumentType }) => document.type === ResourceDocumentType.BACKGROUND_CHECK
    ).id as string;
    const rcrDocumentId = rcr.body.documents.find(
      (document: { type: ResourceDocumentType }) => document.type === ResourceDocumentType.RCR_PROOF
    ).id as string;

    const ownerDownload = await request(app.getHttpServer())
      .get(`/api/v1/resource-documents/${documentId}/download`)
      .set("Authorization", `Bearer ${resourceToken}`)
      .expect(200);
    expect(ownerDownload.headers["content-type"]).toContain("application/pdf");

    await request(app.getHttpServer())
      .get(`/api/v1/resource-documents/${documentId}/download`)
      .set("Authorization", `Bearer ${familyToken}`)
      .expect(403);

    const adminList = await request(app.getHttpServer())
      .get(`/api/v1/resource-documents/admin/resource/${resourceId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    expect(adminList.body.requirements.complete).toBe(true);

    await request(app.getHttpServer())
      .get(`/api/v1/resource-documents/${documentId}/download`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .delete(`/api/v1/resource-documents/${documentId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    const afterDelete = await request(app.getHttpServer())
      .get(`/api/v1/resource-documents/admin/resource/${resourceId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    expect(afterDelete.body.requirements.missing).toContain(ResourceDocumentType.BACKGROUND_CHECK);

    const audit = await prisma.adminAuditLog.findFirst({
      where: { action: "RESOURCE_DOCUMENT_DELETED", targetId: documentId }
    });
    expect(audit).toBeTruthy();

    await request(app.getHttpServer())
      .delete(`/api/v1/resource-documents/${rcrDocumentId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
  });

  it("parcours formation: 8 modules, quiz, 3 essais, reset admin, réussite et certificat PDF", async () => {
    const resourceToken = await loginAs("RESSOURCE");
    const adminToken = await loginAs("ADMIN");

    const overview = await request(app.getHttpServer())
      .get("/api/v1/training/me")
      .set("Authorization", `Bearer ${resourceToken}`)
      .expect(200);
    expect(overview.body.status).toBe("NOT_STARTED");
    expect(overview.body.lessons).toHaveLength(8);
    expect(overview.body.quizQuestions).toHaveLength(13);
    expect(overview.body.quizQuestions[0].correctIndex).toBeUndefined();
    expect(overview.body.quizQuestions[7].answers).toContain(
      "Ignorer la situation et poursuivre comme si de rien n'était."
    );
    expect(overview.body.quizQuestions[7].answers.join(" ")).not.toContain("DPJ");
    const reminders = await prisma.trainingEmailLog.findMany({
      where: { enrollmentId: overview.body.id },
      orderBy: { scheduledFor: "asc" }
    });
    expect(reminders.map((item) => item.type)).toEqual(["ASSIGNMENT", "DAY_3", "DAY_7", "DAY_14"]);
    expect(
      reminders.map((item) => Math.round((item.scheduledFor.getTime() - reminders[0].scheduledFor.getTime()) / 86_400_000))
    ).toEqual([0, 3, 7, 14]);

    await request(app.getHttpServer())
      .get("/api/v1/training/me/exam")
      .set("Authorization", `Bearer ${resourceToken}`)
      .expect(404);

    await request(app.getHttpServer())
      .get(`/api/v1/training/me/lessons/${overview.body.lessons[0].key}`)
      .set("Authorization", `Bearer ${resourceToken}`)
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/api/v1/training/me/lessons/${overview.body.lessons[0].key}/complete`)
      .set("Authorization", `Bearer ${resourceToken}`)
      .send({ confirmed: false })
      .expect(400);
    expect(
      await prisma.trainingLessonProgress.count({
        where: { enrollmentId: overview.body.id, completedAt: { not: null } }
      })
    ).toBe(0);

    for (const lesson of overview.body.lessons as { key: string }[]) {
      await request(app.getHttpServer())
        .get(`/api/v1/training/me/lessons/${lesson.key}`)
        .set("Authorization", `Bearer ${resourceToken}`)
        .expect(200);
      await request(app.getHttpServer())
        .patch(`/api/v1/training/me/lessons/${lesson.key}/complete`)
        .set("Authorization", `Bearer ${resourceToken}`)
        .send({ confirmed: true })
        .expect(200);
    }

    const correctAnswers = {
      "3261": 1,
      "3262": 2,
      "3263": 2,
      "3265": 2,
      "3266": 3,
      "3267": 2,
      "3268": 1,
      "3269": 2,
      "3270": 1,
      "3271": 2,
      "3272": 1,
      "3273": 2,
      "3264": 0
    };
    const { "3264": _missingFinalAnswer, ...incompleteAnswers } = correctAnswers;
    await request(app.getHttpServer())
      .post("/api/v1/training/me/quiz/submit")
      .set("Authorization", `Bearer ${resourceToken}`)
      .send({ answers: incompleteAnswers })
      .expect(400);
    expect(
      await prisma.trainingAssessmentAttempt.count({
        where: { enrollmentId: overview.body.id, type: "QUIZ" }
      })
    ).toBe(0);
    await request(app.getHttpServer())
      .get("/api/v1/training/me/certificate")
      .set("Authorization", `Bearer ${resourceToken}`)
      .expect(404);

    const sevenCorrect = answersWithCorrectCount(correctAnswers, 7);
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const failed = await request(app.getHttpServer())
        .post("/api/v1/training/me/quiz/submit")
        .set("Authorization", `Bearer ${resourceToken}`)
        .send({ answers: sevenCorrect })
        .expect(201);
      expect(failed.body.passed).toBe(false);
      expect(failed.body.scorePercent).toBe(54);
      expect(failed.body.attemptsRemaining).toBe(2 - attempt);
      expect(failed.body.feedback).toHaveLength(6);
      expect(failed.body.feedback[0]).not.toHaveProperty("correctIndex");
      expect(failed.body.feedback[0]).not.toHaveProperty("correct");
      expect(failed.body.feedback[0]).not.toHaveProperty("answer");
    }
    const blocked = await request(app.getHttpServer())
      .get("/api/v1/training/me")
      .set("Authorization", `Bearer ${resourceToken}`)
      .expect(200);
    expect(blocked.body.status).toBe("ATTENTION_REQUIRED");

    const reset = await request(app.getHttpServer())
      .post(`/api/v1/training/admin/enrollments/${blocked.body.id}/reset-attempts`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(201);
    expect(reset.body.status).toBe("IN_PROGRESS");

    const eightCorrect = answersWithCorrectCount(correctAnswers, 8);
    const passed = await request(app.getHttpServer())
      .post("/api/v1/training/me/quiz/submit")
      .set("Authorization", `Bearer ${resourceToken}`)
      .send({ answers: eightCorrect })
      .expect(201);
    expect(passed.body.passed).toBe(true);
    expect(passed.body.scorePercent).toBe(62);
    expect(passed.body.correctAnswers).toBe(8);
    expect(passed.body.totalQuestions).toBe(13);
    expect(passed.body.certificateAvailable).toBe(true);

    const completedCourse = await request(app.getHttpServer())
      .get("/api/v1/training/me")
      .set("Authorization", `Bearer ${resourceToken}`)
      .expect(200);
    expect(completedCourse.body.finalResult).toEqual(
      expect.objectContaining({ scorePercent: 62, correctAnswers: 8, totalQuestions: 13 })
    );

    const certificate = await request(app.getHttpServer())
      .get("/api/v1/training/me/certificate")
      .set("Authorization", `Bearer ${resourceToken}`)
      .buffer(true)
      .expect(200);
    expect(certificate.headers["content-type"]).toContain("application/pdf");
    const certificateBuffer = Buffer.from(certificate.body);
    expect(certificateBuffer.subarray(0, 4).toString()).toBe("%PDF");
    const certificateSource = certificateBuffer.toString("latin1");
    expect(certificateSource).toContain("1 1 1 rg 0 0 792 612 re f");
    expect(certificateSource).not.toContain("0.05 0.04 0.12 rg 0 0 792 612 re f");

    const stored = await prisma.trainingCertificate.count({ where: { enrollmentId: blocked.body.id } });
    const successEmails = await prisma.trainingEmailLog.count({
      where: { enrollmentId: blocked.body.id, type: "SUCCESS", status: TrainingEmailStatus.PENDING, providerMessageId: null }
    });
    const activeReminders = await prisma.trainingEmailLog.count({
      where: {
        enrollmentId: blocked.body.id,
        type: { in: ["DAY_3", "DAY_7", "DAY_14"] },
        status: { in: ["PENDING", "PROCESSING"] }
      }
    });
    expect(stored).toBe(1);
    expect(successEmails).toBe(1);
    expect(activeReminders).toBe(0);
  });

  it("bloque une nouvelle publication tant que la formation n'est pas réussie", async () => {
    const adminToken = await loginAs("ADMIN");
    const user = await prisma.user.create({
      data: {
        email: "formation-gate@local.test",
        passwordHash: "hash",
        role: Role.RESOURCE,
        status: UserStatus.ACTIVE,
        emailVerifiedAt: new Date(),
        resourceProfile: {
          create: {
            displayName: "Allié Formation Requise",
            postalCode: "H2X1Y4",
            city: "Montreal",
            region: "QC",
            skillsTags: ["repit"],
            verificationStatus: ResourceVerificationStatus.PENDING_VERIFICATION,
            publishStatus: ResourcePublishStatus.HIDDEN,
            onboardingState: ResourceOnboardingState.PENDING_VERIFICATION,
            contactEmail: "formation-gate@local.test",
            contactPhone: "514-555-1212",
            documents: {
              create: {
                type: ResourceDocumentType.BACKGROUND_CHECK,
                originalName: "background.pdf",
                storedName: "background-test.pdf",
                mimeType: "application/pdf",
                sizeBytes: 12
              }
            },
            trainingEnrollments: { create: { courseVersion: "faba-v1" } }
          }
        }
      },
      include: { resourceProfile: true }
    });

    const response = await request(app.getHttpServer())
      .patch(`/api/v1/profiles/resource/${user.resourceProfile!.id}/moderation`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        verificationStatus: "VERIFIED",
        publishStatus: "PUBLISHED",
        onboardingState: "PUBLISHED"
      })
      .expect(400);
    expect(response.body.message).toContain("formation allié");
  });

  it("rattrape les allies existants une seule fois et sans dupliquer les relances", async () => {
    const trainingService = app.get(TrainingService);
    const legacyUser = await prisma.user.create({
      data: {
        email: "allie-rattrapage@local.test",
        passwordHash: "hash",
        role: Role.RESOURCE,
        status: UserStatus.ACTIVE,
        emailVerifiedAt: new Date(),
        resourceProfile: {
          create: {
            displayName: "Allie a rattraper",
            postalCode: "H2X1Y4",
            city: "Montreal",
            region: "QC",
            skillsTags: ["repit"],
            contactEmail: "allie-rattrapage@local.test"
          }
        }
      },
      include: { resourceProfile: true }
    });

    expect(
      await prisma.trainingEnrollment.count({ where: { resourceProfileId: legacyUser.resourceProfile!.id } })
    ).toBe(0);

    await trainingService.backfillExistingAllies();
    const firstEnrollment = await prisma.trainingEnrollment.findFirstOrThrow({
      where: { resourceProfileId: legacyUser.resourceProfile!.id },
      include: { emailLogs: true }
    });
    expect(firstEnrollment.emailLogs).toHaveLength(4);

    const secondRun = await trainingService.backfillExistingAllies();
    expect(secondRun.created).toBe(0);
    expect(
      await prisma.trainingEnrollment.count({ where: { resourceProfileId: legacyUser.resourceProfile!.id } })
    ).toBe(1);
    expect(await prisma.trainingEmailLog.count({ where: { enrollmentId: firstEnrollment.id } })).toBe(4);
  });

  it("remet les anciennes évaluations incomplètes à zéro sans toucher aux certificats existants", async () => {
    const trainingService = app.get(TrainingService);
    const legacyProfile = await prisma.resourceProfile.create({
      data: {
        user: {
          create: {
            email: "ancien-examen@local.test",
            passwordHash: "hash",
            role: Role.RESOURCE,
            status: UserStatus.ACTIVE
          }
        },
        displayName: "Ancien examen",
        postalCode: "H2X1Y4",
        city: "Montreal",
        region: "QC",
        skillsTags: ["repit"],
        trainingEnrollments: {
          create: {
            courseVersion: "faba-v1",
            status: TrainingStatus.ATTENTION_REQUIRED,
            attempts: {
              create: [
                { type: "FORMATIVE", attemptNumber: 1, answers: {}, scorePercent: 100, passed: true },
                { type: "FINAL", attemptNumber: 1, answers: {}, scorePercent: 0, passed: false }
              ]
            },
            emailLogs: {
              create: {
                type: TrainingReminderType.ATTENTION,
                status: TrainingEmailStatus.PENDING,
                scheduledFor: new Date()
              }
            }
          }
        }
      },
      include: { trainingEnrollments: true }
    });

    const passedProfile = await prisma.resourceProfile.create({
      data: {
        user: {
          create: {
            email: "certificat-existant@local.test",
            passwordHash: "hash",
            role: Role.RESOURCE,
            status: UserStatus.ACTIVE
          }
        },
        displayName: "Certificat existant",
        postalCode: "H2X1Y4",
        city: "Montreal",
        region: "QC",
        skillsTags: ["repit"],
        trainingEnrollments: {
          create: {
            courseVersion: "faba-v1",
            status: TrainingStatus.PASSED,
            completedAt: new Date(),
            certificate: {
              create: {
                certificateCode: "FAB-TEST-EXISTANT",
                participantName: "Certificat existant",
                courseTitle: "Formation des Alliés FAB",
                courseVersion: "faba-v1",
                scorePercent: 100
              }
            }
          }
        }
      },
      include: { trainingEnrollments: true }
    });

    expect(await trainingService.normalizeLegacyAssessmentStates()).toBeGreaterThanOrEqual(1);
    const migrated = await prisma.trainingEnrollment.findUniqueOrThrow({
      where: { id: legacyProfile.trainingEnrollments[0].id },
      include: { attempts: true, emailLogs: true }
    });
    expect(migrated.status).toBe(TrainingStatus.IN_PROGRESS);
    expect(migrated.attemptsResetAt).toBeTruthy();
    expect(migrated.attempts).toHaveLength(2);
    expect(migrated.attempts.some((attempt) => attempt.type === "QUIZ")).toBe(false);
    expect(migrated.emailLogs[0].status).toBe(TrainingEmailStatus.SKIPPED);
    expect(await trainingService.normalizeLegacyAssessmentStates()).toBe(0);

    const preserved = await prisma.trainingEnrollment.findUniqueOrThrow({
      where: { id: passedProfile.trainingEnrollments[0].id },
      include: { certificate: true }
    });
    expect(preserved.status).toBe(TrainingStatus.PASSED);
    expect(preserved.certificate?.certificateCode).toBe("FAB-TEST-EXISTANT");
  });

  it("traite J0, J3, J7 et J14 en mode simule sans doublon et ignore J3 apres le debut", async () => {
    const trainingService = app.get(TrainingService);
    await prisma.trainingEmailLog.updateMany({
      where: { status: TrainingEmailStatus.PENDING },
      data: { scheduledFor: new Date(Date.now() + 30 * 24 * 60 * 60_000) }
    });

    const reminderUser = await prisma.user.create({
      data: {
        email: "allie-relances@local.test",
        passwordHash: "hash",
        role: Role.RESOURCE,
        status: UserStatus.ACTIVE,
        emailVerifiedAt: new Date(),
        resourceProfile: {
          create: {
            displayName: "Allie Relances",
            postalCode: "H2X1Y4",
            city: "Montreal",
            region: "QC",
            skillsTags: ["repit"],
            contactEmail: "allie-relances@local.test"
          }
        }
      },
      include: { resourceProfile: true }
    });
    const { enrollment } = await trainingService.ensureEnrollment(reminderUser.resourceProfile!.id);
    await prisma.trainingEnrollment.update({
      where: { id: enrollment.id },
      data: { emailAutomationEnabledAt: new Date() }
    });
    await prisma.trainingEmailLog.updateMany({
      where: { enrollmentId: enrollment.id },
      data: { scheduledFor: new Date(Date.now() - 60_000) }
    });

    emailSendMock.mockClear();
    await trainingService.processDueEmails();
    expect(emailSendMock).toHaveBeenCalledTimes(4);
    const sentMessages = emailSendMock.mock.calls as unknown as Array<[{ to: string }]>;
    expect(sentMessages.map(([message]) => message.to)).toEqual([
      "allie-relances@local.test",
      "allie-relances@local.test",
      "allie-relances@local.test",
      "allie-relances@local.test"
    ]);
    expect(
      await prisma.trainingEmailLog.count({
        where: { enrollmentId: enrollment.id, status: TrainingEmailStatus.SENT }
      })
    ).toBe(4);

    await trainingService.processDueEmails();
    expect(emailSendMock).toHaveBeenCalledTimes(4);

    const startedUser = await prisma.user.create({
      data: {
        email: "allie-deja-commence@local.test",
        passwordHash: "hash",
        role: Role.RESOURCE,
        status: UserStatus.ACTIVE,
        emailVerifiedAt: new Date(),
        resourceProfile: {
          create: {
            displayName: "Allie Deja Commence",
            postalCode: "H2X1Y4",
            city: "Montreal",
            region: "QC",
            skillsTags: ["repit"],
            contactEmail: "allie-deja-commence@local.test"
          }
        }
      },
      include: { resourceProfile: true }
    });
    const started = await trainingService.ensureEnrollment(startedUser.resourceProfile!.id);
    await prisma.trainingEnrollment.update({
      where: { id: started.enrollment.id },
      data: { emailAutomationEnabledAt: new Date() }
    });
    const startedCourse = await trainingService.getMyCourse(startedUser.id);
    await trainingService.openLesson(startedUser.id, startedCourse.lessons[0].key);
    await prisma.trainingEmailLog.updateMany({
      where: { enrollmentId: started.enrollment.id },
      data: { scheduledFor: new Date(Date.now() + 30 * 24 * 60 * 60_000) }
    });
    await prisma.trainingEmailLog.update({
      where: {
        enrollmentId_type: {
          enrollmentId: started.enrollment.id,
          type: TrainingReminderType.DAY_3
        }
      },
      data: { scheduledFor: new Date(Date.now() - 60_000) }
    });

    await trainingService.processDueEmails();
    expect(emailSendMock).toHaveBeenCalledTimes(4);
    const day3 = await prisma.trainingEmailLog.findUniqueOrThrow({
      where: {
        enrollmentId_type: {
          enrollmentId: started.enrollment.id,
          type: TrainingReminderType.DAY_3
        }
      }
    });
    expect(day3.status).toBe(TrainingEmailStatus.SKIPPED);
  });

  it("garde les relances en attente tant que l'adresse de connexion n'est pas confirmée", async () => {
    const trainingService = app.get(TrainingService);
    await prisma.trainingEmailLog.updateMany({
      where: { status: TrainingEmailStatus.PENDING },
      data: { scheduledFor: new Date(Date.now() + 30 * 24 * 60 * 60_000) }
    });
    const user = await prisma.user.create({
      data: {
        email: "allie-relances-non-verifie@local.test",
        passwordHash: "hash",
        role: Role.RESOURCE,
        status: UserStatus.ACTIVE,
        resourceProfile: {
          create: {
            displayName: "Allié sans courriel vérifié",
            postalCode: "H2X1Y4",
            city: "Montreal",
            region: "QC",
            skillsTags: ["Tutorat"],
            contactEmail: "contact-public@local.test"
          }
        }
      },
      include: { resourceProfile: true }
    });
    const { enrollment } = await trainingService.ensureEnrollment(user.resourceProfile!.id);
    const adminToken = await loginAs("ADMIN");
    await request(app.getHttpServer())
      .post(`/api/v1/training/admin/enrollments/${enrollment.id}/emails/enable`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(400);
    await prisma.trainingEnrollment.update({
      where: { id: enrollment.id },
      data: { emailAutomationEnabledAt: new Date() }
    });
    await prisma.trainingEmailLog.updateMany({
      where: { enrollmentId: enrollment.id },
      data: { scheduledFor: new Date(Date.now() - 60_000) }
    });

    emailSendMock.mockClear();
    await trainingService.processDueEmails();

    expect(emailSendMock).not.toHaveBeenCalled();
    expect(
      await prisma.trainingEmailLog.count({
        where: { enrollmentId: enrollment.id, status: TrainingEmailStatus.PENDING, providerMessageId: null }
      })
    ).toBe(4);
  });

  it("bloque toutes les relances de formation sans bloquer les autres courriels FAB", async () => {
    const trainingService = app.get(TrainingService);
    const configService = app.get(ConfigService);
    const previousEnabled = configService.get<string>("ALLY_TRAINING_EMAILS_ENABLED", "false");
    const previousStartAt = configService.get<string>("ALLY_TRAINING_EMAILS_START_AT", "");
    configService.set("ALLY_TRAINING_EMAILS_ENABLED", "false");
    configService.set("ALLY_TRAINING_EMAILS_START_AT", "");

    try {
      await prisma.trainingEmailLog.updateMany({
        where: { status: TrainingEmailStatus.PENDING },
        data: { scheduledFor: new Date(Date.now() + 30 * 24 * 60 * 60_000) }
      });
      emailSendMock.mockClear();

      await request(app.getHttpServer())
        .post("/api/v1/auth/register")
        .send({
          email: "allie-courriels-pauses@local.test",
          password: "Bienvenue123!",
          role: Role.RESOURCE,
          displayName: "Allie Courriels Pauses",
          postalCode: "H2X1Y4",
          city: "Montreal",
          region: "QC",
          allyType: AllyType.GARDIENS,
          contactPhone: "514-555-1212",
          allyRegistration: validAllyRegistration()
        })
        .expect(201);

      // Les courriels transactionnels normaux (vérification, bienvenue et avis équipe) restent actifs.
      expect(emailSendMock).toHaveBeenCalledTimes(3);
      const enrollment = await prisma.trainingEnrollment.findFirstOrThrow({
        where: { resourceProfile: { user: { email: "allie-courriels-pauses@local.test" } } }
      });
      await prisma.trainingEnrollment.update({
        where: { id: enrollment.id },
        data: { emailAutomationEnabledAt: new Date() }
      });
      await prisma.trainingEmailLog.updateMany({
        where: { enrollmentId: enrollment.id },
        data: { scheduledFor: new Date(Date.now() - 60_000) }
      });

      await trainingService.processDueEmails();
      expect(emailSendMock).toHaveBeenCalledTimes(3);
      expect(
        await prisma.trainingEmailLog.count({
          where: { enrollmentId: enrollment.id, status: TrainingEmailStatus.PENDING, providerMessageId: null }
        })
      ).toBe(4);

      // Même une demande d'activation reste fail-closed sans date ISO valide.
      configService.set("ALLY_TRAINING_EMAILS_ENABLED", "true");
      configService.set("ALLY_TRAINING_EMAILS_START_AT", "");
      await trainingService.processDueEmails();
      expect(emailSendMock).toHaveBeenCalledTimes(3);
      expect(
        await prisma.trainingEmailLog.count({
          where: { enrollmentId: enrollment.id, status: TrainingEmailStatus.PENDING }
        })
      ).toBe(4);
    } finally {
      configService.set("ALLY_TRAINING_EMAILS_ENABLED", previousEnabled);
      configService.set("ALLY_TRAINING_EMAILS_START_AT", previousStartAt);
    }
  });

  it("verrouille les parcours par défaut et active seulement les alliés choisis", async () => {
    const trainingService = app.get(TrainingService);
    const configService = app.get(ConfigService);
    const previousEnabled = configService.get<string>("ALLY_TRAINING_EMAILS_ENABLED", "false");
    const previousStartAt = configService.get<string>("ALLY_TRAINING_EMAILS_START_AT", "");
    configService.set("ALLY_TRAINING_EMAILS_ENABLED", "false");
    configService.set("ALLY_TRAINING_EMAILS_START_AT", "2020-01-01T00:00:00.000Z");

    try {
      await prisma.trainingEmailLog.updateMany({
        where: { status: TrainingEmailStatus.PENDING },
        data: { scheduledFor: new Date(Date.now() + 30 * 24 * 60 * 60_000) }
      });
      const allies = await Promise.all(
        [
          ["allie-individuel-un@local.test", "Allié individuel un"],
          ["allie-individuel-deux@local.test", "Allié individuel deux"]
        ].map(async ([email, displayName]) => {
          const user = await prisma.user.create({
            data: {
              email,
              passwordHash: "hash",
              role: Role.RESOURCE,
              status: UserStatus.ACTIVE,
              emailVerifiedAt: new Date(),
              resourceProfile: {
                create: {
                  displayName,
                  postalCode: "H2X1Y4",
                  city: "Montreal",
                  region: "QC",
                  skillsTags: ["repit"],
                  contactEmail: email
                }
              }
            },
            include: { resourceProfile: true }
          });
          return (await trainingService.ensureEnrollment(user.resourceProfile!.id)).enrollment;
        })
      );
      expect(allies[0].emailAutomationEnabledAt).toBeNull();
      expect(allies[1].emailAutomationEnabledAt).toBeNull();

      await prisma.trainingEmailLog.updateMany({
        where: { enrollmentId: { in: allies.map((item) => item.id) } },
        data: { scheduledFor: new Date(Date.now() - 60_000) }
      });
      emailSendMock.mockClear();
      configService.set("ALLY_TRAINING_EMAILS_ENABLED", "true");
      await trainingService.processDueEmails();
      expect(emailSendMock).not.toHaveBeenCalled();

      const adminToken = await loginAs("ADMIN");
      const resourceToken = await loginAs("RESSOURCE");
      await request(app.getHttpServer())
        .post(`/api/v1/training/admin/enrollments/${allies[0].id}/emails/enable`)
        .set("Authorization", `Bearer ${resourceToken}`)
        .expect(403);

      configService.set("ALLY_TRAINING_EMAILS_ENABLED", "false");
      const enabled = await request(app.getHttpServer())
        .post(`/api/v1/training/admin/enrollments/${allies[0].id}/emails/enable`)
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(201);
      expect(enabled.body.changed).toBe(true);
      expect(enabled.body.emailAutomationEnabledAt).toEqual(expect.any(String));

      const enabledAgain = await request(app.getHttpServer())
        .post(`/api/v1/training/admin/enrollments/${allies[0].id}/emails/enable`)
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(201);
      expect(enabledAgain.body).toEqual({
        id: allies[0].id,
        emailAutomationEnabledAt: enabled.body.emailAutomationEnabledAt,
        changed: false
      });
      expect(
        await prisma.adminAuditLog.count({
          where: { targetId: allies[0].id, action: "ALLY_TRAINING_EMAILS_ENABLED" }
        })
      ).toBe(1);

      await trainingService.processDueEmails();
      expect(emailSendMock).not.toHaveBeenCalled();
      configService.set("ALLY_TRAINING_EMAILS_ENABLED", "true");
      await trainingService.processDueEmails();
      expect(emailSendMock).toHaveBeenCalledTimes(1);
      expect(emailSendMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ to: "allie-individuel-un@local.test" })
      );
      expect(
        await prisma.trainingEmailLog.count({
          where: { enrollmentId: allies[1].id, status: TrainingEmailStatus.SENT }
        })
      ).toBe(0);

      const paused = await request(app.getHttpServer())
        .post(`/api/v1/training/admin/enrollments/${allies[0].id}/emails/pause`)
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(201);
      expect(paused.body).toEqual({ id: allies[0].id, emailAutomationEnabledAt: null, changed: true });
      await prisma.trainingEmailLog.update({
        where: {
          enrollmentId_type: { enrollmentId: allies[0].id, type: TrainingReminderType.DAY_3 }
        },
        data: { scheduledFor: new Date(Date.now() - 60_000) }
      });
      await trainingService.processDueEmails();
      expect(emailSendMock).toHaveBeenCalledTimes(1);

      configService.set("ALLY_TRAINING_EMAILS_ENABLED", "false");
      const reenabled = await request(app.getHttpServer())
        .post(`/api/v1/training/admin/enrollments/${allies[0].id}/emails/enable`)
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(201);
      expect(reenabled.body.changed).toBe(true);
      const day3 = await prisma.trainingEmailLog.findUniqueOrThrow({
        where: {
          enrollmentId_type: { enrollmentId: allies[0].id, type: TrainingReminderType.DAY_3 }
        }
      });
      expect(day3.status).toBe(TrainingEmailStatus.PENDING);
      expect(day3.scheduledFor.getTime()).toBeGreaterThan(Date.now() + 2 * 24 * 60 * 60_000);

      await request(app.getHttpServer())
        .post(`/api/v1/training/admin/enrollments/${allies[1].id}/emails/enable`)
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(201);
      configService.set("ALLY_TRAINING_EMAILS_ENABLED", "true");
      await trainingService.processDueEmails();
      expect(emailSendMock).toHaveBeenCalledTimes(2);
      expect(emailSendMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ to: "allie-individuel-deux@local.test" })
      );

      const dashboard = await request(app.getHttpServer())
        .get("/api/v1/training/admin/enrollments?page=1&pageSize=5")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);
      expect(dashboard.body.emailAutomation).toEqual(
        expect.objectContaining({ individuallyEnabled: expect.any(Number), individuallyLocked: expect.any(Number) })
      );
    } finally {
      configService.set("ALLY_TRAINING_EMAILS_ENABLED", previousEnabled);
      configService.set("ALLY_TRAINING_EMAILS_START_AT", previousStartAt);
    }
  });

  it("recale les relances en attente depuis la date d'activation de facon idempotente", async () => {
    const trainingService = app.get(TrainingService);
    const configService = app.get(ConfigService);
    const previousEnabled = configService.get<string>("ALLY_TRAINING_EMAILS_ENABLED", "false");
    const previousStartAt = configService.get<string>("ALLY_TRAINING_EMAILS_START_AT", "");
    configService.set("ALLY_TRAINING_EMAILS_ENABLED", "false");
    configService.set("ALLY_TRAINING_EMAILS_START_AT", "");

    try {
      const user = await prisma.user.create({
        data: {
          email: "allie-activation@local.test",
          passwordHash: "hash",
          role: Role.RESOURCE,
          status: UserStatus.ACTIVE,
          resourceProfile: {
            create: {
              displayName: "Allie Activation",
              postalCode: "H2X1Y4",
              city: "Montreal",
              region: "QC",
              skillsTags: ["repit"],
              contactEmail: "allie-activation@local.test"
            }
          }
        },
        include: { resourceProfile: true }
      });
      const { enrollment } = await trainingService.ensureEnrollment(user.resourceProfile!.id);
      const startAt = new Date("2035-01-15T14:00:00.000Z");
      await prisma.trainingEnrollment.update({
        where: { id: enrollment.id },
        data: { emailAutomationEnabledAt: new Date("2035-01-01T14:00:00.000Z") }
      });
      configService.set("ALLY_TRAINING_EMAILS_START_AT", startAt.toISOString());

      const first = await trainingService.prepareEmailAutomation();
      expect(first.rescheduled).toBeGreaterThanOrEqual(4);
      const logs = await prisma.trainingEmailLog.findMany({
        where: { enrollmentId: enrollment.id },
        orderBy: { scheduledFor: "asc" }
      });
      expect(logs.map((log) => log.scheduledFor.toISOString())).toEqual([
        "2035-01-15T14:00:00.000Z",
        "2035-01-18T14:00:00.000Z",
        "2035-01-22T14:00:00.000Z",
        "2035-01-29T14:00:00.000Z"
      ]);

      const second = await trainingService.prepareEmailAutomation();
      expect(second.rescheduled).toBe(0);
      expect(await prisma.trainingEmailLog.count({ where: { enrollmentId: enrollment.id } })).toBe(4);
    } finally {
      configService.set("ALLY_TRAINING_EMAILS_ENABLED", previousEnabled);
      configService.set("ALLY_TRAINING_EMAILS_START_AT", previousStartAt);
    }
  });

  it("applique le verrou individuel aux confirmations de réussite et aux avis d'attention", async () => {
    const trainingService = app.get(TrainingService);
    await prisma.trainingEmailLog.updateMany({
      where: { status: TrainingEmailStatus.PENDING },
      data: { scheduledFor: new Date(Date.now() + 30 * 24 * 60 * 60_000) }
    });
    const enrollments = await Promise.all(
      [
        ["allie-succes-active@local.test", "Allié succès actif", TrainingStatus.PASSED, TrainingReminderType.SUCCESS],
        ["allie-attention-active@local.test", "Allié attention actif", TrainingStatus.ATTENTION_REQUIRED, TrainingReminderType.ATTENTION]
      ].map(async ([email, displayName, status, type]) => {
        const user = await prisma.user.create({
          data: {
            email,
            passwordHash: "hash",
            role: Role.RESOURCE,
            status: UserStatus.ACTIVE,
            emailVerifiedAt: new Date(),
            resourceProfile: {
              create: {
                displayName,
                postalCode: "H2X1Y4",
                city: "Montreal",
                region: "QC",
                skillsTags: ["repit"],
                contactEmail: email
              }
            }
          },
          include: { resourceProfile: true }
        });
        const { enrollment } = await trainingService.ensureEnrollment(user.resourceProfile!.id);
        await prisma.trainingEnrollment.update({
          where: { id: enrollment.id },
          data: { status: status as TrainingStatus, emailAutomationEnabledAt: new Date() }
        });
        await prisma.trainingEmailLog.upsert({
          where: { enrollmentId_type: { enrollmentId: enrollment.id, type: type as TrainingReminderType } },
          update: { status: TrainingEmailStatus.PENDING, scheduledFor: new Date(Date.now() - 60_000) },
          create: { enrollmentId: enrollment.id, type: type as TrainingReminderType, scheduledFor: new Date(Date.now() - 60_000) }
        });
        return enrollment.id;
      })
    );

    emailSendMock.mockClear();
    await trainingService.processDueEmails();
    expect(emailSendMock).toHaveBeenCalledTimes(2);
    const recipients = (emailSendMock.mock.calls as unknown as Array<[{ to: string }]>).map(([message]) => message.to);
    expect(recipients).toEqual(expect.arrayContaining(["allie-succes-active@local.test", "notifications@local.test"]));
    expect(
      await prisma.trainingEmailLog.count({
        where: {
          enrollmentId: { in: enrollments },
          type: { in: [TrainingReminderType.SUCCESS, TrainingReminderType.ATTENTION] },
          status: TrainingEmailStatus.SENT
        }
      })
    ).toBe(2);
  });

  it("ne relance pas les parcours reussis ou en attention requise", async () => {
    const trainingService = app.get(TrainingService);
    await prisma.trainingEmailLog.updateMany({
      where: { status: TrainingEmailStatus.PENDING },
      data: { scheduledFor: new Date(Date.now() + 30 * 24 * 60 * 60_000) }
    });
    const users = await Promise.all(
      [
        ["allie-passed-sans-relance@local.test", "Allie Passed Sans Relance", TrainingStatus.PASSED],
        ["allie-attention-sans-relance@local.test", "Allie Attention Sans Relance", TrainingStatus.ATTENTION_REQUIRED]
      ].map(async ([email, displayName, status]) => {
        const user = await prisma.user.create({
          data: {
            email,
            passwordHash: "hash",
            role: Role.RESOURCE,
            status: UserStatus.ACTIVE,
            resourceProfile: {
              create: { displayName, postalCode: "H2X1Y4", city: "Montreal", region: "QC", skillsTags: ["repit"], contactEmail: email }
            }
          },
          include: { resourceProfile: true }
        });
        const result = await trainingService.ensureEnrollment(user.resourceProfile!.id);
        await prisma.trainingEnrollment.update({
          where: { id: result.enrollment.id },
          data: { status: status as TrainingStatus, emailAutomationEnabledAt: new Date() }
        });
        await prisma.trainingEmailLog.updateMany({
          where: { enrollmentId: result.enrollment.id },
          data: { scheduledFor: new Date(Date.now() - 60_000) }
        });
        return result.enrollment.id;
      })
    );

    emailSendMock.mockClear();
    await trainingService.processDueEmails();
    expect(emailSendMock).not.toHaveBeenCalled();
    expect(
      await prisma.trainingEmailLog.count({
        where: { enrollmentId: { in: users }, status: TrainingEmailStatus.SKIPPED }
      })
    ).toBe(8);
  });

  it("protege les parcours personnels et reserve le tableau de bord aux administrateurs", async () => {
    const resourceToken = await loginAs("RESSOURCE");
    const familyToken = await loginAs("FAMILLE");
    const adminToken = await loginAs("ADMIN");

    const anonymous = await request(app.getHttpServer()).get("/api/v1/training/me");
    expect([401, 403]).toContain(anonymous.status);
    await request(app.getHttpServer())
      .get("/api/v1/training/me")
      .set("Authorization", `Bearer ${familyToken}`)
      .expect(403);
    await request(app.getHttpServer())
      .get("/api/v1/training/admin/enrollments")
      .set("Authorization", `Bearer ${resourceToken}`)
      .expect(403);
    await request(app.getHttpServer())
      .get("/api/v1/training/admin/enrollments")
      .set("Authorization", `Bearer ${familyToken}`)
      .expect(403);

    const ownCourse = await request(app.getHttpServer())
      .get("/api/v1/training/me")
      .set("Authorization", `Bearer ${resourceToken}`)
      .expect(200);
    const dashboard = await request(app.getHttpServer())
      .get("/api/v1/training/admin/enrollments?status=PASSED&page=1&pageSize=5")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    expect(dashboard.body.stats).toEqual(
      expect.objectContaining({ NOT_STARTED: expect.any(Number), IN_PROGRESS: expect.any(Number), PASSED: expect.any(Number) })
    );
    expect(dashboard.body.emailAutomation).toEqual(
      expect.objectContaining({ enabled: true, status: "ACTIVE", startAt: expect.any(String) })
    );
    expect(dashboard.body.items.some((item: { id: string }) => item.id === ownCourse.body.id)).toBe(true);

    await request(app.getHttpServer())
      .post(`/api/v1/training/admin/enrollments/${ownCourse.body.id}/reset-attempts`)
      .set("Authorization", `Bearer ${resourceToken}`)
      .expect(403);
    await request(app.getHttpServer())
      .get(`/api/v1/training/admin/enrollments/${ownCourse.body.id}/certificate`)
      .set("Authorization", `Bearer ${familyToken}`)
      .expect(403);
  });

  it("POST /api/v1/maintenance est reserve aux admins et met a jour le statut public", async () => {
    const adminToken = await loginAs("ADMIN");
    const familyToken = await loginAs("FAMILLE");

    await request(app.getHttpServer())
      .post("/api/v1/maintenance")
      .set("Authorization", `Bearer ${familyToken}`)
      .send({ enabled: true })
      .expect(403);

    const enabled = await request(app.getHttpServer())
      .post("/api/v1/maintenance")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ enabled: true })
      .expect(201);
    expect(enabled.body.enabled).toBe(true);

    const status = await request(app.getHttpServer()).get("/api/v1/maintenance/status").expect(200);
    expect(status.body.enabled).toBe(true);

    const disabled = await request(app.getHttpServer())
      .post("/api/v1/maintenance")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ enabled: false })
      .expect(201);
    expect(disabled.body.enabled).toBe(false);
  });

  it("GET /api/v1/dev/email-preview rend les templates connus et refuse les inconnus", async () => {
    const preview = await request(app.getHttpServer())
      .get("/api/v1/dev/email-preview/password-reset")
      .expect(200);

    expect(preview.headers["content-type"]).toContain("text/html");
    expect(preview.text).toContain("reset-password");

    await request(app.getHttpServer()).get("/api/v1/dev/email-preview/inconnu").expect(404);
  });

  async function loginAs(role: "ADMIN" | "FAMILLE" | "RESSOURCE") {
    const res = await request(app.getHttpServer()).post("/api/v1/dev/login-as").send({ role }).expect(201);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
    return res.body.accessToken as string;
  }
});

function refreshTokenFromSetCookie(res: { headers: Record<string, string | string[] | undefined> }): string | null {
  const raw = res.headers["set-cookie"];
  if (!raw) return null;
  const lines = Array.isArray(raw) ? raw : [raw];
  for (const line of lines) {
    const m = /^refresh_token=([^;]+)/.exec(line);
    if (m) return m[1];
  }
  return null;
}

function configureTestEnv() {
  process.env.NODE_ENV = "test";
  process.env.PORT = process.env.PORT ?? "3000";
  process.env.DEV_BYPASS_AUTH = "true";
  process.env.CORS_ORIGINS = "http://localhost:3000";
  process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? "test_access_secret_123";
  process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? "test_refresh_secret_123";
  process.env.JWT_ACCESS_EXPIRES_IN = "15m";
  process.env.JWT_REFRESH_EXPIRES_IN = "30d";
  process.env.STRIPE_SECRET_KEY = "sk_test_mock";
  process.env.STRIPE_RESOURCE_ONBOARDING_PRICE_ID = "price_resource_mock";
  process.env.STRIPE_FAMILY_SUBSCRIPTION_PRICE_ID = "price_family_mock";
  process.env.APP_FRONTEND_URL = "http://localhost:5173";
  process.env.ADMIN_EMAIL = "admin@fab.local";
  process.env.ADMIN_PASSWORD = "ChangeMe123!";
  process.env.NOTIFICATION_EMAIL = "notifications@local.test";
  process.env.ALLY_TRAINING_EMAILS_ENABLED = "true";
  process.env.ALLY_TRAINING_EMAILS_START_AT = "2020-01-01T00:00:00.000Z";
  process.env.RESOURCE_DOCUMENTS_DIR = join(process.cwd(), "tmp", "e2e-resource-documents");
  process.env.DATABASE_URL = withSchema(
    process.env.E2E_DATABASE_URL ??
      normalizeHostDatabaseUrl(
        process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/famille_accueil?schema=public"
      ),
    E2E_SCHEMA
  );
}

function normalizeHostDatabaseUrl(databaseUrl: string) {
  if (process.platform !== "win32") {
    return databaseUrl;
  }

  try {
    const url = new URL(databaseUrl);
    if (url.hostname === "postgres") {
      url.hostname = "localhost";
    }
    return url.toString();
  } catch {
    return databaseUrl;
  }
}

function withSchema(databaseUrl: string, schema: string) {
  if (databaseUrl.includes("schema=")) {
    return databaseUrl.replace(/schema=[^&]+/, `schema=${schema}`);
  }
  const separator = databaseUrl.includes("?") ? "&" : "?";
  return `${databaseUrl}${separator}schema=${schema}`;
}

function answersWithCorrectCount(correctAnswers: Record<string, number>, correctCount: number) {
  return Object.fromEntries(
    Object.entries(correctAnswers).map(([questionId, correctIndex], index) => [
      questionId,
      index < correctCount ? correctIndex : correctIndex === 0 ? 1 : 0
    ])
  );
}

function validAllyRegistration(
  overrides: {
    version?: string;
    hourlyRateSuggested?: string;
    rateType?: "HOURLY" | "FLAT";
    serviceDeliveryMode?: ResourceServiceDeliveryMode;
    repitNuit?: boolean;
    nightlyRateSuggested?: string;
    dailyRateSuggested?: string;
  } = {}
) {
  return {
    version: overrides.version ?? "2025-03-repit-v1",
    section1: {
      sectorServiced: "Montreal",
      streetAddress: "123 rue Test",
      contactEmail: "allie.contact@local.test",
      age18Confirmed: true
    },
    section2: {
      rcrValid: "yes",
      experienceChildren: "1_3",
      experienceParticularNeeds: false,
      experienceFoster: false,
      experienceTrauma: false,
      approachChildren: "Approche calme, fiable et respectueuse avec les enfants."
    },
    section3: {
      repitSoiree: true,
      repitNuit: overrides.repitNuit ?? false,
      repitWeekend: true,
      repitUrgence: false,
      age0_5: false,
      age6_12: true,
      age12p: true,
      maxChildren: "2",
      serviceRadius: "25",
      ...(overrides.serviceDeliveryMode ? { serviceDeliveryMode: overrides.serviceDeliveryMode } : {}),
      rateType: overrides.rateType ?? "HOURLY",
      hourlyRateSuggested: overrides.hourlyRateSuggested ?? "32",
      ...(overrides.nightlyRateSuggested
        ? { nightlyRateSuggested: overrides.nightlyRateSuggested }
        : {}),
      ...(overrides.dailyRateSuggested
        ? { dailyRateSuggested: overrides.dailyRateSuggested }
        : {}),
      dispoSemaine: true,
      dispoSoir: true,
      dispoWeekend: true,
      dispoFlexible: false
    },
    section4: {
      canProvideBackgroundCheck: true,
      canProvideTwoRefs: true,
      canProvideRcrProof: true,
      declNoBan: true,
      declNoInvestigation: true,
      declFalseStatement: true,
      declInfoAccurate: true,
      declIntermediary: true,
      declFinancialDirect: true,
      declProfileVisible: true
    }
  };
}

async function cleanDatabase(prisma: PrismaService) {
  await prisma.resourceDocument.deleteMany();
  await prisma.message.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.passwordResetToken.deleteMany();
  await prisma.adminAuditLog.deleteMany();
  await prisma.familyProfile.deleteMany();
  await prisma.resourceProfile.deleteMany();
  await prisma.user.deleteMany();
  await prisma.maintenanceState.deleteMany();
}

async function seedDevUsers(prisma: PrismaService) {
  await prisma.user.create({
    data: {
      email: "admin@local.test",
      passwordHash: "hash",
      role: Role.ADMIN,
      status: UserStatus.ACTIVE,
      emailVerifiedAt: new Date()
    }
  });

  const familyUser = await prisma.user.create({
    data: {
      email: "famille@local.test",
      passwordHash: "hash",
      role: Role.FAMILY,
      status: UserStatus.ACTIVE,
      emailVerifiedAt: new Date(),
      familyProfile: {
        create: {
          displayName: "Famille Locale",
          postalCode: "H2X1Y4",
          city: "Montreal",
          region: "QC",
          bio: "Profile e2e",
          needsTags: ["repit"]
        }
      }
    }
  });

  await prisma.subscription.create({
    data: {
      userId: familyUser.id,
      status: SubscriptionStatus.ACTIVE,
      stripeCustomerId: "cus_seed_family",
      stripeSubscriptionId: "sub_seed_family"
    }
  });

  await prisma.user.create({
    data: {
      email: "ressource@local.test",
      passwordHash: "hash",
      role: Role.RESOURCE,
      status: UserStatus.ACTIVE,
      emailVerifiedAt: new Date(),
      resourceProfile: {
        create: {
          displayName: "Ressource Locale",
          postalCode: "H2X1Y4",
          city: "Montreal",
          region: "QC",
          bio: "Profile e2e",
          skillsTags: ["Tutorat", "transport", "repit"],
          hourlyRate: 30,
          verificationStatus: ResourceVerificationStatus.VERIFIED,
          publishStatus: ResourcePublishStatus.PUBLISHED,
          onboardingState: ResourceOnboardingState.PUBLISHED,
          contactEmail: "ressource@local.test",
          contactPhone: "514-555-0000"
        }
      }
    }
  });

  return {
    familyUserId: familyUser.id
  };
}
