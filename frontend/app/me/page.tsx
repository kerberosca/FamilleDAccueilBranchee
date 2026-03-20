"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { RequireAuth } from "../../components/require-auth";
import { apiDelete, apiGet, apiPatch } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";

type MeResponse = {
  id: string;
  email: string;
  role: string;
  status: string;
  createdAt?: string;
  updatedAt?: string;
};

type FamilyProfileResponse = {
  id: string;
  userId: string;
  displayName: string;
  postalCode: string;
  city: string;
  region: string;
  bio?: string | null;
  needsTags: string[];
  availability?: unknown;
};

type ResourceProfileResponse = {
  id: string;
  userId: string;
  allyType?: string | null;
  displayName: string;
  postalCode: string;
  city: string;
  region: string;
  streetAddress?: string | null;
  bio?: string | null;
  skillsTags: string[];
  hourlyRate?: string | number | null;
  availability?: unknown;
  verificationStatus: string;
  publishStatus: string;
  onboardingState: string;
  contactEmail?: string | null;
  contactPhone?: string | null;
  questionnaireAnswers?: Record<string, string> | null;
  allyRegistration?: unknown;
  allyDeclarationsAcceptedAt?: string | null;
  backgroundCheckStatus?: string | null;
};

type FormSnapshot = {
  displayName: string;
  postalCode: string;
  city: string;
  region: string;
  streetAddress: string;
  bio: string;
  tagsCsv: string;
  hourlyRate: string;
  contactEmail: string;
  contactPhone: string;
  availabilityJson: string;
  backgroundCheckStatus?: string;
};

type FieldErrors = Partial<
  Record<
    | "displayName"
    | "postalCode"
    | "city"
    | "region"
    | "availabilityJson"
    | "hourlyRate"
    | "contactEmail",
    string
  >
>;

