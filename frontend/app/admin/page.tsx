"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { RequireAuth } from "../../components/require-auth";
import { ResourceDocumentsPanel } from "../../components/resource-documents-panel";
import { apiDelete, apiGet, apiPatch, apiPost } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";
import { useMaintenance } from "../../lib/maintenance-context";

type Tab = "families" | "resources" | "audit";

type MeResponse = { id: string; email: string; role: string; status: string };
type PageMeta = { total: number; page: number; pageSize: number; totalPages: number };

type FamilyItem = {
  id: string;
  email: string;
  role: string;
  status: "ACTIVE" | "BANNED";
  profile: { displayName: string; city: string; region: string; postalCode: string } | null;
  subscription: { status: string; currentPeriodEnd?: string | null } | null;
};
type FamiliesResponse = PageMeta & { items: FamilyItem[] };

type ResourceItem = {
  id: string;
  displayName: string;
  city: string;
  region: string;
  postalCode: string;
  streetAddress?: string | null;
  verificationStatus: string;
  publishStatus: string;
  onboardingState: string;
  backgroundCheckStatus?: string;
  allyRegistration?: unknown;
  documentRequirements?: { required: string[]; missing: string[]; complete: boolean };
  allyDeclarationsAcceptedAt?: string | null;
  user: { id: string; email: string; status: string; role?: string };
};
type ResourcesResponse = PageMeta & { items: ResourceItem[] };

type AuditItem = {
  id: string;
  actorUserId: string;
  action: string;
  targetType: string;
  targetId: string;
  payload: unknown;
  createdAt: string;
  actorUser: { id: string; email: string; role: string };
};
type AuditResponse = PageMeta & { items: AuditItem[] };

type MaintenanceStatus = { enabled: boolean; updatedAt: string; updatedBy: string | null };
type DiskStatus = {
  path: string;
  totalBytes: number;
  freeBytes: number;
  usedBytes: number;
  usedPercent: number;
} | null;
type SystemStatus = {
  generatedAt: string;
  host: {
    hostname: string;
    platform: string;
    release: string;
    arch: string;
    uptimeSeconds: number;
  };
  process: {
    uptimeSeconds: number;
    nodeVersion: string;
    pid: number;
    memory: { rss: number; heapTotal: number; heapUsed: number; external: number; arrayBuffers: number };
  };
  cpu: {
    cores: number;
    model: string;
    loadAverage: number[];
    usagePercent: number;
  };
  memory: {
    totalBytes: number;
    freeBytes: number;
    usedBytes: number;
    usedPercent: number;
  };
  disk: {
    root: DiskStatus;
    uploads: DiskStatus;
  };
  scope: string;
};

const SELECT_CLASS = "min-w-0 max-w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2";
const ADMIN_CARD_CLASS = "min-w-0 overflow-hidden";
const ADMIN_TEXT_CLASS = "min-w-0 break-words";
const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Administrateur",
  FAMILY: "Famille",
  RESOURCE: "Allié"
};
const ACCOUNT_STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Actif",
  BANNED: "Banni"
};
const SUBSCRIPTION_STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Actif",
  INACTIVE: "Inactif",
  PAST_DUE: "Paiement en retard",
  CANCELED: "Annulé"
};
const VERIFICATION_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Brouillon",
  PENDING_VERIFICATION: "En attente de vérification",
  VERIFIED: "Vérifié",
  REJECTED: "Rejeté"
};
const PUBLISH_STATUS_LABELS: Record<string, string> = {
  HIDDEN: "Masqué",
  PUBLISHED: "Publié",
  SUSPENDED: "Suspendu"
};
const ONBOARDING_STATE_LABELS: Record<string, string> = {
  DRAFT: "Brouillon",
  PENDING_VERIFICATION: "En attente de vérification",
  PUBLISHED: "Publié",
  SUSPENDED: "Suspendu"
};
const BACKGROUND_CHECK_STATUS_LABELS: Record<string, string> = {
  NOT_REQUESTED: "Non demandé",
  REQUESTED: "Demandé",
  PENDING: "En attente",
  RECEIVED: "Reçu"
};
const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  BACKGROUND_CHECK: "Antécédents",
  RCR_PROOF: "Preuve RCR",
  CV: "CV"
};

function formatLabel(labels: Record<string, string>, value: string | null | undefined): string {
  if (!value) return "-";
  return labels[value] ?? value;
}

function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0 o";
  const units = ["o", "Ko", "Mo", "Go", "To"];
  const exponent = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  const amount = value / 1024 ** exponent;
  return `${amount >= 10 || exponent === 0 ? amount.toFixed(0) : amount.toFixed(1)} ${units[exponent]}`;
}

function formatDuration(totalSeconds: number): string {
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (days > 0) return `${days} j ${hours} h`;
  if (hours > 0) return `${hours} h ${minutes} min`;
  return `${minutes} min`;
}

