"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { API_BASE, apiGet, apiPost } from "../lib/api";
import { useAuth } from "../lib/auth-context";
import { Alert } from "./ui/alert";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Input } from "./ui/input";

type TrainingStatus = "NOT_STARTED" | "IN_PROGRESS" | "EXAM_AVAILABLE" | "PASSED" | "ATTENTION_REQUIRED";
type TrainingAdminItem = {
  id: string;
  status: TrainingStatus;
  displayName: string;
  email: string;
  publishStatus: string;
  progressPercent: number;
  completedLessons: number;
  assignedAt: string;
  lastActivityAt?: string | null;
  completedAt?: string | null;
  attemptsUsed: number;
  attemptsRemaining: number;
  overdue: boolean;
  certificateAvailable: boolean;
  nextReminder?: string | null;
  attempts: { id: string; type: string; attemptNumber: number; scorePercent: number; passed: boolean; submittedAt: string }[];
  emailLogs: { type: string; status: string; scheduledFor: string; sentAt?: string | null; retryCount: number; lastError?: string | null }[];
};
type TrainingAdminResponse = {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  stats: Record<TrainingStatus, number>;
  emailAutomation: {
    enabled: boolean;
    status: "ACTIVE" | "PAUSED" | "SCHEDULED" | "MISCONFIGURED";
    startAt?: string | null;
  };
  items: TrainingAdminItem[];
};

const STATUS_LABELS: Record<TrainingStatus, string> = {
  NOT_STARTED: "Non commencés",
  IN_PROGRESS: "En cours",
  EXAM_AVAILABLE: "Examen disponible",
  PASSED: "Réussis",
  ATTENTION_REQUIRED: "Attention requise"
};
const EMAIL_LABELS: Record<string, string> = {
  ASSIGNMENT: "Invitation J0",
  DAY_3: "Rappel J3",
  DAY_7: "Rappel J7",
  DAY_14: "Rappel J14",
  SUCCESS: "Confirmation de réussite",
  ATTENTION: "Avis à l'équipe"
};

