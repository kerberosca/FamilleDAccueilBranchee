"use client";

import { ChangeEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Alert } from "./ui/alert";
import { Button } from "./ui/button";
import { API_BASE, apiDelete, apiGet, apiPostForm } from "../lib/api";

type ResourceDocumentType = "BACKGROUND_CHECK" | "RCR_PROOF";

type ResourceDocument = {
  id: string;
  type: ResourceDocumentType;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
};

type Requirements = {
  required: ResourceDocumentType[];
  missing: ResourceDocumentType[];
  complete: boolean;
};

type DocumentsResponse = {
  documents: ResourceDocument[];
  requirements: Requirements;
};

type Props = {
  token: string | null;
  resourceId?: string;
  admin?: boolean;
  compact?: boolean;
};

const DOCUMENT_TYPES: { type: ResourceDocumentType; label: string; hint: string }[] = [
  { type: "BACKGROUND_CHECK", label: "Antécédents", hint: "Attestation ou preuve de demande - max 10 Mo" },
  { type: "RCR_PROOF", label: "Preuve RCR", hint: "Obligatoire si RCR valide déclaré" }
];

export function ResourceDocumentsPanel({ token, resourceId, admin = false, compact = false }: Props) {
  const [data, setData] = useState<DocumentsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [busyType, setBusyType] = useState<ResourceDocumentType | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const url = useMemo(() => {
    if (admin && resourceId) return `/resource-documents/admin/resource/${resourceId}`;
    return "/resource-documents/me";
  }, [admin, resourceId]);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      setData(await apiGet<DocumentsResponse>(url, { token }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur de chargement des documents.");
    } finally {
      setLoading(false);
    }
  }, [token, url]);

  useEffect(() => {
    void load();
  }, [load]);

  const documentsByType = useMemo(() => {
    const map = new Map<ResourceDocumentType, ResourceDocument>();
    for (const document of data?.documents ?? []) {
      map.set(document.type, document);
    }
    return map;
  }, [data]);

  const upload = async (type: ResourceDocumentType, event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !token || admin) return;
    setBusyType(type);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      setData(await apiPostForm<DocumentsResponse>(`/resource-documents/me?type=${type}`, formData, { token }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur lors du téléversement.");
    } finally {
      setBusyType(null);
    }
  };

  const remove = async (documentId: string) => {
    if (!token) return;
    setBusyId(documentId);
    setError(null);
    try {
      await apiDelete(`/resource-documents/${documentId}`, { token });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur lors de la suppression.");
    } finally {
      setBusyId(null);
    }
  };

  const download = async (document: ResourceDocument) => {
    if (!token) return;
    setBusyId(document.id);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/resource-documents/${document.id}/download`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include"
      });
      if (!res.ok) {
        throw new Error(`Téléchargement impossible (${res.status}).`);
      }
      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      const anchor = window.document.createElement("a");
      anchor.href = href;
      anchor.download = document.originalName;
      anchor.click();
      URL.revokeObjectURL(href);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur lors du téléchargement.");
    } finally {
      setBusyId(null);
    }
  };

  const required = new Set(data?.requirements.required ?? ["BACKGROUND_CHECK"]);
  const missing = new Set(data?.requirements.missing ?? []);

  return (
    <section
      className={
        compact
          ? "space-y-3 rounded-lg border border-slate-700/80 bg-slate-950/30 p-4"
          : "space-y-4 rounded-xl border border-slate-700/80 bg-slate-900/90 p-5 shadow-sm"
      }
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-white">Documents requis</h2>
          <p className="text-sm text-slate-400">
            {data?.requirements.complete
              ? "Votre dossier de documents est complet."
              : "Ajoutez les documents requis pour compléter la validation."}
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            data?.requirements.complete ? "bg-emerald-900/60 text-emerald-200" : "bg-amber-900/60 text-amber-100"
          }`}
        >
          {data?.requirements.complete ? "Complet" : "Incomplet"}
        </span>
      </div>

      {loading ? <Alert tone="info">Chargement des documents...</Alert> : null}
      {error ? <Alert tone="error">{error}</Alert> : null}

      <div className="space-y-2">
        {DOCUMENT_TYPES.map(({ type, label, hint }) => {
          const document = documentsByType.get(type);
          const isRequired = required.has(type);
          const isMissing = missing.has(type);
          return (
            <div key={type} className="rounded-lg border border-slate-700/80 bg-slate-950/40 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-white">
                    {label} {isRequired ? <span className="text-amber-200">*</span> : <span className="text-slate-500">(optionnel)</span>}
                  </p>
                  <p className="text-xs text-slate-500">{document ? `${document.originalName} - ${formatBytes(document.sizeBytes)}` : hint}</p>
                  {isMissing ? <p className="text-xs text-amber-200">Document manquant.</p> : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  {document ? (
                    <Button type="button" variant="secondary" disabled={busyId === document.id} onClick={() => void download(document)}>
                      Télécharger
                    </Button>
                  ) : null}
                  {!admin ? (
                    <label className="cursor-pointer rounded-md bg-slate-700 px-4 py-2 text-sm font-medium text-slate-100 hover:bg-slate-600">
                      {document ? "Remplacer" : "Ajouter"}
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                        className="sr-only"
                        disabled={busyType === type}
                        onChange={(event) => void upload(type, event)}
                      />
                    </label>
                  ) : null}
                  {document && !admin ? (
                    <Button type="button" variant="secondary" disabled={busyId === document.id} onClick={() => void remove(document.id)}>
                      Supprimer
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} Ko`;
  return `${(bytes / 1024 / 1024).toFixed(1)} Mo`;
}