function formatPercent(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  return `${value.toFixed(1)} %`;
}

function statusToneClass(percent: number | null | undefined): string {
  if (typeof percent !== "number") return "bg-slate-700";
  if (percent >= 90) return "bg-rose-500";
  if (percent >= 75) return "bg-amber-400";
  return "bg-emerald-400";
}

export default function AdminPage() {
  const { accessToken } = useAuth();
  const { updateMaintenance } = useMaintenance();
  const [tab, setTab] = useState<Tab>("families");
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loadingMe, setLoadingMe] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [families, setFamilies] = useState<FamilyItem[]>([]);
  const [resources, setResources] = useState<ResourceItem[]>([]);
  const [auditItems, setAuditItems] = useState<AuditItem[]>([]);
  const [familiesMeta, setFamiliesMeta] = useState<PageMeta>({ total: 0, page: 1, pageSize: 10, totalPages: 1 });
  const [resourcesMeta, setResourcesMeta] = useState<PageMeta>({ total: 0, page: 1, pageSize: 10, totalPages: 1 });
  const [auditMeta, setAuditMeta] = useState<PageMeta>({ total: 0, page: 1, pageSize: 20, totalPages: 1 });

  const [familyQuery, setFamilyQuery] = useState("");
  const [familyStatus, setFamilyStatus] = useState("");
  const [familySortBy, setFamilySortBy] = useState("createdAt");
  const [familySortOrder, setFamilySortOrder] = useState("desc");

  const [resourceQuery, setResourceQuery] = useState("");
  const [verificationStatus, setVerificationStatus] = useState("");
  const [publishStatus, setPublishStatus] = useState("");
  const [resourceSortBy, setResourceSortBy] = useState("updatedAt");
  const [resourceSortOrder, setResourceSortOrder] = useState("desc");

  const [selectedFamilyIds, setSelectedFamilyIds] = useState<string[]>([]);
  const [selectedResourceIds, setSelectedResourceIds] = useState<string[]>([]);
  const [maintenanceStatus, setMaintenanceStatus] = useState<MaintenanceStatus | null>(null);
  const [maintenanceBusy, setMaintenanceBusy] = useState(false);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [systemLoading, setSystemLoading] = useState(false);
  const [systemError, setSystemError] = useState<string | null>(null);

  const isAdmin = me?.role === "ADMIN";
  const selectedResourcesComplete = selectedResourceIds.every(
    (id) => resources.find((resource) => resource.id === id)?.documentRequirements?.complete
  );

  const familiesUrl = useMemo(() => {
    const params = new URLSearchParams();
    params.set("page", String(familiesMeta.page));
    params.set("pageSize", String(familiesMeta.pageSize));
    params.set("sortBy", familySortBy);
    params.set("sortOrder", familySortOrder);
    if (familyQuery.trim()) {
      params.set("query", familyQuery.trim());
    }
    if (familyStatus) {
      params.set("status", familyStatus);
    }
    return `/users/families?${params.toString()}`;
  }, [familiesMeta.page, familiesMeta.pageSize, familySortBy, familySortOrder, familyQuery, familyStatus]);

  const resourcesUrl = useMemo(() => {
    const params = new URLSearchParams();
    params.set("page", String(resourcesMeta.page));
    params.set("pageSize", String(resourcesMeta.pageSize));
    params.set("sortBy", resourceSortBy);
    params.set("sortOrder", resourceSortOrder);
    if (resourceQuery.trim()) {
      params.set("query", resourceQuery.trim());
    }
    if (verificationStatus) {
      params.set("verificationStatus", verificationStatus);
    }
    if (publishStatus) {
      params.set("publishStatus", publishStatus);
    }
    return `/profiles/resources/admin?${params.toString()}`;
  }, [
    resourcesMeta.page,
    resourcesMeta.pageSize,
    resourceSortBy,
    resourceSortOrder,
    resourceQuery,
    verificationStatus,
    publishStatus
  ]);

  const auditUrl = useMemo(() => {
    const params = new URLSearchParams();
    params.set("page", String(auditMeta.page));
    params.set("pageSize", String(auditMeta.pageSize));
    return `/users/admin/audit?${params.toString()}`;
  }, [auditMeta.page, auditMeta.pageSize]);

  const refreshSystemStatus = useCallback(async () => {
    if (!accessToken || !isAdmin) {
      return;
    }
    setSystemLoading(true);
    setSystemError(null);
    try {
      const data = await apiGet<SystemStatus>("/system-status", { token: accessToken });
      setSystemStatus(data);
    } catch (e) {
      setSystemError(e instanceof Error ? e.message : "Etat VPS indisponible");
    } finally {
      setSystemLoading(false);
    }
  }, [accessToken, isAdmin]);

  useEffect(() => {
    if (!accessToken) {
      return;
    }
    const run = async () => {
      setLoadingMe(true);
      setError(null);
      try {
        const data = await apiGet<MeResponse>("/users/me", { token: accessToken });
        setMe(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erreur inconnue");
      } finally {
        setLoadingMe(false);
      }
    };
    void run();
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken || !isAdmin) {
      return;
    }
    const fetchMaintenance = async () => {
      try {
        const data = await apiGet<MaintenanceStatus>("/maintenance/status", { token: accessToken });
        setMaintenanceStatus(data);
      } catch {
        setMaintenanceStatus(null);
      }
    };
    void fetchMaintenance();
  }, [accessToken, isAdmin]);

  useEffect(() => {
    void refreshSystemStatus();
  }, [refreshSystemStatus]);

  useEffect(() => {
    if (!accessToken || !isAdmin) {
      return;
    }
    const run = async () => {
      setLoadingData(true);
      setError(null);
      try {
        if (tab === "families") {
          const data = await apiGet<FamiliesResponse>(familiesUrl, { token: accessToken });
          setFamilies(data.items);
          setFamiliesMeta({ total: data.total, page: data.page, pageSize: data.pageSize, totalPages: data.totalPages });
          setSelectedFamilyIds([]);
          return;
        }
        if (tab === "resources") {
          const data = await apiGet<ResourcesResponse>(resourcesUrl, { token: accessToken });
          setResources(data.items);
          setResourcesMeta({
            total: data.total,
            page: data.page,
            pageSize: data.pageSize,
            totalPages: data.totalPages
          });
          setSelectedResourceIds([]);
          return;
        }
        const data = await apiGet<AuditResponse>(auditUrl, { token: accessToken });
        setAuditItems(data.items);
        setAuditMeta({ total: data.total, page: data.page, pageSize: data.pageSize, totalPages: data.totalPages });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erreur inconnue");
      } finally {
        setLoadingData(false);
      }
    };
    void run();
  }, [accessToken, isAdmin, tab, familiesUrl, resourcesUrl, auditUrl]);

  const refreshCurrentTab = async () => {
    if (!accessToken || !isAdmin) {
      return;
    }
    setLoadingData(true);
    setError(null);
    try {
      if (tab === "families") {
        const data = await apiGet<FamiliesResponse>(familiesUrl, { token: accessToken });
        setFamilies(data.items);
        setFamiliesMeta({ total: data.total, page: data.page, pageSize: data.pageSize, totalPages: data.totalPages });
        return;
      }
      if (tab === "resources") {
        const data = await apiGet<ResourcesResponse>(resourcesUrl, { token: accessToken });
        setResources(data.items);
        setResourcesMeta({ total: data.total, page: data.page, pageSize: data.pageSize, totalPages: data.totalPages });
        return;
      }
      const data = await apiGet<AuditResponse>(auditUrl, { token: accessToken });
      setAuditItems(data.items);
      setAuditMeta({ total: data.total, page: data.page, pageSize: data.pageSize, totalPages: data.totalPages });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setLoadingData(false);
    }
  };

  const updateFamilyStatus = async (userId: string, status: "ACTIVE" | "BANNED") => {
    if (!accessToken) {
      return;
    }
    setBusyId(userId);
    setError(null);
    try {
      await apiPatch(`/users/${userId}/status`, { token: accessToken, body: { status } });
      await refreshCurrentTab();
      setTab("audit");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setBusyId(null);
    }
  };

  const deleteFamily = async (userId: string, displayName: string, email: string) => {
    if (!accessToken) return;
    const confirmed = window.confirm(
      `Supprimer definitivement la famille "${displayName}" (${email}) ?\n\nAction reservee aux cas clairs : doublon, compte test, demande legale ou erreur d'inscription. Cette action supprime le compte, le profil, les conversations, les messages et les abonnements lies.`
    );
    if (!confirmed) return;

    const reason = window.prompt("Indique la raison administrative de la suppression definitive :");
    if (!reason?.trim()) {
      setError("Suppression annulee : une raison administrative est requise.");
      return;
    }

    setBusyId(`delete-family-${userId}`);
    setError(null);
    try {
      await apiDelete(`/users/families/${userId}`, { token: accessToken, body: { reason: reason.trim() } });
      await refreshCurrentTab();
      setTab("audit");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur lors de la suppression de la famille.");
    } finally {
      setBusyId(null);
    }
  };

  const bulkUpdateFamilyStatus = async (status: "ACTIVE" | "BANNED") => {
    if (!accessToken || selectedFamilyIds.length === 0) {
      return;
    }
    setBusyId(`bulk-family-${status}`);
    setError(null);
    try {
      await apiPatch("/users/status/bulk", { token: accessToken, body: { userIds: selectedFamilyIds, status } });
      setSelectedFamilyIds([]);
      await refreshCurrentTab();
      setTab("audit");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setBusyId(null);
    }
  };

  const moderateResource = async (
    resourceId: string,
    payload: { verificationStatus: string; publishStatus: string; onboardingState: string; backgroundCheckStatus?: string }
  ) => {
    if (!accessToken) {
      return;
    }
    setBusyId(resourceId);
    setError(null);
    try {
      await apiPatch(`/profiles/resource/${resourceId}/moderation`, { token: accessToken, body: payload });
      await refreshCurrentTab();
      setTab("audit");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setBusyId(null);
    }
  };

  const bulkModerateResources = async (payload: { verificationStatus: string; publishStatus: string; onboardingState: string }) => {
    if (!accessToken || selectedResourceIds.length === 0) {
      return;
    }
    setBusyId("bulk-resource");
    setError(null);
    try {
      await apiPatch("/profiles/resources/moderation/bulk", {
        token: accessToken,
        body: { resourceIds: selectedResourceIds, ...payload }
      });
      setSelectedResourceIds([]);
      await refreshCurrentTab();
      setTab("audit");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setBusyId(null);
    }
  };

  const toggleFamilySelection = (id: string) => {
    setSelectedFamilyIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleResourceSelection = (id: string) => {
    setSelectedResourceIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const deleteResource = async (resourceId: string, displayName: string) => {
    if (!accessToken) return;
    const confirmed = window.confirm(
      `Supprimer définitivement l'allié « ${displayName} » ? Cette action est irréversible (compte et profil effacés de la base).`
    );
    if (!confirmed) return;
    setBusyId(resourceId);
    setError(null);
    try {
      await apiDelete(`/profiles/resource/${resourceId}`, { token: accessToken });
      await refreshCurrentTab();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur lors de la suppression.");
    } finally {
      setBusyId(null);
    }
  };

  const setMaintenance = async (enabled: boolean) => {
    if (!accessToken) {
      return;
    }
    setMaintenanceBusy(true);
    setError(null);
    try {
      const data = await apiPost<MaintenanceStatus>("/maintenance", { token: accessToken, body: { enabled } });
      setMaintenanceStatus(data);
      updateMaintenance(data.enabled);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur lors du changement de mode maintenance");
    } finally {
      setMaintenanceBusy(false);
    }
  };

  type RoleValue = "ADMIN" | "FAMILY" | "RESOURCE";
  const updateUserRole = async (userId: string, role: RoleValue) => {
    if (!accessToken) return;
    setBusyId(`role-${userId}`);
    setError(null);
    try {
      await apiPatch(`/users/${userId}/role`, { token: accessToken, body: { role } });
      await refreshCurrentTab();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur lors du changement de rôle");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <main className="mx-auto max-w-6xl space-y-4 overflow-x-hidden px-4 py-6 sm:p-6">
      <h1 className="text-2xl font-semibold">Console d’administration</h1>
      <RequireAuth>
        {loadingMe ? <Alert tone="info">Vérification du rôle administrateur…</Alert> : null}
        {error ? <Alert tone="error">{error}</Alert> : null}
        {me && !isAdmin ? <Alert tone="error">Accès refusé : ce compte n&apos;est pas administrateur.</Alert> : null}

        {isAdmin ? (
          <>
            <Card className={`mb-4 space-y-2 ${ADMIN_CARD_CLASS}`}>
              <h2 className="text-lg font-medium">Mode maintenance</h2>
              <p className="text-sm text-slate-400">
                {maintenanceStatus?.enabled
                  ? "Le site affiche une page maintenance pour les visiteurs. Seuls /health et cette console restent utilisables."
                  : "Le site est normalement accessible."}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant={maintenanceStatus?.enabled ? "primary" : "secondary"}
                  disabled={maintenanceBusy}
                  onClick={() => void setMaintenance(true)}
                >
                  Activer la maintenance
                </Button>
                <Button
                  variant={!maintenanceStatus?.enabled ? "primary" : "secondary"}
                  disabled={maintenanceBusy}
                  onClick={() => void setMaintenance(false)}
                >
                  Désactiver la maintenance
                </Button>
              </div>
              {maintenanceStatus?.updatedAt ? (
                <p className="text-xs text-slate-500">
                  Dernière modification : {new Date(maintenanceStatus.updatedAt).toLocaleString("fr-CA")}
                </p>
              ) : null}
            </Card>

            <SystemStatusPanel
              status={systemStatus}
              loading={systemLoading}
              error={systemError}
              onRefresh={() => void refreshSystemStatus()}
            />

            <div className="flex flex-wrap gap-2">
              <Button variant={tab === "families" ? "primary" : "secondary"} onClick={() => setTab("families")}>
                Familles
              </Button>
              <Button variant={tab === "resources" ? "primary" : "secondary"} onClick={() => setTab("resources")}>
                Alliés
              </Button>
              <Button variant={tab === "audit" ? "primary" : "secondary"} onClick={() => setTab("audit")}>
                Audit
              </Button>
            </div>

            {tab === "families" ? (
              <Card className={`space-y-3 ${ADMIN_CARD_CLASS}`}>
                <div className="grid min-w-0 gap-2 md:grid-cols-5">
                  <Input placeholder="Recherche courriel, nom, ville, code postal" value={familyQuery} onChange={(e) => setFamilyQuery(e.target.value)} />
                  <select className={SELECT_CLASS} value={familyStatus} onChange={(e) => setFamilyStatus(e.target.value)}>
                    <option value="">Tous les statuts</option>
                    <option value="ACTIVE">Actif</option>
                    <option value="BANNED">Banni</option>
                  </select>
                  <select className={SELECT_CLASS} value={familySortBy} onChange={(e) => setFamilySortBy(e.target.value)}>
                    <option value="createdAt">Tri : création</option>
                    <option value="email">Tri : courriel</option>
                    <option value="status">Tri : statut</option>
                  </select>
                  <select className={SELECT_CLASS} value={familySortOrder} onChange={(e) => setFamilySortOrder(e.target.value)}>
                    <option value="desc">Décroissant</option>
                    <option value="asc">Croissant</option>
                  </select>
                  <Button variant="secondary" onClick={() => void refreshCurrentTab()}>
                    Rafraîchir
                  </Button>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="secondary"
                    disabled={busyId === "bulk-family-ACTIVE" || selectedFamilyIds.length === 0}
                    onClick={() => void bulkUpdateFamilyStatus("ACTIVE")}
                  >
                    Activer sélection ({selectedFamilyIds.length})
                  </Button>
                  <Button
                    disabled={busyId === "bulk-family-BANNED" || selectedFamilyIds.length === 0}
                    onClick={() => void bulkUpdateFamilyStatus("BANNED")}
                  >
                    Bannir sélection ({selectedFamilyIds.length})
                  </Button>
                </div>

                {loadingData ? <Alert tone="info">Chargement des familles…</Alert> : null}
                <div className="min-w-0 space-y-2">
                  {families.map((family) => (
                    <Card key={family.id} className={`space-y-2 ${ADMIN_CARD_CLASS}`}>
                      <label className="flex min-w-0 items-start gap-2">
                        <input type="checkbox" checked={selectedFamilyIds.includes(family.id)} onChange={() => toggleFamilySelection(family.id)} />
                        <div className={`text-sm ${ADMIN_TEXT_CLASS}`}>
                          <p>
                            <strong>{family.profile?.displayName ?? "(sans profil)"}</strong> - {family.email}
                          </p>
                          <p>
                            Statut du compte : {formatLabel(ACCOUNT_STATUS_LABELS, family.status)} | Abonnement :{" "}
                            {formatLabel(SUBSCRIPTION_STATUS_LABELS, family.subscription?.status ?? "INACTIVE")}
                          </p>
                          <p>
                            Localisation: {family.profile?.city ?? "-"}, {family.profile?.region ?? "-"} ({family.profile?.postalCode ?? "-"})
                          </p>
                        </div>
                      </label>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs text-slate-500">Rôle:</span>
                        <select
                          className={SELECT_CLASS}
                          value={family.role}
                          disabled={busyId === `role-${family.id}`}
                          onChange={(e) => void updateUserRole(family.id, e.target.value as RoleValue)}
                        >
                          <option value="FAMILY">Famille</option>
                          <option value="RESOURCE">Allié</option>
                          <option value="ADMIN">Administrateur</option>
                        </select>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button variant="secondary" disabled={busyId === family.id || family.status === "ACTIVE"} onClick={() => void updateFamilyStatus(family.id, "ACTIVE")}>
                          Activer
                        </Button>
                        <Button disabled={busyId === family.id || family.status === "BANNED"} onClick={() => void updateFamilyStatus(family.id, "BANNED")}>
                          Bannir
                        </Button>
                        <Button
                          variant="secondary"
                          disabled={busyId === `delete-family-${family.id}`}
                          onClick={() =>
                            void deleteFamily(family.id, family.profile?.displayName ?? "(sans profil)", family.email)
                          }
                          className="text-rose-400 hover:bg-rose-900/30 hover:text-rose-300"
                        >
                          Supprimer definitivement
                        </Button>
                      </div>
                    </Card>
                  ))}
                  {!loadingData && families.length === 0 ? <Alert tone="info">Aucune famille trouvée.</Alert> : null}
                </div>

                <PaginationControls
                  page={familiesMeta.page}
                  totalPages={familiesMeta.totalPages}
                  total={familiesMeta.total}
                  onPrev={() => setFamiliesMeta((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                  onNext={() =>
                    setFamiliesMeta((prev) => ({
                      ...prev,
                      page: Math.min(prev.totalPages, prev.page + 1)
                    }))
                  }
                />
              </Card>
            ) : null}

            {tab === "resources" ? (
              <Card className={`space-y-3 ${ADMIN_CARD_CLASS}`}>
                <div className="grid min-w-0 gap-2 md:grid-cols-6">
                  <Input placeholder="Recherche nom, courriel, ville, code postal" value={resourceQuery} onChange={(e) => setResourceQuery(e.target.value)} />
                  <select className={SELECT_CLASS} value={verificationStatus} onChange={(e) => setVerificationStatus(e.target.value)}>
                    <option value="">Vérification : toutes</option>
                    <option value="DRAFT">Brouillon</option>
                    <option value="PENDING_VERIFICATION">En attente de vérification</option>
                    <option value="VERIFIED">Vérifié</option>
                    <option value="REJECTED">Rejeté</option>
                  </select>
                  <select className={SELECT_CLASS} value={publishStatus} onChange={(e) => setPublishStatus(e.target.value)}>
                    <option value="">Publication : toutes</option>
                    <option value="HIDDEN">Masqué</option>
                    <option value="PUBLISHED">Publié</option>
                    <option value="SUSPENDED">Suspendu</option>
                  </select>
                  <select className={SELECT_CLASS} value={resourceSortBy} onChange={(e) => setResourceSortBy(e.target.value)}>
                    <option value="updatedAt">Tri : mise à jour</option>
                    <option value="displayName">Tri : nom</option>
                    <option value="verificationStatus">Tri : vérification</option>
                    <option value="publishStatus">Tri : publication</option>
                  </select>
                  <select className={SELECT_CLASS} value={resourceSortOrder} onChange={(e) => setResourceSortOrder(e.target.value)}>
                    <option value="desc">Décroissant</option>
                    <option value="asc">Croissant</option>
                  </select>
                  <Button variant="secondary" onClick={() => void refreshCurrentTab()}>
                    Rafraîchir
                  </Button>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="secondary"
                    disabled={busyId === "bulk-resource" || selectedResourceIds.length === 0 || !selectedResourcesComplete}
                    onClick={() =>
                      void bulkModerateResources({
                        verificationStatus: "VERIFIED",
                        publishStatus: "PUBLISHED",
                        onboardingState: "PUBLISHED"
                      })
                    }
                  >
                    Approuver sélection ({selectedResourceIds.length})
                  </Button>
                  <Button
                    disabled={busyId === "bulk-resource" || selectedResourceIds.length === 0}
                    onClick={() =>
                      void bulkModerateResources({
                        verificationStatus: "REJECTED",
                        publishStatus: "SUSPENDED",
                        onboardingState: "SUSPENDED"
                      })
                    }
                  >
                    Rejeter sélection ({selectedResourceIds.length})
                  </Button>
                </div>

                {loadingData ? <Alert tone="info">Chargement des alliés…</Alert> : null}
                <div className="min-w-0 space-y-2">
                  {resources.map((resource) => (
                    <Card key={resource.id} className={`space-y-2 ${ADMIN_CARD_CLASS}`}>
                      <label className="flex min-w-0 items-start gap-2">
                        <input type="checkbox" checked={selectedResourceIds.includes(resource.id)} onChange={() => toggleResourceSelection(resource.id)} />
                        <div className={`text-sm ${ADMIN_TEXT_CLASS}`}>
                          <p>
                            <strong>{resource.displayName}</strong> - {resource.user.email}
                          </p>
                          <p>
                            États: {formatLabel(VERIFICATION_STATUS_LABELS, resource.verificationStatus)} /{" "}
                            {formatLabel(PUBLISH_STATUS_LABELS, resource.publishStatus)} /{" "}
                            {formatLabel(ONBOARDING_STATE_LABELS, resource.onboardingState)}
                            {resource.backgroundCheckStatus
                              ? ` · Antécédents: ${formatLabel(BACKGROUND_CHECK_STATUS_LABELS, resource.backgroundCheckStatus)}`
                              : null}
                          </p>
                          <p>
                            Localisation: {resource.city}, {resource.region} ({resource.postalCode})
                          </p>
                          {resource.streetAddress ? (
                            <p className="break-words text-slate-400">Adresse : {resource.streetAddress}</p>
                          ) : null}
                          {resource.allyDeclarationsAcceptedAt ? (
                            <p className="text-xs text-slate-500">
                              Déclarations formulaire allié :{" "}
                              {new Date(resource.allyDeclarationsAcceptedAt).toLocaleString("fr-CA")}
                            </p>
                          ) : null}
                          <p className={resource.documentRequirements?.complete ? "text-xs text-emerald-300" : "text-xs text-amber-200"}>
                            Documents : {resource.documentRequirements?.complete ? "complets" : "incomplets"}
                            {resource.documentRequirements?.missing?.length
                              ? ` - manquants: ${resource.documentRequirements.missing.map((type) => formatLabel(DOCUMENT_TYPE_LABELS, type)).join(", ")}`
                              : null}
                          </p>
                          <details className="mt-1 text-xs">
                            <summary className="cursor-pointer text-cyan-400">Documents privés</summary>
                            <div className="mt-2">
                              <ResourceDocumentsPanel token={accessToken} resourceId={resource.id} admin compact />
                            </div>
                          </details>
                          {resource.allyRegistration ? (
                            <details className="mt-1 text-xs">
                              <summary className="cursor-pointer text-cyan-400">Dossier candidature allié (JSON)</summary>
                              <pre className="mt-2 max-h-48 max-w-full overflow-auto rounded bg-slate-950 p-2 text-[10px] text-slate-300">
                                {JSON.stringify(resource.allyRegistration, null, 2)}
                              </pre>
                            </details>
                          ) : null}
                        </div>
                      </label>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs text-slate-500">Rôle:</span>
                        <select
                          className={SELECT_CLASS}
                          value={resource.user.role ?? "RESOURCE"}
                          disabled={busyId === `role-${resource.user.id}`}
                          onChange={(e) => void updateUserRole(resource.user.id, e.target.value as RoleValue)}
                        >
                          <option value="FAMILY">Famille</option>
                          <option value="RESOURCE">Allié</option>
                          <option value="ADMIN">Administrateur</option>
                        </select>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs text-slate-500">Antécédents:</span>
                        <select
                          className={SELECT_CLASS}
                          value={resource.backgroundCheckStatus ?? "NOT_REQUESTED"}
                          disabled={busyId === resource.id}
                          onChange={(e) =>
                            void moderateResource(resource.id, {
                              verificationStatus: resource.verificationStatus,
                              publishStatus: resource.publishStatus,
                              onboardingState: resource.onboardingState,
                              backgroundCheckStatus: e.target.value
                            })
                          }
                        >
                          <option value="NOT_REQUESTED">Non demandée</option>
                          <option value="REQUESTED">Demandée (engagement)</option>
                          <option value="PENDING">En attente</option>
                          <option value="RECEIVED">Reçue</option>
                        </select>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="secondary"
                          disabled={busyId === resource.id || !resource.documentRequirements?.complete}
                          onClick={() =>
                            void moderateResource(resource.id, {
                              verificationStatus: "VERIFIED",
                              publishStatus: "PUBLISHED",
                              onboardingState: "PUBLISHED"
                            })
                          }
                        >
                          Approuver + publier
                        </Button>
                        <Button
                          disabled={busyId === resource.id}
                          onClick={() =>
                            void moderateResource(resource.id, {
                              verificationStatus: "REJECTED",
                              publishStatus: "SUSPENDED",
                              onboardingState: "SUSPENDED"
                            })
                          }
                        >
                          Rejeter / suspendre
                        </Button>
                        <Button
                          variant="secondary"
                          disabled={busyId === resource.id}
                          onClick={() => void deleteResource(resource.id, resource.displayName)}
                          className="text-rose-400 hover:text-rose-300 hover:bg-rose-900/30"
                        >
                          Supprimer (effacer de la base)
                        </Button>
                      </div>
                    </Card>
                  ))}
                  {!loadingData && resources.length === 0 ? <Alert tone="info">Aucun allié trouvé.</Alert> : null}
                </div>

                <PaginationControls
                  page={resourcesMeta.page}
                  totalPages={resourcesMeta.totalPages}
                  total={resourcesMeta.total}
                  onPrev={() => setResourcesMeta((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                  onNext={() =>
                    setResourcesMeta((prev) => ({
                      ...prev,
                      page: Math.min(prev.totalPages, prev.page + 1)
                    }))
                  }
                />
              </Card>
            ) : null}

            {tab === "audit" ? (
              <Card className={`space-y-3 ${ADMIN_CARD_CLASS}`}>
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" onClick={() => void refreshCurrentTab()}>
                    Rafraîchir
                  </Button>
                </div>
                {loadingData ? <Alert tone="info">Chargement de l&apos;audit…</Alert> : null}
                <div className="min-w-0 space-y-2">
                  {auditItems.map((item) => (
                    <Card key={item.id} className={`text-sm ${ADMIN_CARD_CLASS}`}>
                      <p>
                        <strong>{item.action}</strong> - {item.targetType}:{item.targetId}
                      </p>
                      <p>
                        Par {item.actorUser?.email ?? item.actorUserId} à {new Date(item.createdAt).toLocaleString("fr-CA")}
                      </p>
                      <pre className="max-w-full overflow-auto text-xs opacity-80">{JSON.stringify(item.payload, null, 2)}</pre>
                    </Card>
                  ))}
                  {!loadingData && auditItems.length === 0 ? <Alert tone="info">Aucun log pour le moment.</Alert> : null}
                </div>

                <PaginationControls
                  page={auditMeta.page}
                  totalPages={auditMeta.totalPages}
                  total={auditMeta.total}
                  onPrev={() => setAuditMeta((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                  onNext={() => setAuditMeta((prev) => ({ ...prev, page: Math.min(prev.totalPages, prev.page + 1) }))}
                />
              </Card>
            ) : null}
          </>
        ) : null}
      </RequireAuth>
    </main>
  );
}

function SystemStatusPanel({
  status,
  loading,
  error,
  onRefresh
}: {
  status: SystemStatus | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}) {
  return (
    <Card className={`mb-4 space-y-4 ${ADMIN_CARD_CLASS}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-medium">Etat VPS</h2>
          <p className="text-xs text-slate-500">
            {status ? `Derniere lecture : ${new Date(status.generatedAt).toLocaleString("fr-CA")}` : "Lecture non disponible"}
          </p>
        </div>
        <Button variant="secondary" disabled={loading} onClick={onRefresh}>
          {loading ? "Chargement..." : "Rafraichir"}
        </Button>
      </div>

      {error ? <Alert tone="error">{error}</Alert> : null}
      {!status && !loading && !error ? <Alert tone="info">Aucune mesure chargee.</Alert> : null}

      {status ? (
        <>
          <div className="grid min-w-0 gap-4 md:grid-cols-3">
            <MetricBar label="CPU" valueText={formatPercent(status.cpu.usagePercent)} percent={status.cpu.usagePercent} />
            <MetricBar
              label="Memoire"
              valueText={`${formatBytes(status.memory.usedBytes)} / ${formatBytes(status.memory.totalBytes)}`}
              percent={status.memory.usedPercent}
            />
            <MetricBar
              label="Disque racine"
              valueText={status.disk.root ? `${formatBytes(status.disk.root.usedBytes)} / ${formatBytes(status.disk.root.totalBytes)}` : "-"}
              percent={status.disk.root?.usedPercent ?? null}
            />
          </div>

          <div className="grid min-w-0 gap-3 text-sm md:grid-cols-2">
            <div className="min-w-0 space-y-1">
              <InfoRow label="Serveur" value={`${status.host.hostname} (${status.host.platform} ${status.host.release})`} />
              <InfoRow label="Uptime VPS" value={formatDuration(status.host.uptimeSeconds)} />
              <InfoRow label="CPU" value={`${status.cpu.cores} coeurs - ${status.cpu.model}`} />
              <InfoRow label="Charge" value={status.cpu.loadAverage.map((value) => value.toFixed(2)).join(" / ")} />
            </div>
            <div className="min-w-0 space-y-1">
              <InfoRow label="Process API" value={`PID ${status.process.pid}, Node ${status.process.nodeVersion}`} />
              <InfoRow label="Uptime API" value={formatDuration(status.process.uptimeSeconds)} />
              <InfoRow label="Memoire API" value={`${formatBytes(status.process.memory.rss)} RSS`} />
              <InfoRow
                label="Uploads"
                value={
                  status.disk.uploads
                    ? `${formatBytes(status.disk.uploads.usedBytes)} / ${formatBytes(status.disk.uploads.totalBytes)} (${formatPercent(status.disk.uploads.usedPercent)})`
                    : "-"
                }
              />
            </div>
          </div>
          <p className="text-xs text-slate-500">Portee : {status.scope}</p>
        </>
      ) : null}
    </Card>
  );
}

function MetricBar({ label, valueText, percent }: { label: string; valueText: string; percent: number | null }) {
  const normalizedPercent = typeof percent === "number" && Number.isFinite(percent) ? Math.max(0, Math.min(100, percent)) : 0;
  return (
    <div className="min-w-0 space-y-2">
      <div className="flex min-w-0 items-center justify-between gap-2 text-sm">
        <span className="font-medium">{label}</span>
        <span className="min-w-0 break-words text-right text-slate-300">{valueText}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-800">
        <div className={`h-full ${statusToneClass(percent)}`} style={{ width: `${normalizedPercent}%` }} />
      </div>
      <p className="text-xs text-slate-500">{formatPercent(percent)}</p>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <p className="grid min-w-0 gap-1 sm:grid-cols-[8rem_1fr]">
      <span className="text-slate-500">{label}</span>
      <span className="min-w-0 break-words text-slate-200">{value}</span>
    </p>
  );
}

function PaginationControls({
  page,
  totalPages,
  total,
  onPrev,
  onNext
}: {
  page: number;
  totalPages: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
      <p className="min-w-0">
        Total : <strong>{total}</strong> | Page {page}/{totalPages}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" disabled={page <= 1} onClick={onPrev}>
          Précédent
        </Button>
        <Button variant="secondary" disabled={page >= totalPages} onClick={onNext}>
          Suivant
        </Button>
      </div>
    </div>
  );
}
