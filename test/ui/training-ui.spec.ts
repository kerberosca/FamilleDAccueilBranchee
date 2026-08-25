import { expect, Page, test } from "@playwright/test";

const API_ROOT = "http://127.0.0.1:3000/api/v1";
const RESOURCE_TOKEN = "header.eyJyb2xlIjoiUkVTT1VSQ0UifQ.signature";

type LessonSummary = {
  key: string;
  number: number;
  title: string;
  summary: string;
  estimatedMinutes: number;
  completed: boolean;
  locked: boolean;
};

const lessonSummaries: LessonSummary[] = Array.from({ length: 8 }, (_, index) => ({
  key: `module-${index + 1}`,
  number: index + 1,
  title: `Module test ${index + 1}`,
  summary: `Résumé accessible du module ${index + 1}`,
  estimatedMinutes: 8,
  completed: false,
  locked: index > 0
}));

const quizQuestions = Array.from({ length: 13 }, (_, index) => ({
  id: `question-${index + 1}`,
  prompt: `Mise en situation ${index + 1}`,
  answers: ["Choix A", "Choix B", "Choix C"]
}));

function course(overrides: Record<string, unknown> = {}) {
  return {
    id: "training-e2e",
    title: "Formation des Alliés FAB",
    courseVersion: "faba-v1",
    status: "NOT_STARTED",
    progressPercent: 0,
    currentLessonKey: "module-1",
    attemptsUsed: 0,
    attemptsRemaining: 3,
    certificateAvailable: false,
    lessons: lessonSummaries,
    quizQuestions,
    ...overrides
  };
}

function lesson(number: number) {
  return {
    key: `module-${number}`,
    number,
    title: `Module test ${number}`,
    eyebrow: "Objectif du module",
    estimatedMinutes: 8,
    summary: `Résumé accessible du module ${number}`,
    ...(number === 1 ? { videoUrl: "https://player.vimeo.com/video/123" } : {}),
    sections: [
      {
        title: "Notion essentielle",
        paragraphs: ["Un contenu clair et lisible dans FAB."],
        bullets: ["Écouter avec bienveillance."],
        cards: [{ title: "Exemple", body: "Une mise en situation concrète." }],
        callout: "En cas de doute, communiquez avec l'équipe FAB."
      }
    ]
  };
}

async function prepareTrainingPage(page: Page, initialCourse = course()) {
  let currentCourse = initialCourse;

  await page.addInitScript(
    ({ token }) => {
      window.localStorage.setItem("fab.dev.access_token", token);
      window.localStorage.setItem("fab-cookie-notice-seen", "1");
    },
    { token: RESOURCE_TOKEN }
  );

  await page.route("https://player.vimeo.com/**", (route) =>
    route.fulfill({ status: 200, contentType: "text/html", body: "<html><body>Vidéo simulée</body></html>" })
  );
  await page.route(`${API_ROOT}/training/me`, (route) => route.fulfill({ json: currentCourse }));
  await page.route(`${API_ROOT}/training/me/quiz/submit`, async (route) => {
    const body = route.request().postDataJSON() as { answers?: Record<string, number> };
    if (Object.keys(body.answers ?? {}).length !== 13) {
      await route.fulfill({ status: 400, json: { message: "Répondez à toutes les questions avant de soumettre." } });
      return;
    }
    currentCourse = course({
      ...currentCourse,
      status: "PASSED",
      progressPercent: 100,
      attemptsUsed: 1,
      attemptsRemaining: 2,
      certificateAvailable: true
    });
    await route.fulfill({
      json: {
        passed: true,
        scorePercent: 100,
        attemptsRemaining: 2,
        feedback: [],
        certificateAvailable: true,
        certificateCode: "FAB-TEST-UI"
      }
    });
  });
  await page.route(`${API_ROOT}/training/me/certificate`, (route) =>
    route.fulfill({ status: 200, contentType: "application/pdf", body: Buffer.from("%PDF-1.4 test") })
  );
  await page.route(`${API_ROOT}/training/me/lessons/**`, async (route) => {
    const moduleNumber = Number(route.request().url().match(/module-(\d+)/)?.[1] ?? 1);
    if (route.request().method() === "PATCH") {
      currentCourse = course({
        status: "IN_PROGRESS",
        progressPercent: 13,
        currentLessonKey: "module-2",
        lessons: lessonSummaries.map((item) => ({
          ...item,
          completed: item.number === 1,
          locked: item.number > 2
        }))
      });
      await route.fulfill({ json: currentCourse });
      return;
    }
    await route.fulfill({ json: lesson(moduleNumber) });
  });

  await page.goto("/me/formation");
  await expect(page.getByRole("heading", { level: 1, name: "Comprendre et soutenir les familles d'accueil" })).toBeVisible();
}

