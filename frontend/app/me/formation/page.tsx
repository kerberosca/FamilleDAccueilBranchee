"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { RequireAuth } from "../../../components/require-auth";
import { Alert } from "../../../components/ui/alert";
import { Button } from "../../../components/ui/button";
import { API_BASE, apiGet, apiPatch, apiPost } from "../../../lib/api";
import { useAuth } from "../../../lib/auth-context";

type LessonSummary = {
  key: string;
  number: number;
  title: string;
  summary: string;
  estimatedMinutes: number;
  completed: boolean;
  locked: boolean;
};

type PublicQuestion = { id: string; prompt: string; answers: string[] };

type Course = {
  id: string;
  title: string;
  courseVersion: string;
  status: string;
  progressPercent: number;
  currentLessonKey: string;
  attemptsUsed: number;
  attemptsRemaining: number;
  certificateAvailable: boolean;
  lessons: LessonSummary[];
  quizQuestions: PublicQuestion[];
};

type Lesson = {
  key: string;
  number: number;
  title: string;
  eyebrow: string;
  estimatedMinutes: number;
  summary: string;
  videoUrl?: string;
  sections: {
    title: string;
    paragraphs?: string[];
    bullets?: string[];
    cards?: { title: string; body: string }[];
    callout?: string;
  }[];
};

type QuizResult = {
  passed: boolean;
  scorePercent: number;
  attemptsRemaining: number;
  feedback: { questionId: string; explanation: string }[];
  attentionRequired?: boolean;
  certificateAvailable?: boolean;
  certificateCode?: string;
};

const STATUS_LABELS: Record<string, string> = {
  NOT_STARTED: "À commencer",
  IN_PROGRESS: "En cours",
  EXAM_AVAILABLE: "En cours",
  PASSED: "Formation réussie",
  ATTENTION_REQUIRED: "Intervention de l'équipe requise"
};

