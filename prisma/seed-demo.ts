import {
  AllyType,
  PrismaClient,
  ResourceOnboardingState,
  ResourcePublishStatus,
  ResourceServiceDeliveryMode,
  ResourceVerificationStatus,
  Role,
  UserStatus
} from "@prisma/client";
import * as argon2 from "argon2";
import { randomBytes } from "crypto";

const databaseUrl = process.env.DATABASE_URL;
if (process.env.DEMO_MODE !== "true" || !databaseUrl || new URL(databaseUrl).pathname !== "/fab_demo") {
  throw new Error("Le peuplement démo exige DEMO_MODE=true et une base nommée fab_demo.");
}

const prisma = new PrismaClient();

const demoAllies = [
  {
    email: "camille@demo.invalid",
    displayName: "Camille B. (démo)",
    postalCode: "H2X2A1",
    city: "Montréal",
    allyType: AllyType.GARDIENS,
    serviceDeliveryMode: ResourceServiceDeliveryMode.IN_PERSON,
    bio: "Exemple fictif : soutien pour les périodes de garde en soirée et la fin de semaine.",
    skillsTags: ["Gardien compétent", "soirée", "fin de semaine"],
    hourlyRate: 28
  },
  {
    email: "samira@demo.invalid",
    displayName: "Samira N. (démo)",
    postalCode: "H2X1Y4",
    city: "Montréal",
    allyType: AllyType.MENAGE,
    serviceDeliveryMode: ResourceServiceDeliveryMode.IN_PERSON,
    bio: "Exemple fictif : aide pour l'entretien courant du foyer selon les priorités de la famille.",
    skillsTags: ["Entretien Ménage", "ménage", "entretien"],
    hourlyRate: 30
  },
  {
    email: "joel@demo.invalid",
    displayName: "Joël L. (démo)",
    postalCode: "H2X2C3",
    city: "Montréal",
    allyType: AllyType.AUTRES,
    serviceDeliveryMode: ResourceServiceDeliveryMode.BOTH,
    bio: "Exemple fictif : tutorat et accompagnement des devoirs, en personne ou à distance.",
    skillsTags: ["Tutorat", "devoirs", "accompagnement scolaire"],
    hourlyRate: 32
  },
  {
    email: "sophie@demo.invalid",
    displayName: "Sophie G. (démo)",
    postalCode: "G1R2J3",
    city: "Québec",
    allyType: AllyType.GARDIENS,
    serviceDeliveryMode: ResourceServiceDeliveryMode.IN_PERSON,
    bio: "Exemple fictif : présence attentive et activités adaptées pendant les périodes de répit.",
    skillsTags: ["Gardien compétent", "répit", "fin de semaine"],
    hourlyRate: 29
  },
  {
    email: "malik@demo.invalid",
    displayName: "Malik T. (démo)",
    postalCode: "G1R4A2",
    city: "Québec",
    allyType: AllyType.AUTRES,
    serviceDeliveryMode: ResourceServiceDeliveryMode.REMOTE,
    bio: "Exemple fictif : soutien scolaire à distance partout au Québec.",
    skillsTags: ["Tutorat", "mathématiques", "devoirs"],
    hourlyRate: 31
  },
  {
    email: "elise@demo.invalid",
    displayName: "Élise R. (démo)",
    postalCode: "J1H2A3",
    city: "Sherbrooke",
    allyType: AllyType.MENAGE,
    serviceDeliveryMode: ResourceServiceDeliveryMode.IN_PERSON,
    bio: "Exemple fictif : un coup de main pour alléger les tâches ménagères de la semaine.",
    skillsTags: ["Entretien Ménage", "ménage", "entretien"],
    hourlyRate: 27
  }
];

async function main() {
  for (const ally of demoAllies) {
    const passwordHash = await argon2.hash(randomBytes(32).toString("hex"));
    const profile = {
      displayName: ally.displayName,
      postalCode: ally.postalCode,
      city: ally.city,
      region: "QC",
      allyType: ally.allyType,
      serviceDeliveryMode: ally.serviceDeliveryMode,
      bio: ally.bio,
      skillsTags: ally.skillsTags,
      hourlyRate: ally.hourlyRate,
      contactEmail: ally.email,
      contactPhone: null,
      isInternalTest: true,
      verificationStatus: ResourceVerificationStatus.VERIFIED,
      publishStatus: ResourcePublishStatus.PUBLISHED,
      onboardingState: ResourceOnboardingState.PUBLISHED
    };
    await prisma.user.upsert({
      where: { email: ally.email },
      create: {
        email: ally.email,
        emailVerifiedAt: new Date(),
        passwordHash,
        role: Role.RESOURCE,
        status: UserStatus.ACTIVE,
        resourceProfile: { create: profile }
      },
      update: {
        resourceProfile: { upsert: { create: profile, update: profile } }
      }
    });
  }
  console.log(`${demoAllies.length} profils alliés fictifs prêts.`);
}

void main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exitCode = 1;
  });