test("affiche les 8 modules, la progression et la vidéo dans la mise en page FAB", async ({ page }) => {
  await prepareTrainingPage(page);

  await expect(page.getByRole("complementary", { name: "Modules de la formation" })).toBeVisible();
  await expect(page.getByRole("complementary", { name: "Modules de la formation" }).getByRole("button")).toHaveCount(8);
  await expect(page.getByText("Progression", { exact: true })).toBeVisible();
  await expect(page.getByText("0 %")).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Module test 1" })).toBeVisible();
  await expect(page.getByTitle("Présentation de la formation des alliés FAB")).toBeVisible();
  await expect(page.getByRole("button", { name: /Module test 1/ })).toBeEnabled();
  await expect(page.getByRole("button", { name: /Module test 2/ })).toBeDisabled();
  await expect(page.locator("h1")).toHaveCount(1);
});

test("permet de terminer un module uniquement au clavier", async ({ page }) => {
  await prepareTrainingPage(page);

  const finishButton = page.getByRole("button", { name: "Terminer ce module" });
  await page.locator("body").press("Tab");
  let reachedFinishButton = false;
  for (let step = 0; step < 20; step += 1) {
    reachedFinishButton = await finishButton.evaluate((button) => document.activeElement === button);
    if (reachedFinishButton) break;
    await page.keyboard.press("Tab");
  }
  expect(reachedFinishButton).toBe(true);

  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { level: 2, name: "Module test 2" })).toBeVisible();
  await expect(page.getByText("13 %")).toBeVisible();
});

test("reste utilisable sur mobile et présente les 13 questions avec des groupes accessibles", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const completedLessons = lessonSummaries.map((item) => ({ ...item, completed: true, locked: false }));
  await prepareTrainingPage(
    page,
    course({ status: "IN_PROGRESS", progressPercent: 100, lessons: completedLessons })
  );

  await expect(page.getByRole("heading", { level: 2, name: "13 questions" })).toBeVisible();
  await expect(page.getByRole("group")).toHaveCount(13);
  await expect(page.getByRole("button", { name: "Soumettre le test complet" })).toBeVisible();
  const layout = await page.evaluate(() => ({
    viewportWidth: document.documentElement.clientWidth,
    contentWidth: document.documentElement.scrollWidth
  }));
  expect(layout.contentWidth).toBeLessThanOrEqual(layout.viewportWidth + 1);
});

test("exige les 13 réponses puis affiche et télécharge le certificat après la réussite", async ({ page }) => {
  const completedLessons = lessonSummaries.map((item) => ({ ...item, completed: true, locked: false }));
  await prepareTrainingPage(
    page,
    course({ status: "IN_PROGRESS", progressPercent: 100, lessons: completedLessons })
  );

  const submit = page.getByRole("button", { name: "Soumettre le test complet" });
  await expect(submit).toBeDisabled();
  const groups = page.getByRole("group");
  for (let index = 0; index < 12; index += 1) {
    await groups.nth(index).getByRole("radio").first().check();
  }
  await expect(page.getByText("12/13 questions répondues")).toBeVisible();
  await expect(submit).toBeDisabled();

  await groups.nth(12).getByRole("radio").first().check();
  await expect(submit).toBeEnabled();
  await submit.click();
  await expect(page.getByRole("heading", { level: 2, name: "Formation réussie" })).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Télécharger mon certificat PDF" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("certificat-allie-fab.pdf");
});