export default function AllyTrainingPage() {
  const { accessToken } = useAuth();
  const [course, setCourse] = useState<Course | null>(null);
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, number>>({});
  const [quizResult, setQuizResult] = useState<QuizResult | null>(null);

  const allLessonsComplete = Boolean(course?.lessons.every((item) => item.completed));
  const currentSummary = useMemo(
    () => course?.lessons.find((item) => item.key === lesson?.key) ?? null,
    [course, lesson]
  );

  useEffect(() => {
    if (!accessToken) return;
    void loadCourse(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  const loadCourse = async (openCurrent = false) => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const next = await apiGet<Course>("/training/me", { token: accessToken });
      setCourse(next);
      if (openCurrent && next.status !== "PASSED") {
        const requested = next.lessons.find((item) => item.key === next.currentLessonKey && !item.locked) ?? next.lessons.find((item) => !item.locked);
        if (requested) await openLesson(requested.key, next);
      }
    } catch (caught) {
      setError(toMessage(caught));
    } finally {
      setLoading(false);
    }
  };

  const openLesson = async (lessonKey: string, knownCourse = course) => {
    if (!accessToken || knownCourse?.lessons.find((item) => item.key === lessonKey)?.locked) return;
    setBusy(true);
    setError(null);
    try {
      const nextLesson = await apiGet<Lesson>(`/training/me/lessons/${lessonKey}`, { token: accessToken });
      setLesson(nextLesson);
      window.scrollTo({ top: 0, behavior: "smooth" });
      if (knownCourse?.status === "NOT_STARTED") {
        setCourse({ ...knownCourse, status: "IN_PROGRESS" });
      }
    } catch (caught) {
      setError(toMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  const completeCurrentLesson = async () => {
    if (!accessToken || !lesson || !course) return;
    setBusy(true);
    setError(null);
    try {
      const next = await apiPatch<Course>(`/training/me/lessons/${lesson.key}/complete`, { token: accessToken });
      setCourse(next);
      const nextSummary = next.lessons.find((item) => item.number === lesson.number + 1);
      if (nextSummary) await openLesson(nextSummary.key, next);
    } catch (caught) {
      setError(toMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  const submitQuiz = async () => {
    if (!accessToken || !course) return;
    if (Object.keys(quizAnswers).length !== course.quizQuestions.length) {
      setError("Répondez aux 13 questions avant de soumettre le test.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await apiPost<QuizResult>("/training/me/quiz/submit", {
        token: accessToken,
        body: { answers: quizAnswers }
      });
      setQuizResult(result);
      setQuizAnswers({});
      if (result.passed) {
        setCourse((current) =>
          current
            ? {
                ...current,
                status: "PASSED",
                certificateAvailable: Boolean(result.certificateAvailable),
                attemptsUsed: current.attemptsUsed + 1,
                attemptsRemaining: result.attemptsRemaining
              }
            : current
        );
      } else if (result.attentionRequired) {
        setCourse((current) =>
          current
            ? { ...current, status: "ATTENTION_REQUIRED", attemptsRemaining: 0, attemptsUsed: 3 }
            : current
        );
      } else {
        setCourse((current) =>
          current
            ? {
                ...current,
                status: "IN_PROGRESS",
                attemptsUsed: current.attemptsUsed + 1,
                attemptsRemaining: result.attemptsRemaining
              }
            : current
        );
      }
      await loadCourse(false);
    } catch (caught) {
      setError(toMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  const downloadCertificate = async () => {
    if (!accessToken) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/training/me/certificate`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        credentials: "include"
      });
      if (!response.ok) throw new Error("Le certificat n'a pas pu être téléchargé.");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "certificat-allie-fab.pdf";
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (caught) {
      setError(toMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen pb-16">
      <RequireAuth>
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-8">
          <Link href="/me" className="text-sm text-[#a8c3ff] no-underline hover:text-white">← Retour à mon profil</Link>

          {loading && !course ? <Alert tone="info">Chargement de votre formation…</Alert> : null}
          {error ? <div className="mt-4"><Alert tone="error">{error}</Alert></div> : null}

          {course ? (
            <>
              <header className="relative mt-5 overflow-hidden rounded-[30px] border border-[#7768b5]/50 bg-gradient-to-br from-[#2d215f] via-[#18133c] to-[#0c3550] p-6 shadow-[0_30px_80px_-45px_rgba(91,168,255,0.9)] sm:p-9">
                <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-[#f29d52]/15 blur-3xl" aria-hidden />
                <div className="relative grid gap-7 lg:grid-cols-[1fr_260px] lg:items-end">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#8ee7f3]">Formation officielle FAB</p>
                    <h1 className="mt-3 max-w-3xl text-3xl font-bold leading-tight text-white sm:text-5xl">Comprendre et soutenir les familles d&apos;accueil</h1>
                    <p className="mt-4 max-w-2xl text-base leading-7 text-[#d3cdeb]">Un parcours pratique pour devenir une présence fiable, bienveillante et sécurisante autour des familles.</p>
                  </div>
                  <div className="rounded-2xl border border-white/15 bg-[#0d0a25]/55 p-4 backdrop-blur">
                    <div className="flex items-center justify-between text-sm"><span className="text-[#bdb5dc]">Progression</span><strong>{course.progressPercent} %</strong></div>
                    <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-[#09071b]"><div className="h-full rounded-full bg-gradient-to-r from-[#f29d52] via-[#8cb2ff] to-[#49d8e8]" style={{ width: `${course.progressPercent}%` }} /></div>
                    <p className="mt-3 text-sm font-semibold text-[#aeeaf4]">{STATUS_LABELS[course.status] ?? course.status}</p>
                  </div>
                </div>
              </header>

              {course.status === "PASSED" ? (
                <section className="mx-auto mt-8 max-w-3xl rounded-[28px] border border-emerald-400/35 bg-gradient-to-br from-emerald-950/70 to-[#17133b] p-7 text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-400/15 text-3xl" aria-hidden>✓</div>
                  <h2 className="mt-4 text-3xl font-bold text-white">Formation réussie</h2>
                  <p className="mx-auto mt-3 max-w-xl text-[#cbdad6]">Félicitations! Votre certificat est prêt. L&apos;équipe FAB poursuivra la validation finale de votre candidature et de vos documents.</p>
                  <Button onClick={downloadCertificate} disabled={busy} className="mt-6 !rounded-xl !bg-[#f29d52] !px-5 !py-3 !font-bold !text-[#211435] hover:!bg-[#ffb36c]">
                    Télécharger mon certificat PDF
                  </Button>
                </section>
              ) : (
                <div className="mt-8 grid gap-6 lg:grid-cols-[310px_minmax(0,1fr)]">
                  <aside className="h-fit rounded-[24px] border border-[#514873] bg-[#15102f]/85 p-3 lg:sticky lg:top-24" aria-label="Modules de la formation">
                    <p className="px-3 pb-3 pt-2 text-xs font-bold uppercase tracking-[0.2em] text-[#aaa0d0]">8 modules</p>
                    <ol className="space-y-1">
                      {course.lessons.map((item) => (
                        <li key={item.key}>
                          <button
                            type="button"
                            disabled={item.locked || busy}
                            onClick={() => void openLesson(item.key)}
                            className={`flex w-full items-start gap-3 rounded-2xl px-3 py-3 text-left transition ${lesson?.key === item.key ? "bg-[#30275d] text-white" : "text-[#c4bddf] hover:bg-[#211a46]"} disabled:cursor-not-allowed disabled:opacity-45`}
                          >
                            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${item.completed ? "border-emerald-400/50 bg-emerald-400/15 text-emerald-200" : "border-[#6d6193] bg-[#100c27]"}`}>
                              {item.completed ? "✓" : item.number}
                            </span>
                            <span><strong className="block text-sm">{item.title}</strong><span className="mt-1 block text-xs opacity-65">{item.estimatedMinutes} min</span></span>
                          </button>
                        </li>
                      ))}
                    </ol>
                  </aside>

                  <div className="min-w-0 space-y-6">
                    {lesson ? (
                      <article className="overflow-hidden rounded-[28px] border border-[#514873] bg-[#f7f2e8] text-[#213c35] shadow-[0_28px_70px_-50px_rgba(0,0,0,0.9)]">
                        <header className="border-b border-[#ded4c4] bg-gradient-to-r from-[#f8ead8] to-[#edf0df] p-6 sm:p-9">
                          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#be603c]">Module {lesson.number} · {lesson.eyebrow}</p>
                          <h2 className="mt-3 text-3xl font-bold leading-tight text-[#163b32] sm:text-4xl">{lesson.title}</h2>
                          <p className="mt-3 max-w-2xl text-base leading-7 text-[#53675f]">{lesson.summary}</p>
                        </header>
                        <div className="space-y-8 p-6 sm:p-9">
                          {lesson.videoUrl ? (
                            <div className="overflow-hidden rounded-2xl border border-[#d8c9b7] bg-[#183e35] shadow-lg">
                              <div className="aspect-video"><iframe className="h-full w-full" src={lesson.videoUrl} title="Présentation de la formation des alliés FAB" allow="autoplay; fullscreen; picture-in-picture" allowFullScreen /></div>
                            </div>
                          ) : null}
                          {lesson.sections.map((section) => (
                            <section key={section.title} className="space-y-4">
                              <h3 className="text-2xl font-bold text-[#1c4b40]">{section.title}</h3>
                              {section.paragraphs?.map((paragraph) => <p key={paragraph} className="text-base leading-7 text-[#415a52]">{paragraph}</p>)}
                              {section.bullets ? <ul className="grid gap-3">{section.bullets.map((bullet) => <li key={bullet} className="flex gap-3 rounded-xl bg-white/70 p-3 leading-6"><span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[#e47c4c]" aria-hidden /><span>{bullet}</span></li>)}</ul> : null}
                              {section.cards ? <div className="grid gap-3 sm:grid-cols-2">{section.cards.map((card) => <div key={card.title} className="rounded-2xl border border-[#d9cfbd] bg-white/75 p-4"><h4 className="font-bold text-[#b55236]">{card.title}</h4><p className="mt-2 text-sm leading-6 text-[#4d625b]">{card.body}</p></div>)}</div> : null}
                              {section.callout ? <blockquote className="rounded-2xl border-l-4 border-[#df7748] bg-[#fff8ec] p-5 text-lg font-semibold leading-7 text-[#31574d]">{section.callout}</blockquote> : null}
                            </section>
                          ))}
                        </div>
                        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[#ded4c4] bg-[#efe7da] p-5 sm:px-9">
                          <span className="text-sm text-[#5d6d67]">Votre progression est enregistrée dans FAB.</span>
                          <Button onClick={completeCurrentLesson} disabled={busy || currentSummary?.completed} className="!rounded-xl !bg-[#1f6758] !px-5 !py-3 hover:!bg-[#185548]">
                            {currentSummary?.completed ? "Module complété ✓" : busy ? "Enregistrement…" : "Terminer ce module"}
                          </Button>
                        </footer>
                      </article>
                    ) : null}

                    {allLessonsComplete && course.status !== "ATTENTION_REQUIRED" && !quizResult ? (
                      <section className="rounded-[28px] border border-[#7768b5]/45 bg-[#171238]/90 p-6 sm:p-8">
                        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#8ee7f3]">Test officiel</p>
                        <h2 className="mt-2 text-3xl font-bold">13 questions</h2>
                        <p className="mt-2 text-[#bcb5d8]">
                          Répondez aux 13 questions avant de soumettre le test. La réussite exige au moins 60 %, soit 8 bonnes réponses. Il vous reste {course.attemptsRemaining} tentative{course.attemptsRemaining > 1 ? "s" : ""}.
                        </p>
                        <p className="mt-3 text-sm font-semibold text-[#aeeaf4]">
                          {Object.keys(quizAnswers).length}/13 questions répondues
                        </p>
                        <div className="mt-7 space-y-5">
                          {course.quizQuestions.map((question, index) => (
                            <fieldset key={question.id} className="rounded-2xl border border-[#4f4772] bg-[#100c29]/65 p-5">
                              <legend className="px-2 font-semibold text-white">{index + 1}. {question.prompt}</legend>
                              <div className="mt-3 grid gap-2">{question.answers.map((answer, answerIndex) => <label key={answer} className={`flex cursor-pointer gap-3 rounded-xl border p-3 text-sm ${quizAnswers[question.id] === answerIndex ? "border-[#8cb2ff] bg-[#29305d]" : "border-[#433b64] bg-[#171333]"}`}><input type="radio" name={`q-${question.id}`} checked={quizAnswers[question.id] === answerIndex} onChange={() => setQuizAnswers((previous) => ({ ...previous, [question.id]: answerIndex }))} /><span>{answer}</span></label>)}</div>
                            </fieldset>
                          ))}
                        </div>
                        <Button onClick={submitQuiz} disabled={busy || Object.keys(quizAnswers).length !== course.quizQuestions.length} className="mt-6 !rounded-xl !bg-[#f29d52] !px-5 !py-3 !font-bold !text-[#211435] hover:!bg-[#ffb36c]">Soumettre le test complet</Button>
                      </section>
                    ) : null}

                    {quizResult && !quizResult.passed ? (
                      <section className="rounded-[28px] border border-amber-400/35 bg-amber-950/35 p-6 sm:p-8">
                        <h2 className="text-2xl font-bold text-white">Test à reprendre : {quizResult.scorePercent} %</h2>
                        <p className="mt-2 text-amber-100">Le seuil de réussite est de 60 %. Il reste {quizResult.attemptsRemaining} tentative{quizResult.attemptsRemaining > 1 ? "s" : ""}.</p>
                        {quizResult.feedback.length ? (
                          <div className="mt-5 space-y-3">
                            <h3 className="font-semibold text-white">Notions à revoir</h3>
                            {quizResult.feedback.map((feedback) => {
                              const question = course.quizQuestions.find((item) => item.id === feedback.questionId);
                              return <div key={feedback.questionId} className="rounded-xl border border-amber-300/20 bg-[#171333] p-4"><p className="font-medium text-white">{question?.prompt}</p><p className="mt-2 text-sm text-amber-100">{feedback.explanation}</p></div>;
                            })}
                          </div>
                        ) : null}
                        {!quizResult.attentionRequired ? <Button onClick={() => setQuizResult(null)} className="mt-5 !rounded-xl !bg-[#f29d52] !font-bold !text-[#211435] hover:!bg-[#ffb36c]">Reprendre le test au complet</Button> : null}
                      </section>
                    ) : null}
                    {course.status === "ATTENTION_REQUIRED" ? <Alert tone="error">Vos trois tentatives ont été utilisées. L&apos;équipe FAB a été avisée et pourra réinitialiser le test après un suivi avec vous.</Alert> : null}
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>
      </RequireAuth>
    </main>
  );
}

function toMessage(error: unknown) {
  return error instanceof Error ? error.message : "Une erreur est survenue.";
}
