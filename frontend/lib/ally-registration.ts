/** Doit correspondre à `ALLY_REGISTRATION_VERSION` côté API. */
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

export function emptyAllyRegistration(): AllyRegistrationPayload {
  return {
    version: ALLY_REGISTRATION_VERSION,
    section1: {
      sectorServiced: "",
      streetAddress: "",
      contactEmail: "",
      age18Confirmed: false
    },
    section2: {
      rcrValid: "no",
      rcrLevelC: "no",
      experienceChildren: "lt1",
      experienceParticularNeeds: false,
      experienceFoster: false,
      experienceTrauma: false,
      approachChildren: ""
    },
    section3: {
      repitSoiree: false,
      repitNuit: false,
      repitWeekend: false,
      repitUrgence: false,
      age0_5: false,
      age6_12: false,
      age12p: false,
      maxChildren: "",
      serviceRadius: "25",
      hourlyRateSuggested: "",
      dispoSemaine: false,
      dispoSoir: false,
      dispoWeekend: false,
      dispoFlexible: false
    },
    section4: {
      canProvideBackgroundCheck: false,
      canProvideTwoRefs: false,
      canProvideRcrProof: false,
      declNoBan: false,
      declNoInvestigation: false,
      declFalseStatement: false,
      declInfoAccurate: false,
      declIntermediary: false,
      declFinancialDirect: false,
      declProfileVisible: false
    }
  };
}

export function parseAllyRegistrationFromApi(raw: unknown): AllyRegistrationPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as AllyRegistrationPayload;
  if (o.version !== ALLY_REGISTRATION_VERSION || !o.section1 || !o.section2 || !o.section3 || !o.section4) {
    return null;
  }
  return o;
}
