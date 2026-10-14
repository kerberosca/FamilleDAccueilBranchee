import { expect, test } from "@playwright/test";

const ADMIN_TOKEN = "header.eyJyb2xlIjoiQURNSU4ifQ.signature";

test("l'approbation individuelle avertit l'admin et garde les critères en attente visibles", async ({ page }) => {
  let published = false;
  let complete = false;
  const moderationRequests: Array<Record<string, unknown>> = [];

  await page.addInitScript((token) => {
    window.localStorage.setItem("fab.dev.access_token", token);
    window.localStorage.setItem("fab-cookie-notice-seen", "1");
  }, ADMIN_TOKEN);
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/users/me")) {
      await route.fulfill({ json: { id: "admin-ui", email: "admin@local.test", role: "ADMIN", status: "ACTIVE" } });
    } else if (path.endsWith("/maintenance/status")) {
      await route.fulfill({ json: { enabled: false, updatedAt: null } });
    } else if (path.endsWith("/system-status")) {
      await route.fulfill({ status: 500, json: { message: "Indisponible" } });
    } else if (path.includes("/users/families") || path.endsWith("/users/admin/audit")) {
      await route.fulfill({ json: { total: 0, page: 1, pageSize: 10, totalPages: 1, items: [] } });
    } else if (path.endsWith("/profiles/resources/admin")) {
      await route.fulfill({ json: {
        total: 1, page: 1, pageSize: 10, totalPages: 1,
        items: [{
          id: "ally-incomplete", displayName: "Alliée Incomplète", city: "Québec", region: "QC", postalCode: "G1V2M2",
          verificationStatus: published ? "VERIFIED" : "PENDING_VERIFICATION",
          publishStatus: published ? "PUBLISHED" : "HIDDEN",
          onboardingState: published ? "PUBLISHED" : "PENDING_VERIFICATION",
          backgroundCheckStatus: "REQUESTED", trainingStatus: complete ? "PASSED" : "IN_PROGRESS",
          documentRequirements: { required: ["BACKGROUND_CHECK", "RCR_PROOF"], missing: complete ? [] : ["BACKGROUND_CHECK", "RCR_PROOF"], complete },
          serviceDeliveryMode: "IN_PERSON", isInternalTest: false,
          user: { id: "user-incomplete", email: "ally@local.test", emailVerified: true, status: "ACTIVE", role: "RESOURCE" }
        }]
      } });
    } else if (path.endsWith("/profiles/resource/ally-incomplete/moderation")) {
      moderationRequests.push(route.request().postDataJSON() as Record<string, unknown>);
      published = true;
      await route.fulfill({ json: { id: "ally-incomplete", publishStatus: "PUBLISHED" } });
    } else {
      await route.fulfill({ status: 404, json: { message: "Route simulée inconnue" } });
    }
  });

  await page.goto("/admin");
  await page.getByRole("button", { name: "Alliés", exact: true }).click();
  const approve = page.getByRole("button", { name: "Approuver + publier" });
  await expect(approve).toBeEnabled();

  page.once("dialog", async (dialog) => {
    expect(dialog.message()).toContain("Antécédents");
    expect(dialog.message()).toContain("Preuve RCR");
    expect(dialog.message()).toContain("formation non réussie (en cours)");
    expect(dialog.message()).toContain("visible des familles");
    await dialog.dismiss();
  });
  await approve.click();
  expect(moderationRequests).toHaveLength(0);

  page.once("dialog", async (dialog) => dialog.accept());
  await approve.click();
  await expect.poll(() => moderationRequests.length).toBe(1);
  expect(moderationRequests[0]).toMatchObject({ overrideRequirements: true, publishStatus: "PUBLISHED" });

  await page.getByRole("button", { name: "Alliés", exact: true }).click();
  await expect(page.getByText(/Approuvé avec critères en attente/)).toBeVisible();
  complete = true;
  await page.getByRole("button", { name: "Rafraîchir" }).click();
  await expect(page.getByText(/Approuvé avec critères en attente/)).toHaveCount(0);
});

test("l'approbation groupée avertit seulement des dossiers incomplets", async ({ page }) => {
  const bulkRequests: Array<Record<string, unknown>> = [];

  await page.addInitScript((token) => {
    window.localStorage.setItem("fab.dev.access_token", token);
    window.localStorage.setItem("fab-cookie-notice-seen", "1");
  }, ADMIN_TOKEN);
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/users/me")) {
      await route.fulfill({ json: { id: "admin-ui", email: "admin@local.test", role: "ADMIN", status: "ACTIVE" } });
    } else if (path.endsWith("/maintenance/status")) {
      await route.fulfill({ json: { enabled: false, updatedAt: null } });
    } else if (path.endsWith("/system-status")) {
      await route.fulfill({ status: 500, json: { message: "Indisponible" } });
    } else if (path.includes("/users/families") || path.endsWith("/users/admin/audit")) {
      await route.fulfill({ json: { total: 0, page: 1, pageSize: 10, totalPages: 1, items: [] } });
    } else if (path.endsWith("/profiles/resources/admin")) {
      await route.fulfill({ json: {
        total: 2, page: 1, pageSize: 10, totalPages: 1,
        items: [
          { id: "ally-complete", displayName: "Allié Complet", trainingStatus: "PASSED", documentRequirements: { required: ["BACKGROUND_CHECK"], missing: [], complete: true } },
          { id: "ally-incomplete", displayName: "Alliée Incomplète", trainingStatus: "NOT_STARTED", documentRequirements: { required: ["BACKGROUND_CHECK"], missing: ["BACKGROUND_CHECK"], complete: false } }
        ].map((item) => ({
          ...item, city: "Québec", region: "QC", postalCode: "G1V2M2",
          verificationStatus: "PENDING_VERIFICATION", publishStatus: "HIDDEN", onboardingState: "PENDING_VERIFICATION",
          backgroundCheckStatus: "REQUESTED", serviceDeliveryMode: "IN_PERSON", isInternalTest: false,
          user: { id: `user-${item.id}`, email: `${item.id}@local.test`, emailVerified: true, status: "ACTIVE", role: "RESOURCE" }
        }))
      } });
    } else if (path.endsWith("/profiles/resources/moderation/bulk")) {
      bulkRequests.push(route.request().postDataJSON() as Record<string, unknown>);
      await route.fulfill({ json: { updatedCount: 2 } });
    } else {
      await route.fulfill({ status: 404, json: { message: "Route simulée inconnue" } });
    }
  });

  await page.goto("/admin");
  await page.getByRole("button", { name: "Alliés", exact: true }).click();
  await page.getByText("Allié Complet", { exact: false }).locator("xpath=ancestor::label[1]").getByRole("checkbox").check();
  await page.getByText("Alliée Incomplète", { exact: false }).locator("xpath=ancestor::label[1]").getByRole("checkbox").check();

  page.once("dialog", async (dialog) => {
    expect(dialog.message()).toContain("Alliée Incomplète");
    expect(dialog.message()).toContain("Antécédents");
    expect(dialog.message()).not.toContain("Allié Complet :");
    await dialog.accept();
  });
  await page.getByRole("button", { name: "Approuver sélection (2)" }).click();
  await expect.poll(() => bulkRequests.length).toBe(1);
  expect(bulkRequests[0]).toMatchObject({
    resourceIds: ["ally-complete", "ally-incomplete"],
    publishStatus: "PUBLISHED",
    overrideRequirements: true
  });
});
