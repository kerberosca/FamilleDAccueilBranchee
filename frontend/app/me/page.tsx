"use client";

import { useEffect, useState } from "react";
import { Alert } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { RequireAuth } from "../../components/require-auth";
import { apiGet, apiPatch } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";
import { ALLY_QUESTIONNAIRE } from "../../lib/questionnaire-ally";

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
  displayName: string;
  postalCode: string;
  city: string;
  region: string;
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
};

type FormSnapshot = {
  displayName: string;
  postalCode: string;
  city: string;
  region: string;
  bio: string;
  tagsCsv: string;
  hourlyRate: string;
  contactEmail: string;
  contactPhone: string;
  availabilityJson: string;
  questionnaireAnswers?: Record<string, string>;
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
  const { accessToken, logout } = useAuth();
  const [me, setMe] = useState<MeResponse | null>(null);
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
  const [questionnaireValues, setQuestionnaireValues] = useState<Record<string, string>>({});

  const questionnaireDirty =
    initialSnapshot?.questionnaireAnswers !== undefined &&
    ALLY_QUESTIONNAIRE.some(
      (q) => (questionnaireValues[q.id] ?? "") !== (initialSnapshot.questionnaireAnswers?.[q.id] ?? "")
    );
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
        availabilityJson !== initialSnapshot.availabilityJson ||
        questionnaireDirty)
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
        } else         if (meData.role === "RESOURCE") {
          const resource = profileData as ResourceProfileResponse;
          nextSnapshot.tagsCsv = resource.skillsTags?.join(", ") ?? "";
          nextSnapshot.hourlyRate = resource.hourlyRate ? String(resource.hourlyRate) : "";
          nextSnapshot.contactEmail = resource.contactEmail ?? "";
          nextSnapshot.contactPhone = resource.contactPhone ?? "";
          nextSnapshot.questionnaireAnswers = resource.questionnaireAnswers ?? {};
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
          bio: bio || undefined,
          skillsTags: toTags(tagsCsv),
          hourlyRate: hourlyRate ? Number(hourlyRate) : undefined,
          contactEmail: contactEmail || undefined,
          contactPhone: contactPhone || undefined,
          availability: parseAvailabilityOrThrow(availabilityJson),
          questionnaireAnswers: questionnaireValues
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
        bio,
        tagsCsv,
        hourlyRate,
        contactEmail,
        contactPhone,
        availabilityJson,
        questionnaireAnswers: questionnaireValues
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
          <Card>
            <pre className="overflow-auto text-sm">{JSON.stringify(me, null, 2)}</pre>
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
            <h3 className="text-base font-medium pt-2 border-t border-slate-700 mt-2">Questionnaire allié</h3>
            <p className="text-sm text-slate-400">Répondez aux questions ci-dessous. Vous pourrez les modifier plus tard.</p>
            {ALLY_QUESTIONNAIRE.map((q) =>
              q.type === "choice" ? (
                <div key={q.id} className="space-y-1">
                  <label className="text-sm text-slate-300">{q.label}</label>
                  <select
                    className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
                    value={questionnaireValues[q.id] ?? ""}
                    onChange={(e) =>
                      setQuestionnaireValues((prev) => ({ ...prev, [q.id]: e.target.value }))
                    }
                  >
                    <option value="">— Choisir —</option>
                    {q.options?.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div key={q.id} className="space-y-1">
                  <label className="text-sm text-slate-300">{q.label}</label>
                  <textarea
                    className="min-h-20 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
                    placeholder="Votre réponse..."
                    value={questionnaireValues[q.id] ?? ""}
                    onChange={(e) =>
                      setQuestionnaireValues((prev) => ({ ...prev, [q.id]: e.target.value }))
                    }
                  />
                </div>
              )
            )}
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
      </RequireAuth>
    </main>
  );

  function applySnapshot(snapshot: FormSnapshot) {
    setDisplayName(snapshot.displayName);
    setPostalCode(snapshot.postalCode);
    setCity(snapshot.city);
    setRegion(snapshot.region);
    setBio(snapshot.bio);
    setTagsCsv(snapshot.tagsCsv);
    setHourlyRate(snapshot.hourlyRate);
    setContactEmail(snapshot.contactEmail);
    setContactPhone(snapshot.contactPhone);
    setAvailabilityJson(snapshot.availabilityJson);
    setQuestionnaireValues(snapshot.questionnaireAnswers ?? {});
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
