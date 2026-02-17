import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { ResourceOnboardingState, ResourcePublishStatus, ResourceVerificationStatus, Role, SubscriptionStatus, UserStatus } from "@prisma/client";
import { execSync } from "node:child_process";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { setupApp } from "../src/app.setup";
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
  });

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

  it("GET /api/v1/search/resources avec famille premium inclut les contacts", async () => {
    const token = await loginAs("FAMILLE");
    const res = await request(app.getHttpServer())
      .get("/api/v1/search/resources?postalCode=H2X1Y4")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(res.body.results[0].contactEmail).toBe("ressource@local.test");
    expect(res.body.results[0].contactPhone).toBe("514-555-0000");
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

  async function loginAs(role: "ADMIN" | "FAMILLE" | "RESSOURCE") {
    const res = await request(app.getHttpServer()).post("/api/v1/dev/login-as").send({ role }).expect(201);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
    return res.body.accessToken as string;
  }
});

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
    process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/famille_accueil?schema=public",
    E2E_SCHEMA
  );
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
          skillsTags: ["transport", "repit"],
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
