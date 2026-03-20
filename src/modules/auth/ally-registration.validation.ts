import { BadRequestException } from "@nestjs/common";

/** Version du schéma — incrémenter si les champs obligatoires changent. */
export const ALLY_REGISTRATION_VERSION = "2025-03-repit-v1";

export type AllyRegistrationPayload = {
  version: string;
  section1: {
    sectorServiced: string;
    streetAddress: string;
    contactEmail: string;
    age18Confirmed: boolean;
  };
  section2: {
    rcrValid: "yes" | "no" | "in_progress";
    rcrExpiry?: string;
    rcrLevelC: "yes" | "no";
    experienceChildren: "lt1" | "1_3" | "3_5" | "5p";
    experienceParticularNeeds: boolean;
    experienceFoster: boolean;
    experienceTrauma: boolean;
    experienceOtherText?: string;
    approachChildren: string;
  };
  section3: {
    repitSoiree: boolean;
    repitNuit: boolean;
    repitWeekend: boolean;
    repitUrgence: boolean;
    age0_5: boolean;
    age6_12: boolean;
    age12p: boolean;
    maxChildren: string;
    serviceRadius: "10" | "25" | "50" | "more";
    hourlyRateSuggested: string;
    dispoSemaine: boolean;
    dispoSoir: boolean;
    dispoWeekend: boolean;
    dispoFlexible: boolean;
  };
  section4: {
    canProvideBackgroundCheck: boolean;
    canProvideTwoRefs: boolean;
    canProvideRcrProof: boolean;
    declNoBan: boolean;
    declNoInvestigation: boolean;
    declFalseStatement: boolean;
    declInfoAccurate: boolean;
    declIntermediary: boolean;
    declFinancialDirect: boolean;
    declProfileVisible: boolean;
  };
};

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function asBool(v: unknown): boolean {
  return v === true;
}