export default function MePage() {
  const router = useRouter();
  const { accessToken, logout } = useAuth();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [profile, setProfile] = useState<FamilyProfileResponse | ResourceProfileResponse | null>(null);
  const [initialSnapshot, setInitialSnapshot] = useState<FormSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const [displayName, setDisplayName] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [city, setCity] = useState("");
  const [region, setRegion] = useState("");
  const [bio, setBio] = useState("");
  const [tagsCsv, setTagsCsv] = useState("");
  const [hourlyRate, setHourlyRate] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [availabilityJson, setAvailabilityJson] = useState("");
  const [streetAddress, setStreetAddress] = useState("");
  const [backgroundCheckStatus, setBackgroundCheckStatus] = useState<string>("NOT_REQUESTED");

  const backgroundCheckDirty =
    initialSnapshot?.backgroundCheckStatus !== undefined &&
    backgroundCheckStatus !== (initialSnapshot.backgroundCheckStatus ?? "NOT_REQUESTED");
  const isDirty = Boolean(
    initialSnapshot &&
      (displayName !== initialSnapshot.displayName ||
        postalCode !== initialSnapshot.postalCode ||
        city !== initialSnapshot.city ||
        region !== initialSnapshot.region ||
        bio !== initialSnapshot.bio ||
        tagsCsv !== initialSnapshot.tagsCsv ||
        hourlyRate !== initialSnapshot.hourlyRate ||
        contactEmail !== initialSnapshot.contactEmail ||
        contactPhone !== initialSnapshot.contactPhone ||
        streetAddress !== initialSnapshot.streetAddress ||
        availabilityJson !== initialSnapshot.availabilityJson ||
        backgroundCheckDirty)
  );

  useEffect(() => {
    if (!isDirty) {
      return;
    }
    const warningMessage = "Tu as des modifications non enregistrees. Quitter cette page ?";

    const handleRefreshShortcut = (event: KeyboardEvent) => {
      const isF5 = event.key === "F5";
      const isRefreshCombo = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "r";
      if (!isF5 && !isRefreshCombo) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      const leave = window.confirm(warningMessage);
      if (leave) {
        window.location.reload();
      }
    };

    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      (e as unknown as { returnValue: string }).returnValue = warningMessage;
      return warningMessage;
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    window.addEventListener("keydown", handleRefreshShortcut, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener("keydown", handleRefreshShortcut, true);
    };
  }, [isDirty]);

  useEffect(() => {
    if (!isDirty) {
      return;
    }
    const warningMessage = "Tu as des modifications non enregistrees. Quitter cette page ?";
    const handleDocumentClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const anchor = target?.closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor) {
        return;
      }
      if (anchor.target === "_blank") {
        return;
      }
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) {
        return;
      }
      const nextUrl = new URL(anchor.href, window.location.href);
      const currentUrl = new URL(window.location.href);
      const navigatingAway =
        nextUrl.origin !== currentUrl.origin ||
        nextUrl.pathname !== currentUrl.pathname ||
        nextUrl.search !== currentUrl.search ||
        nextUrl.hash !== currentUrl.hash;

      if (!navigatingAway) {
        return;
      }
      const confirmed = window.confirm(warningMessage);
      if (!confirmed) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    document.addEventListener("click", handleDocumentClick, true);
    return () => {
      document.removeEventListener("click", handleDocumentClick, true);
    };
  }, [isDirty]);

  useEffect(() => {
    (window as { __fabUnsavedChanges?: boolean }).__fabUnsavedChanges = isDirty;
    return () => {
      (window as { __fabUnsavedChanges?: boolean }).__fabUnsavedChanges = false;
    };
  }, [isDirty]);

  const handleLogout = async () => {
    setLoggingOut(true);
    await logout();
    setLoggingOut(false);
  };

  const handleDeleteAccount = async () => {
    if (
      !accessToken ||
      !window.confirm(
        "Êtes-vous sûr de vouloir supprimer définitivement votre compte ? Cette action est irréversible (profil, messages, abonnement). Vous serez déconnecté."
      )
    ) {
      return;
    }
    setDeletingAccount(true);
    setError(null);
    try {
      await apiDelete("/auth/me", { token: accessToken });
      await logout();
      router.push("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur lors de la suppression du compte.");
    } finally {
      setDeletingAccount(false);
    }
  };

  useEffect(() => {
    if (!accessToken) {
      setMe(null);
      setProfile(null);
      return;
    }

    const run = async () => {
      setLoading(true);
      setError(null);
      setSuccess(null);
      setFieldErrors({});
      try {
        const meData = await apiGet<MeResponse>("/users/me", { token: accessToken });
        setMe(meData);

        const profileData = await apiGet<FamilyProfileResponse | ResourceProfileResponse | { userRole: "ADMIN" }>(
          "/profiles/me",
          { token: accessToken }
        );

        if ("userRole" in profileData) {
          setProfile(null);
          return;
        }

        setProfile(profileData);
        const nextSnapshot: FormSnapshot = {
          displayName: profileData.displayName ?? "",
          postalCode: profileData.postalCode ?? "",
          city: profileData.city ?? "",
          region: profileData.region ?? "",
          streetAddress: "",
          bio: (profileData.bio as string | null | undefined) ?? "",
          tagsCsv: "",
          hourlyRate: "",
          contactEmail: "",
          contactPhone: "",
          availabilityJson: profileData.availability ? JSON.stringify(profileData.availability, null, 2) : ""
        };

        if (meData.role === "FAMILY") {
          const family = profileData as FamilyProfileResponse;
          nextSnapshot.tagsCsv = family.needsTags?.join(", ") ?? "";
        } else if (meData.role === "RESOURCE") {
          const resource = profileData as ResourceProfileResponse;
          nextSnapshot.tagsCsv = resource.skillsTags?.join(", ") ?? "";
          nextSnapshot.hourlyRate = resource.hourlyRate ? String(resource.hourlyRate) : "";
          nextSnapshot.contactEmail = resource.contactEmail ?? "";
          nextSnapshot.contactPhone = resource.contactPhone ?? "";
          nextSnapshot.streetAddress = resource.streetAddress ?? "";
          nextSnapshot.backgroundCheckStatus = resource.backgroundCheckStatus ?? "NOT_REQUESTED";
        }
        applySnapshot(nextSnapshot);
        setInitialSnapshot(nextSnapshot);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erreur inconnue");
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, [accessToken]);

  const handleRestore = () => {
    if (!initialSnapshot) {
      return;
    }
    applySnapshot(initialSnapshot);
    setFieldErrors({});
    setError(null);
    setSuccess(null);
  };

  const saveFamilyProfile = async () => {
    if (!accessToken) {
      return;
    }
    const validation = validateCommonFields({
      displayName,
      postalCode,
      city,
      region,
      availabilityJson
    });
    if (Object.keys(validation).length > 0) {
      setFieldErrors(validation);
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    setFieldErrors({});
    try {
      await apiPatch("/profiles/family/me", {
        token: accessToken,
        body: {
          displayName,
          postalCode: normalizePostal(postalCode),
          city,
          region,
          bio: bio || undefined,
          needsTags: toTags(tagsCsv),
          availability: parseAvailabilityOrThrow(availabilityJson)
        }
      });
      setSuccess("Profil FAMILY mis a jour.");
      const refreshed = await apiGet<FamilyProfileResponse>("/profiles/me", { token: accessToken });
      setProfile(refreshed);
      const updatedSnapshot: FormSnapshot = {
          displayName,
          postalCode,
          city,
          region,
          streetAddress: "",
          bio,
          tagsCsv,
          hourlyRate: "",
          contactEmail: "",
          contactPhone: "",
          availabilityJson
      };
      setInitialSnapshot(updatedSnapshot);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setSaving(false);
    }
  };

  const saveResourceProfile = async () => {
    if (!accessToken) {
      return;
    }
    const validation = {
      ...validateCommonFields({
        displayName,
        postalCode,
        city,
        region,
        availabilityJson
      }),
      ...validateResourceFields({ hourlyRate, contactEmail })
    };
    if (Object.keys(validation).length > 0) {
      setFieldErrors(validation);
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    setFieldErrors({});
    try {
      await apiPatch("/profiles/resource/me", {
        token: accessToken,
        body: {
          displayName,
          postalCode: normalizePostal(postalCode),
          city,
          region,
          streetAddress: streetAddress.trim() || undefined,
          bio: bio || undefined,
          skillsTags: toTags(tagsCsv),
          hourlyRate: hourlyRate ? Number(hourlyRate) : undefined,
          contactEmail: contactEmail || undefined,
          contactPhone: contactPhone || undefined,
          availability: parseAvailabilityOrThrow(availabilityJson),
          backgroundCheckStatus
        }
      });
      setSuccess("Profil allié mis à jour.");
      const refreshed = await apiGet<ResourceProfileResponse>("/profiles/me", { token: accessToken });
      setProfile(refreshed);
      const updatedSnapshot: FormSnapshot = {
        displayName,
        postalCode,
        city,
        region,
        streetAddress,
        bio,
        tagsCsv,
        hourlyRate,
        contactEmail,
        contactPhone,
        availabilityJson,
        backgroundCheckStatus
      };
      setInitialSnapshot(updatedSnapshot);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="mx-auto max-w-2xl space-y-4 p-6">
      <h1 className="text-2xl font-semibold">Mon profil</h1>
      <RequireAuth>
        <Button variant="secondary" onClick={handleLogout} disabled={loggingOut}>
          {loggingOut ? "Deconnexion..." : "Se deconnecter"}
        </Button>

        {loading ? <Alert tone="info">Chargement du profil...</Alert> : null}
        {isDirty ? (
          <Alert tone="info">Tu as des modifications non enregistrees. Pense a enregistrer avant de quitter la page.</Alert>
        ) : null}
        {error ? <Alert tone="error">{error}</Alert> : null}
        {success ? <Alert tone="info">{success}</Alert> : null}
        {me ? (
          <Card className="space-y-1">
            <p className="text-sm text-slate-300">
              Connecté avec <strong className="text-white">{me.email}</strong>
            </p>
            <p className="text-sm text-slate-400">
              Rôle : {me.role === "ADMIN" ? "Administrateur" : me.role === "FAMILY" ? "Famille" : me.role === "RESOURCE" ? "Allié" : me.role}
            </p>
          </Card>
        ) : null}

        {me?.role === "ADMIN" ? <Alert tone="info">Le role ADMIN n&apos;a pas de profil editable dans cette version.</Alert> : null}

        {me?.role === "FAMILY" ? (
          <Card className="space-y-3">
            <h2 className="text-lg font-medium">Editer mon profil FAMILY</h2>
            <Input
              placeholder="Nom affiche"
              value={displayName}
              onChange={(e) => {
                setDisplayName(e.target.value);
                setFieldErrors((prev) => ({ ...prev, displayName: undefined }));
              }}
            />
            <FieldError error={fieldErrors.displayName} />
            <Input
              placeholder="Code postal"
              value={postalCode}
              onChange={(e) => {
                setPostalCode(e.target.value);
                setFieldErrors((prev) => ({ ...prev, postalCode: undefined }));
              }}
            />
            <FieldError error={fieldErrors.postalCode} />
            <Input
              placeholder="Ville"
              value={city}
              onChange={(e) => {
                setCity(e.target.value);
                setFieldErrors((prev) => ({ ...prev, city: undefined }));
              }}
            />
            <FieldError error={fieldErrors.city} />
            <Input
              placeholder="Region"
              value={region}
              onChange={(e) => {
                setRegion(e.target.value);
                setFieldErrors((prev) => ({ ...prev, region: undefined }));
              }}
            />
            <FieldError error={fieldErrors.region} />
            <Input placeholder="Bio" value={bio} onChange={(e) => setBio(e.target.value)} />
            <Input placeholder="Besoins (CSV)" value={tagsCsv} onChange={(e) => setTagsCsv(e.target.value)} />
            <textarea
              className="min-h-28 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
              placeholder='Disponibilite JSON (optionnel), ex: {"weekend":true}'
              value={availabilityJson}
              onChange={(e) => {
                setAvailabilityJson(e.target.value);
                setFieldErrors((prev) => ({ ...prev, availabilityJson: undefined }));
              }}
            />
            <FieldError error={fieldErrors.availabilityJson} />
            <div className="flex gap-2">
              <Button onClick={saveFamilyProfile} disabled={saving}>
                {saving ? "Enregistrement..." : "Enregistrer le profil FAMILY"}
              </Button>
              <Button variant="secondary" onClick={handleRestore} disabled={saving || !isDirty}>
                Restaurer
              </Button>
            </div>
          </Card>
        ) : null}

        {me?.role === "RESOURCE" ? (
          <Card className="space-y-3">
            <h2 className="text-lg font-medium">Editer mon profil allié</h2>
            <Input
              placeholder="Nom affiche"
              value={displayName}
              onChange={(e) => {
                setDisplayName(e.target.value);
                setFieldErrors((prev) => ({ ...prev, displayName: undefined }));
              }}
            />
            <FieldError error={fieldErrors.displayName} />
            <Input
              placeholder="Code postal"
              value={postalCode}
              onChange={(e) => {
                setPostalCode(e.target.value);
                setFieldErrors((prev) => ({ ...prev, postalCode: undefined }));
              }}
            />
            <FieldError error={fieldErrors.postalCode} />
            <Input
              placeholder="Ville"
              value={city}
              onChange={(e) => {
                setCity(e.target.value);
                setFieldErrors((prev) => ({ ...prev, city: undefined }));
              }}
            />
            <FieldError error={fieldErrors.city} />
            <Input
              placeholder="Region"
              value={region}
              onChange={(e) => {
                setRegion(e.target.value);
                setFieldErrors((prev) => ({ ...prev, region: undefined }));
              }}
            />
            <FieldError error={fieldErrors.region} />
            <Input
              placeholder="Adresse postale"
              value={streetAddress}
              onChange={(e) => setStreetAddress(e.target.value)}
            />
            <Input placeholder="Bio" value={bio} onChange={(e) => setBio(e.target.value)} />
            <Input placeholder="Competences (CSV)" value={tagsCsv} onChange={(e) => setTagsCsv(e.target.value)} />
            <Input
              placeholder="Tarif horaire"
              type="number"
              min="0"
              step="0.01"
              value={hourlyRate}
              onChange={(e) => {
                setHourlyRate(e.target.value);
                setFieldErrors((prev) => ({ ...prev, hourlyRate: undefined }));
              }}
            />
            <FieldError error={fieldErrors.hourlyRate} />
            <Input
              placeholder="Email de contact"
              type="email"
              value={contactEmail}
              onChange={(e) => {
                setContactEmail(e.target.value);
                setFieldErrors((prev) => ({ ...prev, contactEmail: undefined }));
              }}
            />
            <FieldError error={fieldErrors.contactEmail} />
            <Input placeholder="Telephone de contact" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
            <textarea
              className="min-h-28 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
              placeholder='Disponibilite JSON (optionnel), ex: {"soir":"lundi-mardi"}'
              value={availabilityJson}
              onChange={(e) => {
                setAvailabilityJson(e.target.value);
                setFieldErrors((prev) => ({ ...prev, availabilityJson: undefined }));
              }}
            />
            <FieldError error={fieldErrors.availabilityJson} />
            {(profile as ResourceProfileResponse | null)?.verificationStatus ? (
              <Alert tone="info">
                Moderation: {(profile as ResourceProfileResponse).verificationStatus} /{" "}
                {(profile as ResourceProfileResponse).publishStatus}
              </Alert>
            ) : null}
            <h3 className="text-base font-medium pt-2 border-t border-slate-700 mt-2">Vérification d&apos;antécédents judiciaires</h3>
            <p className="text-sm text-slate-400">
              Pour être validé comme allié, une vérification d&apos;antécédents judiciaires est requise. Vous devrez fournir
              les documents demandés selon les modalités communiquées.
            </p>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={backgroundCheckStatus === "REQUESTED"}
                onChange={(e) =>
                  setBackgroundCheckStatus(e.target.checked ? "REQUESTED" : "NOT_REQUESTED")
                }
                className="rounded border-slate-600 bg-slate-800 text-cyan-500"
              />
              <span className="text-sm text-slate-300">
                Je m&apos;engage à fournir une vérification d&apos;antécédents judiciaires
              </span>
            </label>
            <h3 className="text-base font-medium pt-2 border-t border-slate-700 mt-2">Candidature répit (formulaire officiel)</h3>
            <p className="text-sm text-slate-400">
              Les compétences, l&apos;offre de service et les déclarations légales sont enregistrées via le formulaire
              aligné sur la documentation FAB. Pour les modifier, ouvrez l&apos;assistant complet (toutes les sections
              devront être validées à nouveau).
            </p>
            <Link
              href="/me/ally-candidature"
              className="inline-flex rounded-md border border-cyan-500/40 bg-slate-800 px-4 py-2 text-sm font-medium text-cyan-300 hover:bg-slate-700"
            >
              Mettre à jour ma candidature répit
            </Link>
            <div className="flex gap-2">
              <Button onClick={saveResourceProfile} disabled={saving}>
                {saving ? "Enregistrement..." : "Enregistrer le profil allié"}
              </Button>
              <Button variant="secondary" onClick={handleRestore} disabled={saving || !isDirty}>
                Restaurer
              </Button>
            </div>
          </Card>
        ) : null}

        <Card className="mt-6 border-t border-slate-700 pt-4">
          <h2 className="text-lg font-medium text-slate-200">Supprimer mon compte</h2>
          <p className="mt-1 text-sm text-slate-400">
            La suppression est définitive : profil, messages et abonnement seront supprimés. Cette action est irréversible.
          </p>
          <Button
            type="button"
            variant="secondary"
            className="mt-3 border-rose-500/50 text-rose-300 hover:bg-rose-950/50 hover:text-rose-200"
            onClick={handleDeleteAccount}
            disabled={deletingAccount}
          >
            {deletingAccount ? "Suppression…" : "Supprimer mon compte"}
          </Button>
        </Card>
      </RequireAuth>
    </main>
  );

  function applySnapshot(snapshot: FormSnapshot) {
    setDisplayName(snapshot.displayName);
    setPostalCode(snapshot.postalCode);
    setCity(snapshot.city);
    setRegion(snapshot.region);
    setStreetAddress(snapshot.streetAddress);
    setBio(snapshot.bio);
    setTagsCsv(snapshot.tagsCsv);
    setHourlyRate(snapshot.hourlyRate);
    setContactEmail(snapshot.contactEmail);
    setContactPhone(snapshot.contactPhone);
    setAvailabilityJson(snapshot.availabilityJson);
    setBackgroundCheckStatus(snapshot.backgroundCheckStatus ?? "NOT_REQUESTED");
  }
}

function toTags(value: string): string[] | undefined {
  const tags = value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
  return tags.length > 0 ? tags : undefined;
}

function normalizePostal(value: string): string {
  return value.replace(/\s+/g, "").toUpperCase();
}

function parseAvailabilityOrThrow(value: string): unknown {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  try {
    return JSON.parse(trimmed);
  } catch {
    throw new Error("Le champ disponibilite doit contenir un JSON valide.");
  }
}

function validateCommonFields(input: {
  displayName: string;
  postalCode: string;
  city: string;
  region: string;
  availabilityJson: string;
}): FieldErrors {
  const errors: FieldErrors = {};
  if (input.displayName.trim().length < 2) {
    errors.displayName = "Le nom affiche doit contenir au moins 2 caracteres.";
  }
  if (!isValidCanadianPostalCode(input.postalCode)) {
    errors.postalCode = "Code postal invalide (ex: G1R4P5 ou G1R 4P5).";
  }
  if (input.city.trim().length < 2) {
    errors.city = "La ville est requise.";
  }
  if (input.region.trim().length < 2) {
    errors.region = "La region est requise.";
  }
  if (input.availabilityJson.trim()) {
    try {
      JSON.parse(input.availabilityJson.trim());
    } catch {
      errors.availabilityJson = "Disponibilite doit etre un JSON valide.";
    }
  }
  return errors;
}

function validateResourceFields(input: { hourlyRate: string; contactEmail: string }): FieldErrors {
  const errors: FieldErrors = {};
  if (input.hourlyRate.trim()) {
    const value = Number(input.hourlyRate);
    if (Number.isNaN(value) || value < 0) {
      errors.hourlyRate = "Le tarif horaire doit etre un nombre positif.";
    }
  }
  if (input.contactEmail.trim()) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(input.contactEmail.trim())) {
      errors.contactEmail = "Email de contact invalide.";
    }
  }
  return errors;
}

function isValidCanadianPostalCode(value: string): boolean {
  const normalized = value.replace(/\s+/g, "").toUpperCase();
  return /^[ABCEGHJ-NPRSTVXY][0-9][ABCEGHJ-NPRSTV-Z][0-9][ABCEGHJ-NPRSTV-Z][0-9]$/.test(normalized);
}

function FieldError({ error }: { error?: string }) {
  if (!error) {
    return null;
  }
  return <p className="text-sm text-rose-300">{error}</p>;
}