export function TrainingAdminPanel() {
  const { accessToken } = useAuth();
  const [data, setData] = useState<TrainingAdminResponse | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const url = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), pageSize: "20" });
    if (query.trim()) params.set("query", query.trim());
    if (status) params.set("status", status);
    return `/training/admin/enrollments?${params.toString()}`;
  }, [page, query, status]);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      setData(await apiGet<TrainingAdminResponse>(url, { token: accessToken }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Le suivi n'a pas pu être chargé.");
    } finally {
      setLoading(false);
    }
  }, [accessToken, url]);

  useEffect(() => { void load(); }, [load]);

  const resetAttempts = async (item: TrainingAdminItem) => {
    if (!accessToken || !window.confirm(`Réinitialiser les essais de ${item.displayName}?`)) return;
    setBusyId(item.id);
    setError(null);
    try {
      await apiPost(`/training/admin/enrollments/${item.id}/reset-attempts`, { token: accessToken });
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "La réinitialisation a échoué.");
    } finally {
      setBusyId(null);
    }
  };

  const downloadCertificate = async (item: TrainingAdminItem) => {
    if (!accessToken) return;
    setBusyId(item.id);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/training/admin/enrollments/${item.id}/certificate`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        credentials: "include"
      });
      if (!response.ok) throw new Error("Le certificat n'a pas pu être téléchargé.");
      const blobUrl = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      anchor.href = blobUrl;
      anchor.download = `certificat-allie-${item.displayName.replace(/\s+/g, "-").toLowerCase()}.pdf`;
      anchor.click();
      URL.revokeObjectURL(blobUrl);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Le téléchargement a échoué.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Card className="space-y-5 border-[#4e4771] bg-[#171134]/80">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-300">Formation native FAB</p>
          <h2 className="mt-1 text-xl font-semibold">Suivi du parcours des alliés</h2>
          <p className="mt-1 text-sm text-slate-400">Progression, tentatives, relances et certificats au même endroit.</p>
        </div>
        <Button variant="secondary" onClick={() => void load()} disabled={loading}>Rafraîchir</Button>
      </div>
      {error ? <Alert tone="error">{error}</Alert> : null}
      {data ? (
        <Alert tone={data.emailAutomation.status === "MISCONFIGURED" ? "error" : "info"}>
          Relances par courriel : {emailAutomationLabel(data.emailAutomation)}
        </Alert>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {(Object.keys(STATUS_LABELS) as TrainingStatus[]).map((key) => (
          <button key={key} type="button" onClick={() => { setStatus(status === key ? "" : key); setPage(1); }} className={`rounded-2xl border p-4 text-left transition ${status === key ? "border-cyan-400/60 bg-cyan-950/40" : "border-[#4a4269] bg-[#100c29]/60 hover:border-[#71669b]"}`}>
            <span className="block text-2xl font-bold text-white">{data?.stats[key] ?? 0}</span>
            <span className="mt-1 block text-xs text-slate-400">{STATUS_LABELS[key]}</span>
          </button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-[1fr_230px]">
        <Input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Rechercher par nom ou courriel" />
        <select className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
          <option value="">Tous les statuts</option>
          {(Object.keys(STATUS_LABELS) as TrainingStatus[]).map((key) => <option key={key} value={key}>{STATUS_LABELS[key]}</option>)}
        </select>
      </div>
      {loading ? <Alert tone="info">Chargement des parcours…</Alert> : null}
      <div className="space-y-3">
        {data?.items.map((item) => (
          <article key={item.id} className="rounded-2xl border border-[#4a4269] bg-[#100c29]/65 p-4">
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_180px_170px] xl:items-center">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-white">{item.displayName}</h3>{item.overdue ? <span className="rounded-full bg-amber-500/15 px-2 py-1 text-xs text-amber-200">J14 dépassé</span> : null}</div>
                <p className="break-all text-sm text-slate-400">{item.email}</p>
                <p className="mt-2 text-xs text-slate-500">Dernière activité : {formatDate(item.lastActivityAt)} · Publication : {item.publishStatus}</p>
              </div>
              <div>
                <div className="flex justify-between text-xs"><span>{STATUS_LABELS[item.status]}</span><strong>{item.progressPercent} %</strong></div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-900"><div className="h-full rounded-full bg-gradient-to-r from-orange-400 via-blue-400 to-cyan-300" style={{ width: `${item.progressPercent}%` }} /></div>
                <p className="mt-2 text-xs text-slate-500">{item.completedLessons}/8 modules · {item.attemptsUsed} essai(s)</p>
              </div>
              <div className="flex flex-wrap gap-2 xl:justify-end">
                {item.status === "ATTENTION_REQUIRED" ? <Button onClick={() => void resetAttempts(item)} disabled={busyId === item.id}>Réinitialiser</Button> : null}
                {item.certificateAvailable ? <Button variant="secondary" onClick={() => void downloadCertificate(item)} disabled={busyId === item.id}>Certificat</Button> : null}
              </div>
            </div>
            <details className="mt-4 border-t border-[#3f385b] pt-3">
              <summary className="cursor-pointer text-sm font-medium text-[#a8c3ff]">Voir les tentatives et les relances</summary>
              <div className="mt-3 grid gap-4 lg:grid-cols-2">
                <div><h4 className="text-xs font-bold uppercase tracking-wide text-slate-400">Tentatives</h4>{item.attempts.length ? <ul className="mt-2 space-y-1 text-sm">{item.attempts.map((attempt) => <li key={attempt.id}>{attempt.type} #{attempt.attemptNumber} · {attempt.scorePercent} % · {attempt.passed ? "réussi" : "échoué"}</li>)}</ul> : <p className="mt-2 text-sm text-slate-500">Aucune tentative.</p>}</div>
                <div><h4 className="text-xs font-bold uppercase tracking-wide text-slate-400">Courriels</h4><ul className="mt-2 space-y-1 text-sm">{item.emailLogs.map((log) => <li key={log.type}>{EMAIL_LABELS[log.type] ?? log.type} · {log.status} · {formatDate(log.sentAt ?? log.scheduledFor)}</li>)}</ul></div>
              </div>
            </details>
          </article>
        ))}
        {!loading && data?.items.length === 0 ? <Alert tone="info">Aucun parcours ne correspond aux filtres.</Alert> : null}
      </div>
      {data ? <div className="flex items-center justify-between text-sm"><span>Total : {data.total} · Page {data.page}/{data.totalPages}</span><div className="flex gap-2"><Button variant="secondary" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Précédent</Button><Button variant="secondary" disabled={page >= data.totalPages} onClick={() => setPage((value) => value + 1)}>Suivant</Button></div></div> : null}
    </Card>
  );
}

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleString("fr-CA") : "Jamais";
}

function emailAutomationLabel(automation: TrainingAdminResponse["emailAutomation"]) {
  if (automation.status === "ACTIVE") return `activées depuis le ${formatDate(automation.startAt)}`;
  if (automation.status === "SCHEDULED") return `programmées pour le ${formatDate(automation.startAt)}`;
  if (automation.status === "MISCONFIGURED") return "bloquées — date de départ absente ou invalide";
  return automation.startAt
    ? `en pause — date de départ préparée pour le ${formatDate(automation.startAt)}`
    : "en pause — aucun courriel de formation ne sera envoyé";
}
