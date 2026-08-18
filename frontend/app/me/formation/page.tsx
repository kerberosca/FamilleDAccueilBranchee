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
  formativeCompleted: boolean;
  lessons: LessonSummary[];
  formativeQuestions: PublicQuestion[];
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

type FormativeResult = {
  scorePercent: number;
  feedback: { questionId: string; correct: boolean; correctIndex: number; explanation: string }[];
};

type FinalResult = {
  passed: boolean;
  scorePercent: number;
  attemptsRemaining: number;
  explanation: string;
  attentionRequired?: boolean;
};

const STATUS_LABELS: Record<string, string> = {
  NOT_STARTED: "À commencer",
  IN_PROGRESS: "En cours",
  EXAM_AVAILABLE: "Examen disponible",
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
  const [formativeAnswers, setFormativeAnswers] = useState<Record<string, number>>({});
  const [formativeResult, setFormativeResult] = useState<FormativeResult | null>(null);
  const [examQuestion, setExamQuestion] = useState<PublicQuestion | null>(null);
  const [examAnswer, setExamAnswer] = useState<number | null>(null);
  const [finalResult, setFinalResult] = useState<FinalResult | null>(null);

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

  const submitFormative = async () => {
    if (!accessToken || !course) return;
    if (Object.keys(formativeAnswers).length !== course.formativeQuestions.length) {
      setError("Répondez aux 12 questions avant de soumettre le quiz.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await apiPost<FormativeResult>("/training/me/formative/submit", {
        token: accessToken,
        body: { answers: formativeAnswers }
      });
      setFormativeResult(result);
      await loadCourse(false);
    } catch (caught) {
      setError(toMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  const loadExam = async () => {
    if (!accessToken) return;
    setBusy(true);
    setError(null);
    try {
      const data = await apiGet<{ question: PublicQuestion }>("/training/me/exam", { token: accessToken });
      setExamQuestion(data.question);
    } catch (caught) {
      setError(toMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  const submitExam = async () => {
    if (!accessToken || !examQuestion || examAnswer == null) return;
    setBusy(true);
    setError(null);
    try {
      const result = await apiPost<FinalResult>("/training/me/exam/submit", {
        token: accessToken,
        body: { answers: { [examQuestion.id]: examAnswer } }
      });
      setFinalResult(result);
      setExamQuestion(null);
      setExamAnswer(null);
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

                    {allLessonsComplete && !course.formativeCompleted ? (
                      <section className="rounded-[28px] border border-[#7768b5]/45 bg-[#171238]/90 p-6 sm:p-8">
                        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#8ee7f3]">Quiz formatif</p>
                        <h2 className="mt-2 text-3xl font-bold">12 mises en situation</h2>
                        <p className="mt-2 text-[#bcb5d8]">Répondez à toutes les questions. Vous recevrez une rétroaction immédiate avant l&apos;examen final.</p>
                        <div className="mt-7 space-y-5">
                          {course.formativeQuestions.map((question, index) => {
                            const feedback = formativeResult?.feedback.find((item) => item.questionId === question.id);
                            return (
                              <fieldset key={question.id} className="rounded-2xl border border-[#4f4772] bg-[#100c29]/65 p-5">
                                <legend className="px-2 font-semibold text-white">{index + 1}. {question.prompt}</legend>
                                <div className="mt-3 grid gap-2">{question.answers.map((answer, answerIndex) => <label key={answer} className={`flex cursor-pointer gap-3 rounded-xl border p-3 text-sm ${formativeAnswers[question.id] === answerIndex ? "border-[#8cb2ff] bg-[#29305d]" : "border-[#433b64] bg-[#171333]"}`}><input type="radio" name={`q-${question.id}`} checked={formativeAnswers[question.id] === answerIndex} onChange={() => setFormativeAnswers((previous) => ({ ...previous, [question.id]: answerIndex }))} /><span>{answer}</span></label>)}</div>
                                {feedback ? <p className={`mt-3 rounded-xl p-3 text-sm ${feedback.correct ? "bg-emerald-950/70 text-emerald-200" : "bg-amber-950/70 text-amber-100"}`}>{feedback.correct ? "Bonne réponse. " : "À revoir. "}{feedback.explanation}</p> : null}
                              </fieldset>
                            );
                          })}
                        </div>
                        <Button onClick={submitFormative} disabled={busy || Boolean(formativeResult)} className="mt-6 !rounded-xl !bg-[#f29d52] !px-5 !py-3 !font-bold !text-[#211435] hover:!bg-[#ffb36c]">Soumettre le quiz</Button>
                      </section>
                    ) : null}

                    {formativeResult ? <Alert tone="info">Quiz complété : {formativeResult.scorePercent} %. L&apos;examen final est maintenant disponible.</Alert> : null}

                    {course.status === "EXAM_AVAILABLE" ? (
                      <section className="rounded-[28px] border border-[#f29d52]/45 bg-gradient-to-br from-[#2b1735] to-[#15123b] p-6 sm:p-8">
                        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#ffc080]">Examen final</p>
                        <h2 className="mt-2 text-3xl font-bold">Dernière étape</h2>
                        <p className="mt-2 text-[#d4c5d7]">Seuil de réussite : 60 %. Il vous reste {course.attemptsRemaining} tentative{course.attemptsRemaining > 1 ? "s" : ""}.</p>
                        {!examQuestion ? <Button onClick={loadExam} disabled={busy} className="mt-5 !rounded-xl !bg-[#f29d52] !font-bold !text-[#211435] hover:!bg-[#ffb36c]">Commencer une tentative</Button> : (
                          <fieldset className="mt-6 rounded-2xl border border-[#695678] bg-[#130d27]/75 p-5"><legend className="px-2 text-lg font-semibold">{examQuestion.prompt}</legend><div className="mt-4 grid gap-3 sm:grid-cols-2">{examQuestion.answers.map((answer, index) => <label key={answer} className={`cursor-pointer rounded-xl border p-4 text-center font-semibold ${examAnswer === index ? "border-[#f29d52] bg-[#53314c]" : "border-[#4b405e] bg-[#1c1638]"}`}><input className="mr-2" type="radio" name="final-answer" checked={examAnswer === index} onChange={() => setExamAnswer(index)} />{answer}</label>)}</div><Button onClick={submitExam} disabled={busy || examAnswer == null} className="mt-5 !rounded-xl !bg-[#f29d52] !font-bold !text-[#211435] hover:!bg-[#ffb36c]">Soumettre ma réponse</Button></fieldset>
                        )}
                      </section>
                    ) : null}

                    {finalResult ? <Alert tone={finalResult.passed ? "info" : "error"}>{finalResult.passed ? "Félicitations, l'examen est réussi!" : finalResult.attentionRequired ? "Les trois tentatives sont utilisées. L'équipe FAB a été avisée." : `Réponse incorrecte. Il reste ${finalResult.attemptsRemaining} tentative(s).`} {finalResult.explanation}</Alert> : null}
                    {course.status === "ATTENTION_REQUIRED" ? <Alert tone="error">Vos trois tentatives ont été utilisées. L&apos;équipe FAB a été avisée et pourra réinitialiser l&apos;examen après un suivi avec vous.</Alert> : null}
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
