export function assertDemoModeIsolation(env: NodeJS.ProcessEnv) {
  if (env.DEMO_MODE !== "true") return;

  let databaseName = "";
  let frontendHost = "";
  try {
    databaseName = new URL(env.DATABASE_URL ?? "").pathname;
    frontendHost = new URL(env.APP_FRONTEND_URL ?? "").hostname;
  } catch {
    throw new Error("Configuration démo invalide : URL de base de données ou du frontend manquante.");
  }

  if (databaseName !== "/fab_demo") {
    throw new Error("La démo exige une base de données distincte nommée fab_demo.");
  }
  if (env.NODE_ENV === "production" && frontendHost !== "demo.familledaccueilbranchee.ca") {
    throw new Error("La démo en production exige le sous-domaine demo.familledaccueilbranchee.ca.");
  }
  if (
    env.STRIPE_BILLING_MODE !== "DISABLED" ||
    env.STRIPE_CHECKOUT_ENABLED !== "false" ||
    env.EMAIL_DELIVERY_MODE !== "log" ||
    env.DEV_BYPASS_AUTH !== "false" ||
    Boolean(env.N8N_ALLY_WEBHOOK_URL)
  ) {
    throw new Error("La démo exige Stripe, les courriels, le contournement dev et les webhooks sortants désactivés.");
  }
}
