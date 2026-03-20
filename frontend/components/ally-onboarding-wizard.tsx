"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { Alert } from "./ui/alert";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Input } from "./ui/input";
import { PasswordStrength } from "./ui/password-strength";
import {
  ALLY_REGISTRATION_VERSION,
  AllyRegistrationPayload,
  emptyAllyRegistration,
  parseAllyRegistrationFromApi
} from "../lib/ally-registration";

export type AllyType = "MENAGE" | "GARDIENS" | "AUTRES";

export type AllyRegisterSubmitPayload = {
  email: string;
  password: string;
  displayName: string;
  postalCode: string;
  city: string;
  region: string;
  allyType: AllyType;
  contactPhone: string;
  acceptPolicy: boolean;
  allyRegistration: AllyRegistrationPayload;
};

type Props = {
  mode: "register" | "update";
  /** Inscription : appelé à la dernière étape. */
  onRegister?: (payload: AllyRegisterSubmitPayload) => Promise<void>;
  /** Mise à jour profil existant */
  onUpdate?: (payload: {
    allyRegistration: AllyRegistrationPayload;
    contactPhone: string;
    displayName: string;
    postalCode: string;
    city: string;
    region: string;
  }) => Promise<void>;
  initialRegistration?: unknown;
  initialDisplayName?: string;
  initialPostalCode?: string;
  initialCity?: string;
  initialRegion?: string;
  initialContactPhone?: string;
  initialAllyType?: AllyType | null;
};

const ALLY_OPTIONS: { value: AllyType; label: string }[] = [
  { value: "MENAGE", label: "Ménage" },
  { value: "GARDIENS", label: "Gardiens" },
  { value: "AUTRES", label: "Autres" }
];

const STEP_LABELS_REGISTER = [
  "Bienvenue",
  "Compte",
  "Type & lieu",
  "Informations générales",
  "Compétences",
  "Offre de service",
  "Engagement",
  "Récapitulatif"
];

