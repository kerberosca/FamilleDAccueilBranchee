import { INestApplication } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import { ThrottlerModule } from "@nestjs/throttler";
import { Prisma } from "@prisma/client";
import request from "supertest";
import { setupApp } from "../src/app.setup";
import { NewsletterModule } from "../src/modules/newsletter/newsletter.module";
import { CONSENT_TEXT } from "../src/modules/newsletter/newsletter.service";
import { PrismaService } from "../src/prisma/prisma.service";

describe("Infolettre FAB via l’API Cyberimpact", () => {
  let app: INestApplication;
  let now: number;
  let fetchMock: jest.SpyInstance;
  let clockMock: jest.SpyInstance;
  let config: ConfigService;
  let proofs: Map<string, any>;
  let member: { id: number; firstname: string } | null;
  let groups: string[];
  let writes: Array<{ path: string; body: any }>;
  const store = { create: jest.fn(), findUnique: jest.fn(), update: jest.fn() };
  const agent = "FAB-newsletter-e2e";
  const email = "test-newsletter@example.org";

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true, load: [() => ({
          CORS_ORIGINS: "http://localhost:3002", NEWSLETTER_ENABLED: "true",
          CYBERIMPACT_API_TOKEN: "test-only-token", CYBERIMPACT_LAUNCH_GROUP_ID: "57",
          CYBERIMPACT_CONGRESS_GROUP_ID: "58", NEWSLETTER_FORM_SECRET: "test-only-secret-with-at-least-32-characters",
          NEWSLETTER_TRUST_PROXY: "false"
        })] }),
        ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]), NewsletterModule
      ],
      providers: [{ provide: PrismaService, useValue: { newsletterConsent: store } }]
    }).overrideProvider(PrismaService).useValue({ newsletterConsent: store }).compile();
    app = module.createNestApplication(); setupApp(app); await app.init();
    config = app.get(ConfigService);
  });

  beforeEach(() => {
    now = Date.now(); clockMock = jest.spyOn(Date, "now").mockImplementation(() => now);
    proofs = new Map(); member = null; groups = []; writes = [];
    config.set("NEWSLETTER_ENABLED", "true");
    config.set("NEWSLETTER_TRUST_PROXY", "false");
    store.create.mockReset().mockImplementation(async ({ data }) => {
      if (proofs.has(data.requestId)) throw new Prisma.PrismaClientKnownRequestError("Duplicate", { code: "P2002", clientVersion: "5.22.0" });
      const proof = { id: `proof-${proofs.size + 1}`, ...data, status: "PENDING" };
      proofs.set(data.requestId, proof); return proof;
    });
    store.findUnique.mockReset().mockImplementation(async ({ where }) => proofs.get(where.requestId));
    store.update.mockReset().mockImplementation(async ({ where, data }) => {
      const proof = [...proofs.values()].find(p => p.id === where.id);
      Object.assign(proof, data); return proof;
    });
    fetchMock = jest.spyOn(global, "fetch").mockImplementation(async (input, options) => {
      const url = new URL(String(input)); const path = decodeURIComponent(url.pathname);
      const body = options?.body ? JSON.parse(String(options.body)) : undefined;
      expect(url.origin).toBe("https://api.cyberimpact.com");
      expect((options?.headers as Record<string, string>).Authorization).toBe("Bearer test-only-token");
      if (options?.method === "POST") writes.push({ path, body });
      if (path.startsWith("/members/unsubscribed/")) return json(404, {});
      if (path.endsWith("/groups") && options?.method === "GET") return json(200, { groups: groups.map(id => ({ id: Number(id) })) });
      if (path.endsWith("/groups") && options?.method === "POST") {
        groups.push(...body.groups.split(",")); return json(200, { groups: groups.map(id => ({ id: Number(id) })) });
      }
      if (path === "/members" && options?.method === "POST") {
        member = { id: 1001, firstname: body.firstname }; groups = body.groups.split(","); return json(201, member);
      }
      if (path.startsWith("/members/") && options?.method === "GET") return json(member ? 200 : 404, member);
      throw new Error("Unexpected API operation");
    });
  });
  afterEach(() => { fetchMock?.mockRestore(); clockMock?.mockRestore(); });
  afterAll(async () => { await app?.close(); });

  async function token(source = "site") {
    const response = await request(app.getHttpServer()).get(`/api/v1/newsletter/form?source=${source}`).set("User-Agent", agent).expect(200);
    expect(response.headers["cache-control"]).toBe("no-store"); expect(response.body.consentText).toBe(CONSENT_TEXT);
    now += 2000; return response.body.formToken as string;
  }
  function submit(formToken: string, extra: Record<string, unknown> = {}) {
    return request(app.getHttpServer()).post("/api/v1/newsletter/subscribe").set("User-Agent", agent)
      .send({ firstName: " Marie ", email: " TEST-NEWSLETTER@example.org ", source: "site", consent: true, website: "", formToken, ...extra });
  }

  it.each(["site", "congres"])("ajoute un contact depuis %s sans appeler opt-in ni un endpoint d’envoi", async source => {
    await submit(await token(source), { source }).expect(200, { subscribed: true });
    expect(writes).toHaveLength(1);
    expect(writes[0]).toMatchObject({ path: "/members", body: { email, firstname: "Marie", language: "fr_ca", groups: source === "site" ? "57" : "57,58" } });
    expect([...proofs.values()][0]).toMatchObject({ email, source, consentText: CONSENT_TEXT, status: "SYNCED", providerMemberId: "1001" });
  });
  it("conserve prénom et groupes existants, ajoute seulement le groupe congrès", async () => {
    member = { id: 2002, firstname: "Prénom existant" }; groups = ["12", "57"];
    await submit(await token("congres"), { source: "congres" }).expect(200);
    expect(writes).toEqual([{ path: `/members/${email}/groups`, body: { groups: "58" } }]);
    expect(member.firstname).toBe("Prénom existant"); expect(groups).toEqual(["12", "57", "58"]);
  });
  it("les inscriptions répétées ne relancent aucune mutation", async () => {
    const first = await token();
    await submit(first).expect(200); await submit(first).expect(200); await submit(await token()).expect(200);
    expect(writes).toHaveLength(1); expect(proofs.size).toBe(2);
    await submit(first, { email: "different@example.org" }).expect(409);
  });
  it("refuse une adresse désabonnée même si le corps de réponse est vide", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));
    await submit(await token()).expect(400);
    expect(writes).toHaveLength(0); expect([...proofs.values()][0].status).toBe("FAILED");
  });
  it.each([401, 429, 503])("signale une erreur Cyberimpact %s sans succès", async status => {
    fetchMock.mockResolvedValue(json(status, { message: "private provider detail" }));
    const response = await submit(await token()).expect(503);
    expect(response.body.subscribed).toBeUndefined(); expect(JSON.stringify(response.body)).not.toContain("private provider detail");
    expect([...proofs.values()][0].status).toBe("FAILED");
  });
  it("un délai réseau dépassé échoue sans annoncer une inscription", async () => {
    fetchMock.mockRejectedValue(new Error("network timeout"));
    await submit(await token()).expect(503); expect([...proofs.values()][0].status).toBe("FAILED");
  });
  it("si le journal ne peut pas être enregistré, aucune donnée n’est envoyée", async () => {
    store.create.mockRejectedValue(new Error("database down"));
    await submit(await token()).expect(503); expect(fetchMock).not.toHaveBeenCalled();
  });
  it("un nouvel essai après échec du journal ne crée pas de doublon Cyberimpact", async () => {
    store.update.mockRejectedValueOnce(new Error("database down"));
    await submit(await token()).expect(503); await submit(await token()).expect(200); expect(writes).toHaveLength(1);
  });
  it("gère une création simultanée sans écraser le contact", async () => {
    const original = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation(async (input, options) => {
      if (options?.method === "POST" && new URL(String(input)).pathname === "/members") {
        member = { id: 3003, firstname: "Créé ailleurs" }; groups = ["12"]; return json(400, {});
      }
      return original(input, options);
    });
    await submit(await token()).expect(200); expect(groups).toEqual(["12", "57"]);
  });
  it("bloque un formulaire altéré, expiré, trop rapide, d’une autre source ou rempli par un robot", async () => {
    const formToken = await token();
    await submit(`${formToken}x`).expect(400); await submit(formToken, { source: "congres" }).expect(400);
    await submit(formToken, { website: "robot.example.org" }).expect(400);
    await request(app.getHttpServer()).post("/api/v1/newsletter/subscribe").set("User-Agent", "different")
      .send({ firstName: "Marie", email, source: "site", consent: true, formToken }).expect(400);
    now -= 2000; await submit(formToken).expect(400); now += 31 * 60_000; await submit(formToken).expect(400);
    expect(fetchMock).not.toHaveBeenCalled(); expect(store.create).not.toHaveBeenCalled();
  });
  it("valide courriel, prénom, source et consentement côté serveur", async () => {
    const formToken = await token();
    await submit(formToken, { email: "invalid" }).expect(400); await submit(formToken, { firstName: "   " }).expect(400);
    await submit(formToken, { consent: false }).expect(400); await submit(formToken, { source: "unknown" }).expect(400);
    await submit(formToken, { groups: "999" }).expect(400); expect(fetchMock).not.toHaveBeenCalled();
  });
  it("reste fermé sans activation et ne divulgue pas la clé au navigateur", async () => {
    config.set("NEWSLETTER_ENABLED", "false");
    const response = await request(app.getHttpServer()).get("/api/v1/newsletter/form?source=site").expect(503);
    expect(JSON.stringify(response.body)).not.toContain("test-only-token"); expect(fetchMock).not.toHaveBeenCalled();
  });
  it("limite les soumissions excessives sans appeler Cyberimpact", async () => {
    config.set("NEWSLETTER_TRUST_PROXY", "true");
    const attempt = () => request(app.getHttpServer()).post("/api/v1/newsletter/subscribe")
      .set("X-Forwarded-For", "192.0.2.200")
      .send({ firstName: "Marie", email, source: "site", consent: true, formToken: "invalid" });
    for (let index = 0; index < 60; index++) await attempt().expect(400);
    await attempt().expect(429);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