export function parseAndValidateAllyRegistration(raw: unknown): AllyRegistrationPayload {
  if (raw === null || typeof raw !== "object") {
    throw new BadRequestException("allyRegistration : objet requis.");
  }
  const o = raw as Record<string, unknown>;
  if (o.version !== ALLY_REGISTRATION_VERSION) {
    throw new BadRequestException(`allyRegistration.version doit être "${ALLY_REGISTRATION_VERSION}".`);
  }

  const s1 = o.section1 as Record<string, unknown> | undefined;
  const s2 = o.section2 as Record<string, unknown> | undefined;
  const s3 = o.section3 as Record<string, unknown> | undefined;
  const s4 = o.section4 as Record<string, unknown> | undefined;

  if (!s1 || !s2 || !s3 || !s4) {
    throw new BadRequestException("allyRegistration : sections 1 à 4 requises.");
  }

  if (!isNonEmptyString(s1.sectorServiced)) {
    throw new BadRequestException("Section 1 : ville / secteur desservi requis.");
  }
  if (!isNonEmptyString(s1.streetAddress)) {
    throw new BadRequestException("Section 1 : adresse requise.");
  }
  if (!isNonEmptyString(s1.contactEmail)) {
    throw new BadRequestException("Section 1 : courriel de contact requis.");
  }
  if (!asBool(s1.age18Confirmed)) {
    throw new BadRequestException("Section 1 : vous devez confirmer avoir 18 ans ou plus.");
  }

  const rcrValid = s2.rcrValid;
  if (rcrValid !== "yes" && rcrValid !== "no" && rcrValid !== "in_progress") {
    throw new BadRequestException("Section 2 : certification RCR invalide.");
  }
  const rcrLevelC = s2.rcrLevelC;
  if (rcrLevelC !== "yes" && rcrLevelC !== "no") {
    throw new BadRequestException("Section 2 : formation RCR Niveau C invalide.");
  }
  const exp = s2.experienceChildren;
  if (exp !== "lt1" && exp !== "1_3" && exp !== "3_5" && exp !== "5p") {
    throw new BadRequestException("Section 2 : expérience avec enfants invalide.");
  }
  if (!isNonEmptyString(s2.approachChildren) || String(s2.approachChildren).trim().length < 10) {
    throw new BadRequestException("Section 2 : décrivez votre approche avec les enfants (au moins 10 caractères).");
  }

  const repitAny =
    asBool(s3.repitSoiree) ||
    asBool(s3.repitNuit) ||
    asBool(s3.repitWeekend) ||
    asBool(s3.repitUrgence);
  if (!repitAny) {
    throw new BadRequestException("Section 3 : cochez au moins un type de répit offert.");
  }
  const ageAny = asBool(s3.age0_5) || asBool(s3.age6_12) || asBool(s3.age12p);
  if (!ageAny) {
    throw new BadRequestException("Section 3 : cochez au moins une tranche d'âge acceptée.");
  }
  if (!isNonEmptyString(s3.maxChildren)) {
    throw new BadRequestException("Section 3 : nombre maximal d'enfants requis.");
  }
  const radius = s3.serviceRadius;
  if (radius !== "10" && radius !== "25" && radius !== "50" && radius !== "more") {
    throw new BadRequestException("Section 3 : secteur desservi (distance) invalide.");
  }
  if (!isNonEmptyString(s3.hourlyRateSuggested)) {
    throw new BadRequestException("Section 3 : taux horaire suggéré requis.");
  }
  const rateNum = parseFloat(String(s3.hourlyRateSuggested).replace(",", "."));
  if (Number.isNaN(rateNum) || rateNum < 0) {
    throw new BadRequestException("Section 3 : taux horaire suggéré doit être un nombre valide.");
  }
  const dispoAny =
    asBool(s3.dispoSemaine) ||
    asBool(s3.dispoSoir) ||
    asBool(s3.dispoWeekend) ||
    asBool(s3.dispoFlexible);
  if (!dispoAny) {
    throw new BadRequestException("Section 3 : cochez au moins une disponibilité générale.");
  }

  const s4keys = [
    "canProvideBackgroundCheck",
    "canProvideTwoRefs",
    "canProvideRcrProof",
    "declNoBan",
    "declNoInvestigation",
    "declFalseStatement",
    "declInfoAccurate",
    "declIntermediary",
    "declFinancialDirect",
    "declProfileVisible"
  ] as const;
  for (const k of s4keys) {
    if (!asBool(s4[k])) {
      throw new BadRequestException(
        "Section 4 : toutes les cases (engagements et déclarations) doivent être acceptées."
      );
    }
  }

  return {
    version: ALLY_REGISTRATION_VERSION,
    section1: {
      sectorServiced: String(s1.sectorServiced).trim(),
      streetAddress: String(s1.streetAddress).trim(),
      contactEmail: String(s1.contactEmail).trim().toLowerCase(),
      age18Confirmed: true
    },
    section2: {
      rcrValid: rcrValid as "yes" | "no" | "in_progress",
      rcrExpiry: s2.rcrExpiry != null && isNonEmptyString(s2.rcrExpiry) ? String(s2.rcrExpiry).trim() : undefined,
      rcrLevelC: rcrLevelC as "yes" | "no",
      experienceChildren: exp as "lt1" | "1_3" | "3_5" | "5p",
      experienceParticularNeeds: asBool(s2.experienceParticularNeeds),
      experienceFoster: asBool(s2.experienceFoster),
      experienceTrauma: asBool(s2.experienceTrauma),
      experienceOtherText:
        s2.experienceOtherText != null && isNonEmptyString(s2.experienceOtherText)
          ? String(s2.experienceOtherText).trim()
          : undefined,
      approachChildren: String(s2.approachChildren).trim()
    },
    section3: {
      repitSoiree: asBool(s3.repitSoiree),
      repitNuit: asBool(s3.repitNuit),
      repitWeekend: asBool(s3.repitWeekend),
      repitUrgence: asBool(s3.repitUrgence),
      age0_5: asBool(s3.age0_5),
      age6_12: asBool(s3.age6_12),
      age12p: asBool(s3.age12p),
      maxChildren: String(s3.maxChildren).trim(),
      serviceRadius: radius as "10" | "25" | "50" | "more",
      hourlyRateSuggested: String(s3.hourlyRateSuggested).trim(),
      dispoSemaine: asBool(s3.dispoSemaine),
      dispoSoir: asBool(s3.dispoSoir),
      dispoWeekend: asBool(s3.dispoWeekend),
      dispoFlexible: asBool(s3.dispoFlexible)
    },
    section4: {
      canProvideBackgroundCheck: true,
      canProvideTwoRefs: true,
      canProvideRcrProof: true,
      declNoBan: true,
      declNoInvestigation: true,
      declFalseStatement: true,
      declInfoAccurate: true,
      declIntermediary: true,
      declFinancialDirect: true,
      declProfileVisible: true
    }
  };
}

export function buildSkillsTagsFromRegistration(reg: AllyRegistrationPayload, allyTypeLabel?: string): string[] {
  const tags = new Set<string>();
  if (allyTypeLabel) tags.add(allyTypeLabel);
  if (reg.section3.repitSoiree) tags.add("répit soirée");
  if (reg.section3.repitNuit) tags.add("répit nuit");
  if (reg.section3.repitWeekend) tags.add("répit fin de semaine");
  if (reg.section3.repitUrgence) tags.add("répit urgence");
  if (reg.section3.age0_5) tags.add("0-5 ans");
  if (reg.section3.age6_12) tags.add("6-12 ans");
  if (reg.section3.age12p) tags.add("12 ans et +");
  if (reg.section2.experienceParticularNeeds) tags.add("besoins particuliers");
  if (reg.section2.experienceFoster) tags.add("famille d'accueil");
  if (reg.section2.experienceTrauma) tags.add("traumas");
  return Array.from(tags);
}

export function buildAvailabilityFromRegistration(reg: AllyRegistrationPayload): Record<string, unknown> {
  return {
    semaine: reg.section3.dispoSemaine,
    soir: reg.section3.dispoSoir,
    finDeSemaine: reg.section3.dispoWeekend,
    flexible: reg.section3.dispoFlexible,
    rayonKm: reg.section3.serviceRadius,
    maxEnfants: reg.section3.maxChildren
  };
}
