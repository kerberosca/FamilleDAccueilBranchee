import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { ResourceOnboardingState, ResourcePublishStatus, ResourceVerificationStatus, Role, SubscriptionStatus, UserStatus } from "@prisma/client";
import { execSync } from "node:child_process";
import request from "supertest";
import { setupApp } from "../src/app.setup";
import { AuthService } from "../src/modules/auth/auth.service";
import { StripeService } from "../src/modules/billing/stripe.service";
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

    await request(app.getHttpServer()).post("/api/v1/billing/stripe/webhook").send(webhookPayload).expect(201);

    const createdSub = await prisma.subscription.findUnique({
      where: { stripeSubscriptionId: "sub_test_123" }
    });
    expect(createdSub?.status).toBe(SubscriptionStatus.ACTIVE);
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

async function cleanDatabase(prisma: PrismaService) {
  await prisma.message.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.familyProfile.deleteMany();
  await prisma.resourceProfile.deleteMany();
  await prisma.user.deleteMany();
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
