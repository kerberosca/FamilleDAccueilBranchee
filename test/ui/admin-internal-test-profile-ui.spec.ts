import { expect, test } from "@playwright/test";

const API_ROOT = "http://127.0.0.1:3000/api/v1";
const ADMIN_TOKEN = "header.eyJyb2xlIjoiQURNSU4ifQ.signature";

test("un administrateur peut identifier un profil test qui devient non publiable", async ({ page }) => {
  let isInternalTest = false;
  const statusRequests: boolean[] = [];

  await page.addInitScript(
    ({ token }) => {
      window.localStorage.setItem("fab.dev.access_token", token);
      window.localStorage.setItem("fab-cookie-notice-seen", "1");
    },
    { token: ADMIN_TOKEN }
  );
  await page.route(`${API_ROOT}/**`, async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    if (path.endsWith("/users/me")) {
      await route.fulfill({ json: { id: "admin-ui", email: "admin@local.test", role: "ADMIN", status: "ACTIVE" } });
      return;
    }
    if (path.endsWith("/maintenance/status")) {
      await route.fulfill({ json: { enabled: false, updatedAt: null } });
      return;
    }
    if (path.endsWith("/system-status")) {
      await route.fulfill({ status: 500, json: { message: "État simulé indisponible" } });
      return;
    }
    if (path.includes("/users/families")) {
      await route.fulfill({ json: { total: 0, page: 1, pageSize: 10, totalPages: 1, items: [] } });
      return;
    }
    if (path.endsWith("/profiles/resource/resource-test-ui/internal-test")) {
      const body = route.request().postDataJSON() as { isInternalTest: boolean };
      isInternalTest = body.isInternalTest;
      statusRequests.push(body.isInternalTest);
      await route.fulfill({
        json: {
          id: "resource-test-ui",
          isInternalTest,
          changed: true,
          verificationStatus: "PENDING_VERIFICATION",
          publishStatus: "HIDDEN",
          onboardingState: "PENDING_VERIFICATION"
        }
      });
      return;
    }
    if (path.endsWith("/profiles/resources/admin")) {
      await route.fulfill({
        json: {
          total: 1,
          page: 1,
          pageSize: 10,
          totalPages: 1,
          items: [
            {
              id: "resource-test-ui",
              displayName: "Testeuse FAB",
              city: "Québec",
              region: "QC",
              postalCode: "G1V2M2",
              verificationStatus: isInternalTest ? "PENDING_VERIFICATION" : "VERIFIED",
              publishStatus: isInternalTest ? "HIDDEN" : "PUBLISHED",
              onboardingState: isInternalTest ? "PENDING_VERIFICATION" : "PUBLISHED",
              backgroundCheckStatus: "RECEIVED",
              trainingStatus: "PASSED",
              documentRequirements: { required: ["BACKGROUND_CHECK"], missing: [], complete: true },
              allyDeclarationsAcceptedAt: "2026-09-05T12:00:00.000Z",
              serviceDeliveryMode: "REMOTE",
              isInternalTest,
              user: { id: "user-test-ui", email: "testeuse@local.test", status: "ACTIVE", role: "RESOURCE" }
            }
          ]
        }
      });
      return;
    }
    await route.fulfill({ status: 404, json: { message: "Route simulée inconnue" } });
  });

  await page.goto("/admin");
  await page.getByRole("button", { name: "Alliés", exact: true }).click();
  await page.getByLabel("Type de profil allié").selectOption("all");
  await expect(page.getByText("Testeuse FAB", { exact: false })).toBeVisible();

  page.once("dialog", async (dialog) => {
    expect(dialog.message()).toContain("ne pourra pas être validé ni publié");
    await dialog.accept();
  });
  await page.getByRole("button", { name: "Marquer comme test interne" }).click();

  await expect(page.getByText("Test interne", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Approuver + publier" })).toBeDisabled();
  expect(statusRequests).toEqual([true]);
});
