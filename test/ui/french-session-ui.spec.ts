import { expect, test } from "@playwright/test";

const API_ROOT = "http://127.0.0.1:3000/api/v1";

test("explique en français qu'une session a expiré", async ({ page }) => {
  await page.route(`${API_ROOT}/auth/refresh`, (route) =>
    route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ message: "Votre session est invalide ou a expiré." })
    })
  );

  await page.goto("/login?next=%2Fme%2Fformation&reason=session-expired");

  await expect(
    page.getByText("Votre session a expiré. Veuillez vous reconnecter pour poursuivre.")
  ).toBeVisible();
});
