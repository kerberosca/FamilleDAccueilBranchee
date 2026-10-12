import { expect, test } from "@playwright/test";

const consentText = "En cliquant sur « Je m’inscris », je consens à recevoir par courriel les nouvelles de FAB et les détails de son lancement, envoyés par Forméduc (Famille d’accueil branchée). Je peux me désabonner en tout temps grâce au lien dans chaque courriel.";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem("fab-cookie-notice-seen", "1"));
  await page.route("**/newsletter/form?source=*", route => route.fulfill({ json: {
    formToken: "test-ui-token", consentText, consentVersion: "fab-infolettre-2026-10-12"
  } }));
});

test("l’infolettre reste l’action principale et présente deux champs", async ({ page }) => {
  await page.goto("/");
  const hero = page.locator("main section").first();
  await expect(hero.getByRole("link", { name: "Soyez informé du lancement" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Infolettre" }).first()).toHaveAttribute("href", "/infolettre");
  await hero.getByRole("link", { name: "Soyez informé du lancement" }).click();
  await expect(page).toHaveURL(/\/infolettre$/);
  await expect(page.getByLabel("Prénom", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Adresse courriel", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Politique de confidentialité", exact: true }).first()).toHaveAttribute("href", "/confidentialite");
  await expect(page.locator("main iframe")).toHaveCount(0);
});

for (const source of ["site", "congres"]) {
  test(`inscription ${source} : succès confirmé et une seule demande`, async ({ page }) => {
    const sent: unknown[] = [];
    await page.route("**/newsletter/subscribe", async route => {
      sent.push(route.request().postDataJSON());
      await route.fulfill({ json: { subscribed: true } });
    });
    await page.goto(source === "site" ? "/infolettre" : "/infolettre/congres");
    await page.getByLabel("Prénom", { exact: true }).fill("Marie");
    await page.getByLabel("Adresse courriel", { exact: true }).fill("test-ui@example.org");
    const button = page.getByRole("button", { name: "Je m’inscris", exact: true });
    await expect(button).toBeEnabled();
    await button.dblclick();
    await expect(page.getByRole("status")).toContainText("Votre inscription à l’infolettre est enregistrée");
    expect(sent).toEqual([{ firstName: "Marie", email: "test-ui@example.org", website: "", source, consent: true, formToken: "test-ui-token" }]);
  });
}

test("un échec garde les coordonnées et permet de réessayer sans faux succès", async ({ page }) => {
  let attempts = 0;
  await page.route("**/newsletter/subscribe", route => {
    attempts++;
    return route.fulfill(attempts === 1
      ? { status: 503, json: { message: "L’inscription est temporairement indisponible." } }
      : { json: { subscribed: true } });
  });
  await page.goto("/infolettre");
  await page.getByLabel("Prénom", { exact: true }).fill("Marie");
  await page.getByLabel("Adresse courriel", { exact: true }).fill("test-ui@example.org");
  const button = page.getByRole("button", { name: "Je m’inscris", exact: true });
  await expect(button).toBeEnabled(); await button.click();
  await expect(page.getByRole("form").getByRole("alert")).toContainText("temporairement indisponible");
  await expect(page.getByText("Votre inscription à l’infolettre est enregistrée", { exact: false })).toHaveCount(0);
  await expect(page.getByLabel("Adresse courriel", { exact: true })).toHaveValue("test-ui@example.org");
  await expect(button).toBeEnabled(); await button.click();
  await expect(page.getByRole("status")).toContainText("Votre inscription à l’infolettre est enregistrée");
});

test("une adresse désabonnée affiche les instructions de réinscription", async ({ page }) => {
  await page.route("**/newsletter/subscribe", route => route.fulfill({ status: 400, json: {
    message: "Cette adresse ne peut pas être inscrite directement. Écrivez à info@familledaccueilbranchee.ca pour vous réinscrire."
  } }));
  await page.goto("/infolettre/congres");
  await page.getByLabel("Prénom", { exact: true }).fill("Marie");
  await page.getByLabel("Adresse courriel", { exact: true }).fill("test-ui@example.org");
  const button = page.getByRole("button", { name: "Je m’inscris", exact: true });
  await expect(button).toBeEnabled(); await button.click();
  await expect(page.getByRole("form").getByRole("alert")).toContainText("pour vous réinscrire");
});

test("affichage mobile et chargement indisponible", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/newsletter/form?source=*", route => route.fulfill({ status: 503, json: {} }));
  await page.goto("/infolettre/congres");
  await expect(page.getByText("FAB au congrès")).toBeVisible();
  await expect(page.getByRole("form").getByRole("alert")).toContainText("temporairement indisponible");
  await expect(page.getByRole("button", { name: "Je m’inscris", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Réessayer de charger le formulaire" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
