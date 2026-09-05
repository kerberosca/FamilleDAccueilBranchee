import { expect, test } from "@playwright/test";

test("distingue les deux courriels et récapitule une offre d'entretien forfaitaire", async ({ page }) => {
  await page.goto("/onboarding/resource");
  await expect(page.getByText("À préparer pour la prochaine étape")).toBeVisible();
  await expect(page.getByText("une attestation de vérification des antécédents", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Commencer" }).click();

  await expect(page.getByLabel("Adresse de connexion")).toBeVisible();
  await expect(page.getByText("Un lien de vérification sera envoyé à cette adresse.", { exact: false })).toBeVisible();
  await page.getByLabel("Adresse de connexion").fill("connexion.test@local.test");
  await page.getByPlaceholder("Mot de passe (8 car., majuscule, chiffre, spécial)").fill("Bienvenue123!");
  await page.getByRole("checkbox", { name: /Politique de confidentialité/ }).check();
  await page.getByRole("button", { name: "Suivant" }).click();

  await page.getByRole("button", { name: "Entretien Ménage" }).click();
  await page.getByPlaceholder("Nom complet").fill("Allié Entretien Test");
  await page.getByPlaceholder("Code postal").fill("H2X 1Y4");
  await page.getByPlaceholder("Ville").fill("Montréal");
  await page.getByRole("button", { name: "Suivant" }).click();

  await page.getByPlaceholder("Adresse postale complète").fill("123 rue Locale");
  await page.getByLabel("Téléphone de contact").fill("514-555-1111");
  await expect(page.getByText("Visible seulement aux familles abonnées après l'approbation", { exact: false }).first()).toBeVisible();
  await expect(page.getByLabel("Courriel de contact")).toBeVisible();
  await page.getByLabel("Courriel de contact").fill("contact.public@local.test");
  await page.getByRole("checkbox", { name: "Je confirme avoir 18 ans ou plus." }).check();
  await page.getByRole("button", { name: "Suivant" }).click();

  await page.getByLabel("Avez-vous une certification RCR / premiers secours de niveau C valide?").selectOption("in_progress");
  await page.getByPlaceholder("Décrivez brièvement votre approche...").fill("Une approche calme, fiable et respectueuse des besoins de chaque famille.");
  await page.getByRole("button", { name: "Suivant" }).click();

  await page.getByRole("checkbox", { name: "Entretien ménager régulier" }).check();
  await page.getByLabel("Type de tarif").selectOption("FLAT");
  await page.getByLabel("Montant forfaitaire suggéré ($)").fill("125");
  await page.getByRole("button", { name: "Suivant" }).click();

  await page.getByRole("checkbox", { name: /Vérification d'antécédents judiciaires valide/ }).check();
  await page.getByRole("checkbox", { name: "Deux références professionnelles *" }).check();
  const declarations = page.locator("label").filter({ hasText: /Je déclare|Je comprends|Je confirme que les informations|J'accepte que mon profil/ });
  for (const declaration of await declarations.all()) {
    await declaration.getByRole("checkbox").check();
  }
  await page.getByRole("button", { name: "Suivant" }).click();

  await expect(page.getByRole("heading", { name: "Récapitulatif" })).toBeVisible();
  await expect(page.getByText("Adresse de connexion : connexion.test@local.test")).toBeVisible();
  await expect(page.getByText("Courriel de contact : contact.public@local.test")).toBeVisible();
  await expect(page.getByText("Tarif forfaitaire suggéré : 125 $ forfaitaire")).toBeVisible();
  await expect(page.getByText("Nombre maximal d'enfants", { exact: false })).toHaveCount(0);
});

test("permet au tutorat à distance d'être offert partout au Québec", async ({ page }) => {
  await page.goto("/onboarding/resource");
  await page.getByRole("button", { name: "Commencer" }).click();

  await page.getByLabel("Adresse de connexion").fill("tutorat.distance@local.test");
  await page.getByPlaceholder("Mot de passe (8 car., majuscule, chiffre, spécial)").fill("Bienvenue123!");
  await page.getByRole("checkbox", { name: /Politique de confidentialité/ }).check();
  await page.getByRole("button", { name: "Suivant" }).click();

  await page.getByRole("button", { name: "Tutorat" }).click();
  await page.getByPlaceholder("Nom complet").fill("Tutorat Distance Test");
  await page.getByPlaceholder("Code postal").fill("G1V 2M2");
  await page.getByPlaceholder("Ville").fill("Québec");
  await page.getByRole("button", { name: "Suivant" }).click();

  await page.getByPlaceholder("Adresse postale complète").fill("123 rue Test");
  await page.getByLabel("Téléphone de contact").fill("418-555-1111");
  await page.getByLabel("Courriel de contact").fill("tutorat.contact@local.test");
  await page.getByRole("checkbox", { name: "Je confirme avoir 18 ans ou plus." }).check();
  await page.getByRole("button", { name: "Suivant" }).click();

  await page.getByLabel("Avez-vous une certification RCR / premiers secours de niveau C valide?").selectOption("no");
  await page.getByPlaceholder("Décrivez brièvement votre approche...").fill("Une approche pédagogique adaptée au rythme de chaque jeune.");
  await page.getByRole("button", { name: "Suivant" }).click();

  await page.getByLabel("Mode de prestation du tutorat").selectOption("REMOTE");
  await page.getByRole("checkbox", { name: "Aide aux devoirs" }).check();
  await page.getByLabel("Tarif horaire suggéré ($/h)").fill("35");
  await expect(page.getByText("Votre offre à distance sera présentée aux familles partout au Québec.")).toBeVisible();
  await expect(page.getByText("Secteur desservi (distance)")).toHaveCount(0);
  await page.getByRole("button", { name: "Suivant" }).click();

  await page.getByRole("checkbox", { name: /Vérification d'antécédents judiciaires valide/ }).check();
  await page.getByRole("checkbox", { name: "Deux références professionnelles *" }).check();
  const declarations = page.locator("label").filter({ hasText: /Je déclare|Je comprends|Je confirme que les informations|J'accepte que mon profil/ });
  for (const declaration of await declarations.all()) {
    await declaration.getByRole("checkbox").check();
  }
  await page.getByRole("button", { name: "Suivant" }).click();

  await expect(page.getByRole("heading", { name: "Récapitulatif" })).toBeVisible();
  await expect(page.getByText("Mode de prestation : À distance")).toBeVisible();
  await expect(page.getByText("Rayon de service", { exact: false })).toHaveCount(0);
});
