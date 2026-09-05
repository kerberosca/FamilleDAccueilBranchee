import { expect, test } from "@playwright/test";

const API_ROOT = "http://127.0.0.1:3000/api/v1";

test("recherche le tutorat à distance sans présenter une limite géographique", async ({ page }) => {
  const requestedModes: string[] = [];
  await page.addInitScript(() => window.localStorage.setItem("fab-cookie-notice-seen", "1"));
  await page.route(`${API_ROOT}/search/resources**`, async (route) => {
    const url = new URL(route.request().url());
    requestedModes.push(url.searchParams.get("deliveryMode") ?? "");
    await route.fulfill({
      json: {
        totalFound: 1,
        page: 1,
        pageSize: 3,
        limitedPreview: true,
        results: [
          {
            id: "tuteur-distance-ui",
            displayName: "Tutorat à distance UI",
            city: "Québec",
            region: "QC",
            skillsTags: ["tutorat"],
            serviceDeliveryMode: "REMOTE"
          }
        ]
      }
    });
  });

  await page.goto("/search?postalCode=H2X1Y4&deliveryMode=REMOTE");

  await expect(page.getByLabel("Mode de prestation")).toHaveValue("REMOTE");
  await expect(page.getByText("sans restriction selon votre code postal", { exact: false })).toBeVisible();
  await expect(page.locator("p").filter({ hasText: /^Tutorat à distance$/ })).toBeVisible();
  await expect.poll(() => requestedModes).toContain("REMOTE");
});
