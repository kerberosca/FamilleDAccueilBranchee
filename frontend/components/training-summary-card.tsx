"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiGet } from "../lib/api";
import { useAuth } from "../lib/auth-context";

type TrainingSummary = {
  status: string;
  progressPercent: number;
  currentLessonKey: string;
  attemptsRemaining: number;
  certificateAvailable: boolean;
};

const STATUS_LABELS: Record<string, string> = {
  NOT_STARTED: "À commencer",
  IN_PROGRESS: "En cours",
  EXAM_AVAILABLE: "Examen disponible",
  PASSED: "Formation réussie",
  ATTENTION_REQUIRED: "Communiquez avec FAB"
};

export function TrainingSummaryCard() {
  const { accessToken } = useAuth();
  const [summary, setSummary] = useState<TrainingSummary | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    void apiGet<TrainingSummary>("/training/me", { token: accessToken })
      .then(setSummary)
      .catch(() => setSummary(null));
  }, [accessToken]);

  if (!summary) return null;

  return (
    <section className="overflow-hidden rounded-[24px] border border-[#7969bb]/55 bg-gradient-to-br from-[#241b55] via-[#1a1741] to-[#102b4a] p-5 shadow-[0_20px_60px_-38px_rgba(81,128,255,0.8)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#91dded]">Parcours allié</p>
          <h2 className="mt-2 text-xl font-semibold text-white">Ma formation d&apos;allié FAB</h2>
          <p className="mt-1 text-sm text-[#c9c2e8]">{STATUS_LABELS[summary.status] ?? summary.status}</p>
        </div>
        <span className="rounded-full border border-[#99b5ff]/30 bg-[#182b55] px-3 py-1 text-sm font-semibold text-[#c9d7ff]">
          {summary.progressPercent} %
        </span>
      </div>
      <div className="mt-5 h-2.5 overflow-hidden rounded-full bg-[#0d0a24]" aria-label={`Progression ${summary.progressPercent} %`}>
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#f29d52] via-[#8cb2ff] to-[#43d5e8] transition-all"
          style={{ width: `${summary.progressPercent}%` }}
        />
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Link
          href="/me/formation"
          className="inline-flex rounded-xl bg-[#f29d52] px-4 py-2.5 text-sm font-bold text-[#211435] no-underline hover:bg-[#ffb36c] hover:text-[#211435]"
        >
          {summary.status === "PASSED" ? "Voir mon certificat" : summary.status === "NOT_STARTED" ? "Commencer" : "Continuer"}
        </Link>
        {summary.status === "EXAM_AVAILABLE" ? <span className="text-sm text-[#aeeaf4]">Examen final débloqué</span> : null}
        {summary.status === "ATTENTION_REQUIRED" ? (
          <span className="text-sm text-amber-200">Vos trois essais ont été utilisés.</span>
        ) : null}
      </div>
    </section>
  );
}
