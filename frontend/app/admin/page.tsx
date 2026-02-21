"use client";

import { useEffect, useMemo, useState } from "react";
import { Alert } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { RequireAuth } from "../../components/require-auth";
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
  verificationStatus: string;
  publishStatus: string;
  onboardingState: string;
  backgroundCheckStatus?: string;
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

const SELECT_CLASS = "rounded-md border border-slate-700 bg-slate-900 px-3 py-2";

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

  const isAdmin = me?.role === "ADMIN";

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
      setError(e instanceof Error ? e.message : "Erreur lors du changement de role");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <main className="mx-auto max-w-6xl space-y-4 p-6">
      <h1 className="text-2xl font-semibold">Console Admin</h1>
      <RequireAuth>
        {loadingMe ? <Alert tone="info">Verification du role admin...</Alert> : null}
        {error ? <Alert tone="error">{error}</Alert> : null}
        {me && !isAdmin ? <Alert tone="error">Acces refuse: ce compte n&apos;est pas ADMIN.</Alert> : null}

        {isAdmin ? (
          <>
            <Card className="mb-4 space-y-2">
              <h2 className="text-lg font-medium">Mode maintenance</h2>
              <p className="text-sm text-slate-400">
                {maintenanceStatus?.enabled
                  ? "Le site affiche une page maintenance pour les visiteurs. Seuls /health et cette console restent utilisables."
                  : "Le site est normalement accessible."}
              </p>
              <div className="flex items-center gap-2">
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
                  Desactiver la maintenance
                </Button>
              </div>
              {maintenanceStatus?.updatedAt ? (
                <p className="text-xs text-slate-500">
                  Derniere modification : {new Date(maintenanceStatus.updatedAt).toLocaleString("fr-CA")}
                </p>
              ) : null}
            </Card>

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
              <Card className="space-y-3">
                <div className="grid gap-2 md:grid-cols-5">
                  <Input placeholder="Recherche email, nom, ville, code postal" value={familyQuery} onChange={(e) => setFamilyQuery(e.target.value)} />
                  <select className={SELECT_CLASS} value={familyStatus} onChange={(e) => setFamilyStatus(e.target.value)}>
                    <option value="">Tous statuts</option>
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="BANNED">BANNED</option>
                  </select>
                  <select className={SELECT_CLASS} value={familySortBy} onChange={(e) => setFamilySortBy(e.target.value)}>
                    <option value="createdAt">Tri: creation</option>
                    <option value="email">Tri: email</option>
                    <option value="status">Tri: statut</option>
                  </select>
                  <select className={SELECT_CLASS} value={familySortOrder} onChange={(e) => setFamilySortOrder(e.target.value)}>
                    <option value="desc">desc</option>
                    <option value="asc">asc</option>
                  </select>
                  <Button variant="secondary" onClick={() => void refreshCurrentTab()}>
                    Rafraichir
                  </Button>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="secondary"
                    disabled={busyId === "bulk-family-ACTIVE" || selectedFamilyIds.length === 0}
                    onClick={() => void bulkUpdateFamilyStatus("ACTIVE")}
                  >
                    Activer selection ({selectedFamilyIds.length})
                  </Button>
                  <Button
                    disabled={busyId === "bulk-family-BANNED" || selectedFamilyIds.length === 0}
                    onClick={() => void bulkUpdateFamilyStatus("BANNED")}
                  >
                    Bannir selection ({selectedFamilyIds.length})
                  </Button>
                </div>

                {loadingData ? <Alert tone="info">Chargement des familles...</Alert> : null}
                <div className="space-y-2">
                  {families.map((family) => (
                    <Card key={family.id} className="space-y-2">
                      <label className="flex items-start gap-2">
                        <input type="checkbox" checked={selectedFamilyIds.includes(family.id)} onChange={() => toggleFamilySelection(family.id)} />
                        <div className="text-sm">
                          <p>
                            <strong>{family.profile?.displayName ?? "(sans profil)"}</strong> - {family.email}
                          </p>
                          <p>
                            Statut user: {family.status} | Abonnement: {family.subscription?.status ?? "INACTIVE"}
                          </p>
                          <p>
                            Localisation: {family.profile?.city ?? "-"}, {family.profile?.region ?? "-"} ({family.profile?.postalCode ?? "-"})
                          </p>
                        </div>
                      </label>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs text-slate-500">Role:</span>
                        <select
                          className={SELECT_CLASS}
                          value={family.role}
                          disabled={busyId === `role-${family.id}`}
                          onChange={(e) => void updateUserRole(family.id, e.target.value as RoleValue)}
                        >
                          <option value="FAMILY">FAMILY</option>
                          <option value="RESOURCE">RESOURCE</option>
                          <option value="ADMIN">ADMIN</option>
                        </select>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="secondary" disabled={busyId === family.id || family.status === "ACTIVE"} onClick={() => void updateFamilyStatus(family.id, "ACTIVE")}>
                          Activer
                        </Button>
                        <Button disabled={busyId === family.id || family.status === "BANNED"} onClick={() => void updateFamilyStatus(family.id, "BANNED")}>
                          Bannir
                        </Button>
                      </div>
                    </Card>
                  ))}
                  {!loadingData && families.length === 0 ? <Alert tone="info">Aucune famille trouvee.</Alert> : null}
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
              <Card className="space-y-3">
                <div className="grid gap-2 md:grid-cols-6">
                  <Input placeholder="Recherche nom, email, ville, code postal" value={resourceQuery} onChange={(e) => setResourceQuery(e.target.value)} />
                  <select className={SELECT_CLASS} value={verificationStatus} onChange={(e) => setVerificationStatus(e.target.value)}>
                    <option value="">Verification: toutes</option>
                    <option value="DRAFT">DRAFT</option>
                    <option value="PENDING_VERIFICATION">PENDING_VERIFICATION</option>
                    <option value="VERIFIED">VERIFIED</option>
                    <option value="REJECTED">REJECTED</option>
                  </select>
                  <select className={SELECT_CLASS} value={publishStatus} onChange={(e) => setPublishStatus(e.target.value)}>
                    <option value="">Publication: toutes</option>
                    <option value="HIDDEN">HIDDEN</option>
                    <option value="PUBLISHED">PUBLISHED</option>
                    <option value="SUSPENDED">SUSPENDED</option>
                  </select>
                  <select className={SELECT_CLASS} value={resourceSortBy} onChange={(e) => setResourceSortBy(e.target.value)}>
                    <option value="updatedAt">Tri: mise a jour</option>
                    <option value="displayName">Tri: nom</option>
                    <option value="verificationStatus">Tri: verification</option>
                    <option value="publishStatus">Tri: publication</option>
                  </select>
                  <select className={SELECT_CLASS} value={resourceSortOrder} onChange={(e) => setResourceSortOrder(e.target.value)}>
                    <option value="desc">desc</option>
                    <option value="asc">asc</option>
                  </select>
                  <Button variant="secondary" onClick={() => void refreshCurrentTab()}>
                    Rafraichir
                  </Button>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="secondary"
                    disabled={busyId === "bulk-resource" || selectedResourceIds.length === 0}
                    onClick={() =>
                      void bulkModerateResources({
                        verificationStatus: "VERIFIED",
                        publishStatus: "PUBLISHED",
                        onboardingState: "PUBLISHED"
                      })
                    }
                  >
                    Approuver selection ({selectedResourceIds.length})
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
                    Rejeter selection ({selectedResourceIds.length})
                  </Button>
                </div>

                {loadingData ? <Alert tone="info">Chargement des alliés...</Alert> : null}
                <div className="space-y-2">
                  {resources.map((resource) => (
                    <Card key={resource.id} className="space-y-2">
                      <label className="flex items-start gap-2">
                        <input type="checkbox" checked={selectedResourceIds.includes(resource.id)} onChange={() => toggleResourceSelection(resource.id)} />
                        <div className="text-sm">
                          <p>
                            <strong>{resource.displayName}</strong> - {resource.user.email}
                          </p>
                          <p>
                            Etats: {resource.verificationStatus} / {resource.publishStatus} / {resource.onboardingState}
                            {resource.backgroundCheckStatus ? ` · Antécédents: ${resource.backgroundCheckStatus}` : null}
                          </p>
                          <p>
                            Localisation: {resource.city}, {resource.region} ({resource.postalCode})
                          </p>
                        </div>
                      </label>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs text-slate-500">Role:</span>
                        <select
                          className={SELECT_CLASS}
                          value={resource.user.role ?? "RESOURCE"}
                          disabled={busyId === `role-${resource.user.id}`}
                          onChange={(e) => void updateUserRole(resource.user.id, e.target.value as RoleValue)}
                        >
                          <option value="FAMILY">FAMILY</option>
                          <option value="RESOURCE">RESOURCE</option>
                          <option value="ADMIN">ADMIN</option>
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
                          disabled={busyId === resource.id}
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
              <Card className="space-y-3">
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => void refreshCurrentTab()}>
                    Rafraichir
                  </Button>
                </div>
                {loadingData ? <Alert tone="info">Chargement de l&apos;audit...</Alert> : null}
                <div className="space-y-2">
                  {auditItems.map((item) => (
                    <Card key={item.id} className="text-sm">
                      <p>
                        <strong>{item.action}</strong> - {item.targetType}:{item.targetId}
                      </p>
                      <p>
                        Par {item.actorUser?.email ?? item.actorUserId} a {new Date(item.createdAt).toLocaleString("fr-CA")}
                      </p>
                      <pre className="overflow-auto text-xs opacity-80">{JSON.stringify(item.payload, null, 2)}</pre>
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
    <div className="flex items-center justify-between gap-2 text-sm">
      <p>
        Total: <strong>{total}</strong> | Page {page}/{totalPages}
      </p>
      <div className="flex gap-2">
        <Button variant="secondary" disabled={page <= 1} onClick={onPrev}>
          Precedent
        </Button>
        <Button variant="secondary" disabled={page >= totalPages} onClick={onNext}>
          Suivant
        </Button>
      </div>
    </div>
  );
}
