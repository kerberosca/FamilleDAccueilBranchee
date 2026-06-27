import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import {
  AllyType,
  BackgroundCheckStatus,
  ResourceDocumentType,
  ResourceOnboardingState,
  ResourcePublishStatus,
  ResourceVerificationStatus,
  Role,
  SubscriptionStatus,
  UserStatus
} from "@prisma/client";
import * as argon2 from "argon2";
import { execSync } from "node:child_process";
import request from "supertest";
import { setupApp } from "../src/app.setup";
import { AuthService } from "../src/modules/auth/auth.service";
import { StripeService } from "../src/modules/billing/stripe.service";
import { EmailService } from "../src/modules/email/email.service";
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

    const anonymous = await request(app.getHttpServer()).get("/api/v1/system-status");
    expect([401, 403]).toContain(anonymous.status);

    await request(app.getHttpServer())
      .get("/api/v1/system-status")
      .set("Authorization", `Bearer ${familyToken}`)
      .expect(403);

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
        allyRegistration: validAllyRegistration()
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

    await request(app.getHttpServer())
      .patch("/api/v1/profiles/resource/me")
      .set("Authorization", `Bearer ${token}`)
      .send({
        displayName: "Ressource Locale",
        allyRegistration: validAllyRegistration({ hourlyRateSuggested: "36" })
      })
      .expect(200);

    expect(emailSendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "ressource@local.test",
        subject: expect.stringContaining("profil allié"),
        html: expect.stringContaining("Vos modifications ont été enregistrées")
      })
    );
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

    expect(res.body.message).toBeDefined();
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

function validAllyRegistration(overrides: { hourlyRateSuggested?: string } = {}) {
  return {
    version: "2025-03-repit-v1",
    section1: {
      sectorServiced: "Montreal",
      streetAddress: "123 rue Test",
      contactEmail: "allie.contact@local.test",
      age18Confirmed: true
    },
    section2: {
      rcrValid: "yes",
      rcrLevelC: "yes",
      experienceChildren: "1_3",
      experienceParticularNeeds: false,
      experienceFoster: false,
      experienceTrauma: false,
      approachChildren: "Approche calme, fiable et respectueuse avec les enfants."
    },
    section3: {
      repitSoiree: true,
      repitNuit: false,
      repitWeekend: true,
      repitUrgence: false,
      age0_5: false,
      age6_12: true,
      age12p: true,
      maxChildren: "2",
      serviceRadius: "25",
      hourlyRateSuggested: overrides.hourlyRateSuggested ?? "32",
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
      status: UserStatus.ACTIVE
    }
  });

  const familyUser = await prisma.user.create({
    data: {
      email: "famille@local.test",
      passwordHash: "hash",
      role: Role.FAMILY,
      status: UserStatus.ACTIVE,
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
