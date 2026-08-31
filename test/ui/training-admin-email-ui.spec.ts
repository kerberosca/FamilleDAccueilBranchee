import { expect, test } from "@playwright/test";

const API_ROOT = "http://127.0.0.1:3000/api/v1";
const ADMIN_TOKEN = "header.eyJyb2xlIjoiQURNSU4ifQ.signature";

test("confirme l'adresse puis active et met en pause les courriels d'un seul allié", async ({ page }) => {
  let enabledAt: string | null = null;
  const requestedActions: string[] = [];

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
    if (path.endsWith("/training/admin/enrollments/training-ui/emails/enable")) {
      requestedActions.push("enable");
      enabledAt = new Date().toISOString();
      await route.fulfill({ json: { id: "training-ui", emailAutomationEnabledAt: enabledAt, changed: true } });
      return;
    }
    if (path.endsWith("/training/admin/enrollments/training-ui/emails/pause")) {
      requestedActions.push("pause");
      enabledAt = null;
      await route.fulfill({ json: { id: "training-ui", emailAutomationEnabledAt: null, changed: true } });
      return;
    }
    if (path.endsWith("/training/admin/enrollments")) {
      await route.fulfill({
        json: {
          total: 1,
          page: 1,
          pageSize: 20,
          totalPages: 1,
          stats: { NOT_STARTED: 1, IN_PROGRESS: 0, EXAM_AVAILABLE: 0, PASSED: 0, ATTENTION_REQUIRED: 0 },
          emailAutomation: {
            enabled: true,
            status: "ACTIVE",
            startAt: "2026-08-31T12:00:00.000Z",
            individuallyEnabled: enabledAt ? 1 : 0,
            individuallyLocked: enabledAt ? 0 : 1
          },
          items: [
            {
              id: "training-ui",
              status: "NOT_STARTED",
              displayName: "Allié Test Courriel",
              email: "allie.test@local.test",
              publishStatus: "HIDDEN",
              progressPercent: 0,
              completedLessons: 0,
              assignedAt: "2026-08-31T12:00:00.000Z",
              lastActivityAt: null,
              completedAt: null,
              emailVerified: true,
              emailAutomationEnabledAt: enabledAt,
              attemptsUsed: 0,
              attemptsRemaining: 3,
              overdue: false,
              certificateAvailable: false,
              nextReminder: enabledAt,
              attempts: [],
              emailLogs: [
                {
                  type: "ASSIGNMENT",
                  status: "PENDING",
                  scheduledFor: enabledAt ?? "2026-08-31T12:00:00.000Z",
                  sentAt: null,
                  retryCount: 0,
                  lastError: null
                }
              ]
            }
          ]
        }
      });
      return;
    }
    await route.fulfill({ status: 404, json: { message: "Route simulée inconnue" } });
  });

  await page.goto("/admin");
  await page.getByRole("button", { name: "Parcours alliés" }).click();
  await expect(page.getByText("Courriels verrouillés", { exact: true })).toBeVisible();

  page.once("dialog", async (dialog) => {
    expect(dialog.message()).toContain("Allié : Allié Test Courriel");
    expect(dialog.message()).toContain("Adresse de connexion : allie.test@local.test");
    await dialog.accept();
  });
  await page.getByRole("button", { name: "Activer les courriels" }).click();
  await expect(page.getByText("Courriels activés", { exact: true })).toBeVisible();
  expect(requestedActions).toEqual(["enable"]);

  page.once("dialog", async (dialog) => {
    expect(dialog.message()).toContain("Mettre les courriels de formation en pause?");
    expect(dialog.message()).toContain("Adresse de connexion : allie.test@local.test");
    await dialog.accept();
  });
  await page.getByRole("button", { name: "Mettre en pause" }).click();
  await expect(page.getByText("Courriels verrouillés", { exact: true })).toBeVisible();
  expect(requestedActions).toEqual(["enable", "pause"]);
});