export function AllyOnboardingWizard({
  mode,
  onRegister,
  onUpdate,
  initialRegistration,
  initialDisplayName = "",
  initialPostalCode = "",
  initialCity = "",
  initialRegion = "QC",
  initialContactPhone = "",
  initialAllyType = null
}: Props) {
  const isRegister = mode === "register";
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [acceptPolicy, setAcceptPolicy] = useState(false);
  const [allyType, setAllyType] = useState<AllyType | null>(initialAllyType);
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [postalCode, setPostalCode] = useState(initialPostalCode);
  const [city, setCity] = useState(initialCity);
  const [region, setRegion] = useState(initialRegion);
  const [contactPhone, setContactPhone] = useState(initialContactPhone);

  const [reg, setReg] = useState<AllyRegistrationPayload>(() => {
    const parsed = parseAllyRegistrationFromApi(initialRegistration);
    return parsed ?? emptyAllyRegistration();
  });

  const maxStep = isRegister ? 7 : 5;

  useEffect(() => {
    if (isRegister && step === 3 && !reg.section1.sectorServiced.trim() && city.trim()) {
      setReg((r) => ({ ...r, section1: { ...r.section1, sectorServiced: city.trim() } }));
    }
  }, [isRegister, step, city, reg.section1.sectorServiced]);

  const goNext = () => {
    setError(null);
    setStep((s) => Math.min(maxStep, s + 1));
  };
  const goBack = () => {
    setError(null);
    setStep((s) => Math.max(0, s - 1));
  };

  const validateStep = (): string | null => {
    if (!isRegister) {
      if (step === 0) {
        if (!displayName.trim()) return "Nom complet requis.";
        if (!postalCode.trim()) return "Code postal requis.";
        if (!city.trim()) return "Ville requise.";
        if (!region.trim()) return "Région requise.";
        if (!allyType) return "Type d'allié requis.";
      }
      if (step === 1) {
        if (!reg.section1.streetAddress.trim()) return "Adresse requise.";
        if (!reg.section1.sectorServiced.trim()) return "Ville / secteur desservi requis.";
        if (!reg.section1.contactEmail.trim()) return "Courriel de contact requis.";
        if (!contactPhone.trim()) return "Téléphone requis.";
        if (!reg.section1.age18Confirmed) return "Confirmez avoir 18 ans ou plus.";
      }
    } else {
      if (step === 1) {
        if (!email.trim()) return "Courriel requis.";
        if (password.length < 8) return "Mot de passe trop court.";
        if (!acceptPolicy) return "Vous devez accepter la politique de confidentialité.";
      }
      if (step === 2) {
        if (!allyType) return "Choisissez un type d'allié.";
        if (!displayName.trim()) return "Nom complet requis.";
        if (!postalCode.trim()) return "Code postal requis.";
        if (!city.trim()) return "Ville requise.";
        if (!region.trim()) return "Région requise.";
      }
      if (step === 3) {
        if (!reg.section1.streetAddress.trim()) return "Adresse requise.";
        if (!reg.section1.sectorServiced.trim()) return "Secteur desservi requis.";
        if (!reg.section1.contactEmail.trim()) return "Courriel de contact requis.";
        if (!contactPhone.trim()) return "Téléphone requis.";
        if (!reg.section1.age18Confirmed) return "Confirmez avoir 18 ans ou plus.";
      }
    }

    const s2Index = isRegister ? 4 : 2;
    const s3Index = isRegister ? 5 : 3;
    const s4Index = isRegister ? 6 : 4;

    const sec2Step = isRegister ? 4 : 2;
    const sec3Step = isRegister ? 5 : 3;
    const sec4Step = isRegister ? 6 : 4;

    if (step === sec2Step) {
      if (reg.section2.approachChildren.trim().length < 10) {
        return "Décrivez votre approche (au moins 10 caractères).";
      }
    }
    if (step === sec3Step) {
      const repitAny =
        reg.section3.repitSoiree ||
        reg.section3.repitNuit ||
        reg.section3.repitWeekend ||
        reg.section3.repitUrgence;
      if (!repitAny) return "Cochez au moins un type de répit.";
      const ageAny = reg.section3.age0_5 || reg.section3.age6_12 || reg.section3.age12p;
      if (!ageAny) return "Cochez au moins une tranche d'âge.";
      if (!reg.section3.maxChildren.trim()) return "Nombre maximal d'enfants requis.";
      if (!reg.section3.hourlyRateSuggested.trim()) return "Taux horaire suggéré requis.";
      const dispoAny =
        reg.section3.dispoSemaine ||
        reg.section3.dispoSoir ||
        reg.section3.dispoWeekend ||
        reg.section3.dispoFlexible;
      if (!dispoAny) return "Cochez au moins une disponibilité.";
    }
    if (step === sec4Step) {
      const s4 = reg.section4;
      if (
        !s4.canProvideBackgroundCheck ||
        !s4.canProvideTwoRefs ||
        !s4.canProvideRcrProof ||
        !s4.declNoBan ||
        !s4.declNoInvestigation ||
        !s4.declFalseStatement ||
        !s4.declInfoAccurate ||
        !s4.declIntermediary ||
        !s4.declFinancialDirect ||
        !s4.declProfileVisible
      ) {
        return "Toutes les cases de la section Engagement doivent être cochées.";
      }
    }
    return null;
  };

  const handleNext = () => {
    const v = validateStep();
    if (v) {
      setError(v);
      return;
    }
    goNext();
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const v = validateStep();
    if (v) {
      setError(v);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const payloadReg = { ...reg, version: ALLY_REGISTRATION_VERSION };
      if (isRegister && onRegister) {
        await onRegister({
          email: email.trim(),
          password,
          displayName: displayName.trim(),
          postalCode: postalCode.trim(),
          city: city.trim(),
          region: region.trim(),
          allyType: allyType!,
          contactPhone: contactPhone.trim(),
          acceptPolicy,
          allyRegistration: payloadReg
        });
      } else if (onUpdate) {
        await onUpdate({
          allyRegistration: payloadReg,
          contactPhone: contactPhone.trim(),
          displayName: displayName.trim(),
          postalCode: postalCode.trim(),
          city: city.trim(),
          region: region.trim()
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setLoading(false);
    }
  };

  const progressLabel = isRegister
    ? STEP_LABELS_REGISTER[step] ?? ""
    : ["Informations générales", "Compétences", "Offre", "Engagement", "Récap"][step] ?? "";

  const chk = (checked: boolean, onChange: (v: boolean) => void) => (
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      className="mt-1 rounded border-slate-600 bg-slate-800 text-cyan-500"
    />
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-400">
        <span>
          Étape {step + 1} / {maxStep + 1} — {progressLabel}
        </span>
        <div className="h-1 flex-1 min-w-[120px] max-w-xs overflow-hidden rounded-full bg-slate-800">
          <div
            className="h-full bg-cyan-600 transition-all"
            style={{ width: `${((step + 1) / (maxStep + 1)) * 100}%` }}
          />
        </div>
      </div>

      {error ? <Alert tone="error">{error}</Alert> : null}

      {/* Step 0 register only: intro */}
      {isRegister && step === 0 ? (
        <Card className="space-y-3 p-4">
          <h2 className="text-lg font-semibold text-white">Devenir allié(e) répit</h2>
          <p className="text-sm text-slate-300">
            FAB met en relation les familles d&apos;accueil et les alliés. Les ententes financières se font directement
            entre vous et la famille. Ce parcours reprend le{" "}
            <Link href="/formulaire-allie-repit" className="text-cyan-400 underline">
              formulaire officiel de candidature
            </Link>
            .
          </p>
          <p className="text-sm text-slate-400">
            Prévoyez environ 10 minutes. Vous pouvez revenir en arrière à tout moment.
          </p>
          <Button type="button" onClick={goNext}>
            Commencer
          </Button>
        </Card>
      ) : null}

      {/* Register step 1: account */}
      {isRegister && step === 1 ? (
        <Card className="space-y-3 p-4">
          <h2 className="text-lg font-semibold text-white">Votre compte</h2>
          <label className="flex cursor-pointer items-start gap-2 text-sm text-slate-300">
            {chk(acceptPolicy, setAcceptPolicy)}
            <span>
              J&apos;ai lu la{" "}
              <Link href="/confidentialite" className="text-cyan-400 underline">
                Politique de confidentialité
              </Link>{" "}
              et j&apos;accepte le traitement de mes données.
            </span>
          </label>
          <Input type="email" placeholder="Courriel (connexion)" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <Input
            type="password"
            placeholder="Mot de passe (8 car., majuscule, chiffre, spécial)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
          />
          <PasswordStrength password={password} />
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={goBack}>
              Retour
            </Button>
            <Button type="button" onClick={handleNext}>
              Suivant
            </Button>
          </div>
        </Card>
      ) : null}

      {/* Register step 2 / Update step 0: type + location */}
      {((isRegister && step === 2) || (!isRegister && step === 0)) ? (
        <Card className="space-y-3 p-4">
          <h2 className="text-lg font-semibold text-white">Type d&apos;allié et localisation</h2>
          <p className="text-sm text-slate-400">Choisissez le type qui correspond le mieux à votre offre.</p>
          <div className="flex flex-wrap gap-2">
            {ALLY_OPTIONS.map(({ value, label }) => (
              <Button
                key={value}
                type="button"
                variant={allyType === value ? "primary" : "secondary"}
                onClick={() => setAllyType(value)}
              >
                {label}
              </Button>
            ))}
          </div>
          <Input placeholder="Nom complet" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
          <Input placeholder="Code postal" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} required />
          <Input placeholder="Ville" value={city} onChange={(e) => setCity(e.target.value)} required />
          <Input placeholder="Région (ex: QC)" value={region} onChange={(e) => setRegion(e.target.value)} required />
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={goBack}>
              Retour
            </Button>
            <Button type="button" onClick={handleNext}>
              Suivant
            </Button>
          </div>
        </Card>
      ) : null}

      {/* Section 1 suite: register step 3 / update step 1 */}
      {((isRegister && step === 3) || (!isRegister && step === 1)) ? (
        <Card className="space-y-3 p-4">
          <h2 className="text-lg font-semibold text-white">Section 1 — Informations générales</h2>
          <Input
            placeholder="Ville / secteur desservi"
            value={reg.section1.sectorServiced}
            onChange={(e) => setReg((r) => ({ ...r, section1: { ...r.section1, sectorServiced: e.target.value } }))}
          />
          <p className="text-xs text-slate-500">Souvent identique à votre ville ; précisez si vous couvrez un secteur particulier.</p>
          <Input
            placeholder="Adresse postale complète"
            value={reg.section1.streetAddress}
            onChange={(e) => setReg((r) => ({ ...r, section1: { ...r.section1, streetAddress: e.target.value } }))}
          />
          <Input
            type="tel"
            placeholder="Téléphone"
            value={contactPhone}
            onChange={(e) => setContactPhone(e.target.value)}
          />
          <Input
            type="email"
            placeholder="Courriel de contact (visible aux familles après validation)"
            value={reg.section1.contactEmail}
            onChange={(e) => setReg((r) => ({ ...r, section1: { ...r.section1, contactEmail: e.target.value } }))}
          />
          <label className="flex cursor-pointer items-start gap-2 text-sm text-slate-300">
            {chk(reg.section1.age18Confirmed, (v) => setReg((r) => ({ ...r, section1: { ...r.section1, age18Confirmed: v } })))}
            <span>Je confirme avoir 18 ans ou plus.</span>
          </label>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={goBack}>
              Retour
            </Button>
            <Button type="button" onClick={handleNext}>
              Suivant
            </Button>
          </div>
        </Card>
      ) : null}

      {/* Section 2 */}
      {((isRegister && step === 4) || (!isRegister && step === 2)) ? (
        <Card className="space-y-3 p-4">
          <h2 className="text-lg font-semibold text-white">Section 2 — Vos compétences</h2>
          <div className="space-y-2">
            <p className="text-sm text-slate-300">Certification RCR / premiers secours valide</p>
            <select
              className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
              value={reg.section2.rcrValid}
              onChange={(e) =>
                setReg((r) => ({
                  ...r,
                  section2: { ...r.section2, rcrValid: e.target.value as AllyRegistrationPayload["section2"]["rcrValid"] }
                }))
              }
            >
              <option value="yes">Oui</option>
              <option value="no">Non</option>
              <option value="in_progress">En cours</option>
            </select>
          </div>
          <Input
            placeholder="Date d'expiration RCR (si applicable)"
            value={reg.section2.rcrExpiry ?? ""}
            onChange={(e) => setReg((r) => ({ ...r, section2: { ...r.section2, rcrExpiry: e.target.value } }))}
          />
          <div className="space-y-2">
            <p className="text-sm text-slate-300">Formation RCR Niveau C</p>
            <select
              className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
              value={reg.section2.rcrLevelC}
              onChange={(e) =>
                setReg((r) => ({
                  ...r,
                  section2: { ...r.section2, rcrLevelC: e.target.value as "yes" | "no" }
                }))
              }
            >
              <option value="yes">Oui</option>
              <option value="no">Non</option>
            </select>
          </div>
          <div className="space-y-2">
            <p className="text-sm text-slate-300">Expérience avec des enfants</p>
            <select
              className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
              value={reg.section2.experienceChildren}
              onChange={(e) =>
                setReg((r) => ({
                  ...r,
                  section2: {
                    ...r.section2,
                    experienceChildren: e.target.value as AllyRegistrationPayload["section2"]["experienceChildren"]
                  }
                }))
              }
            >
              <option value="lt1">Moins d&apos;un an</option>
              <option value="1_3">1 à 3 ans</option>
              <option value="3_5">3 à 5 ans</option>
              <option value="5p">5 ans et +</option>
            </select>
          </div>
          <div className="space-y-2 text-sm text-slate-300">
            <p>Expériences spécifiques</p>
            <label className="flex items-center gap-2">
              {chk(reg.section2.experienceParticularNeeds, (v) =>
                setReg((r) => ({ ...r, section2: { ...r.section2, experienceParticularNeeds: v } }))
              )}
              Enfants à besoins particuliers
            </label>
            <label className="flex items-center gap-2">
              {chk(reg.section2.experienceFoster, (v) =>
                setReg((r) => ({ ...r, section2: { ...r.section2, experienceFoster: v } }))
              )}
              Enfants placés en famille d&apos;accueil
            </label>
            <label className="flex items-center gap-2">
              {chk(reg.section2.experienceTrauma, (v) =>
                setReg((r) => ({ ...r, section2: { ...r.section2, experienceTrauma: v } }))
              )}
              Enfants ayant vécu des traumas
            </label>
            <Input
              placeholder="Autre (précisez)"
              value={reg.section2.experienceOtherText ?? ""}
              onChange={(e) => setReg((r) => ({ ...r, section2: { ...r.section2, experienceOtherText: e.target.value } }))}
            />
          </div>
          <div>
            <p className="mb-1 text-sm text-slate-300">Votre approche avec les enfants</p>
            <textarea
              className="min-h-24 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
              value={reg.section2.approachChildren}
              onChange={(e) => setReg((r) => ({ ...r, section2: { ...r.section2, approachChildren: e.target.value } }))}
              placeholder="Décrivez brièvement votre approche…"
            />
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={goBack}>
              Retour
            </Button>
            <Button type="button" onClick={handleNext}>
              Suivant
            </Button>
          </div>
        </Card>
      ) : null}

      {/* Section 3 */}
      {((isRegister && step === 5) || (!isRegister && step === 3)) ? (
        <Card className="space-y-3 p-4">
          <h2 className="text-lg font-semibold text-white">Section 3 — Votre offre de service</h2>
          <p className="text-sm text-slate-400">Types de répit offerts</p>
          <div className="grid gap-2 text-sm text-slate-300 sm:grid-cols-2">
            {[
              ["repitSoiree", "Soirée"],
              ["repitNuit", "Nuit"],
              ["repitWeekend", "Week-end"],
              ["repitUrgence", "Urgence / dépannage"]
            ].map(([key, label]) => (
              <label key={key} className="flex items-center gap-2">
                {chk(reg.section3[key as keyof typeof reg.section3] as boolean, (v) =>
                  setReg((r) => ({ ...r, section3: { ...r.section3, [key]: v } }))
                )}
                {label}
              </label>
            ))}
          </div>
          <p className="text-sm text-slate-400">Âges acceptés</p>
          <div className="flex flex-wrap gap-3 text-sm text-slate-300">
            <label className="flex items-center gap-2">
              {chk(reg.section3.age0_5, (v) => setReg((r) => ({ ...r, section3: { ...r.section3, age0_5: v } })))}
              0-5 ans
            </label>
            <label className="flex items-center gap-2">
              {chk(reg.section3.age6_12, (v) => setReg((r) => ({ ...r, section3: { ...r.section3, age6_12: v } })))}
              6-12 ans
            </label>
            <label className="flex items-center gap-2">
              {chk(reg.section3.age12p, (v) => setReg((r) => ({ ...r, section3: { ...r.section3, age12p: v } })))}
              12 ans et +
            </label>
          </div>
          <Input
            placeholder="Nombre maximal d'enfants à la fois"
            value={reg.section3.maxChildren}
            onChange={(e) => setReg((r) => ({ ...r, section3: { ...r.section3, maxChildren: e.target.value } }))}
          />
          <div className="space-y-2">
            <p className="text-sm text-slate-300">Secteur desservi (distance)</p>
            <select
              className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
              value={reg.section3.serviceRadius}
              onChange={(e) =>
                setReg((r) => ({
                  ...r,
                  section3: { ...r.section3, serviceRadius: e.target.value as AllyRegistrationPayload["section3"]["serviceRadius"] }
                }))
              }
            >
              <option value="10">10 km</option>
              <option value="25">25 km</option>
              <option value="50">50 km</option>
              <option value="more">Plus</option>
            </select>
          </div>
          <Input
            placeholder="Taux horaire suggéré ($)"
            value={reg.section3.hourlyRateSuggested}
            onChange={(e) => setReg((r) => ({ ...r, section3: { ...r.section3, hourlyRateSuggested: e.target.value } }))}
          />
          <p className="text-sm text-slate-400">Disponibilités générales</p>
          <div className="grid gap-2 text-sm text-slate-300 sm:grid-cols-2">
            {[
              ["dispoSemaine", "Semaine"],
              ["dispoSoir", "Soir"],
              ["dispoWeekend", "Fin de semaine"],
              ["dispoFlexible", "Flexible"]
            ].map(([key, label]) => (
              <label key={key} className="flex items-center gap-2">
                {chk(reg.section3[key as keyof typeof reg.section3] as boolean, (v) =>
                  setReg((r) => ({ ...r, section3: { ...r.section3, [key]: v } }))
                )}
                {label}
              </label>
            ))}
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={goBack}>
              Retour
            </Button>
            <Button type="button" onClick={handleNext}>
              Suivant
            </Button>
          </div>
        </Card>
      ) : null}

      {/* Section 4 */}
      {((isRegister && step === 6) || (!isRegister && step === 4)) ? (
        <Card className="space-y-3 p-4">
          <h2 className="text-lg font-semibold text-white">Section 4 — Vérifications et engagement</h2>
          <p className="text-sm text-slate-400">Je suis en mesure de fournir (sur demande) :</p>
          <label className="flex items-start gap-2 text-sm text-slate-300">
            {chk(reg.section4.canProvideBackgroundCheck, (v) =>
              setReg((r) => ({ ...r, section4: { ...r.section4, canProvideBackgroundCheck: v } }))
            )}
            Vérification d&apos;antécédents judiciaires valide
          </label>
          <label className="flex items-start gap-2 text-sm text-slate-300">
            {chk(reg.section4.canProvideTwoRefs, (v) =>
              setReg((r) => ({ ...r, section4: { ...r.section4, canProvideTwoRefs: v } }))
            )}
            Deux références professionnelles
          </label>
          <label className="flex items-start gap-2 text-sm text-slate-300">
            {chk(reg.section4.canProvideRcrProof, (v) =>
              setReg((r) => ({ ...r, section4: { ...r.section4, canProvideRcrProof: v } }))
            )}
            Preuve de certification RCR
          </label>
          <p className="pt-2 text-sm font-medium text-white">Déclarations obligatoires</p>
          {(
            [
              ["declNoBan", "Je déclare ne faire l'objet d'aucune interdiction légale me limitant auprès d'enfants."],
              ["declNoInvestigation", "Je déclare ne pas être sous enquête criminelle ou mesure m'empêchant d'offrir des services auprès de mineurs."],
              ["declFalseStatement", "Je comprends qu'une fausse déclaration peut entraîner le refus ou la suspension de mon profil sur FAB."],
              ["declInfoAccurate", "Je confirme que les informations fournies sont exactes."],
              ["declIntermediary", "Je comprends que la plateforme agit uniquement comme intermédiaire de mise en relation."],
              ["declFinancialDirect", "Je comprends que l'entente financière se fait directement entre moi et la famille."],
              ["declProfileVisible", "J'accepte que mon profil soit visible aux familles d'accueil membres."]
            ] as const
          ).map(([key, text]) => (
            <label key={key} className="flex items-start gap-2 text-sm text-slate-300">
              {chk(reg.section4[key], (v) => setReg((r) => ({ ...r, section4: { ...r.section4, [key]: v } })))}
              <span>{text}</span>
            </label>
          ))}
          <div className="flex gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={goBack}>
              Retour
            </Button>
            <Button type="button" onClick={handleNext}>
              Suivant
            </Button>
          </div>
        </Card>
      ) : null}

      {/* Recap */}
      {((isRegister && step === 7) || (!isRegister && step === 5)) ? (
        <Card className="space-y-3 p-4">
          <h2 className="text-lg font-semibold text-white">Récapitulatif</h2>
          <p className="text-sm text-slate-400">
            Vérifiez vos informations avant d&apos;envoyer votre candidature. Vous pourrez la modifier depuis « Mon profil ».
          </p>
          <ul className="space-y-1 text-sm text-slate-300">
            {isRegister ? <li>Courriel : {email}</li> : null}
            <li>Nom : {displayName}</li>
            <li>Type : {allyType}</li>
            <li>
              {city}, {region} — {postalCode}
            </li>
            <li>Téléphone : {contactPhone}</li>
            <li>Contact : {reg.section1.contactEmail}</li>
            <li>Tarif indicatif : {reg.section3.hourlyRateSuggested} $/h</li>
          </ul>
          <form onSubmit={handleSubmit} className="flex gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={goBack}>
              Retour
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Envoi…" : isRegister ? "Créer mon compte allié" : "Enregistrer les modifications"}
            </Button>
          </form>
        </Card>
      ) : null}

    </div>
  );
}
