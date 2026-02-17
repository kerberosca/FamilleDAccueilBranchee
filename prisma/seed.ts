import {
  ResourceOnboardingState,
  ResourcePublishStatus,
  ResourceVerificationStatus,
  PrismaClient,
  Role,
  SubscriptionStatus,
  UserStatus
} from "@prisma/client";
import * as argon2 from "argon2";

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL ?? "admin@fab.local";
  const adminPassword = process.env.ADMIN_PASSWORD ?? "ChangeMe123!";

  const adminHash = await argon2.hash(adminPassword);
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      passwordHash: adminHash,
      role: Role.ADMIN,
      status: UserStatus.ACTIVE
    }
  });

  const devAdminHash = await argon2.hash("DevAdmin123!");
  await prisma.user.upsert({
    where: { email: "admin@local.test" },
    update: {},
    create: {
      email: "admin@local.test",
      passwordHash: devAdminHash,
      role: Role.ADMIN,
      status: UserStatus.ACTIVE
    }
  });

  const familyEmail = "famille.demo@fab.local";
  const familyHash = await argon2.hash("Famille123!");
  const family = await prisma.user.upsert({
    where: { email: familyEmail },
    update: {},
    create: {
      email: familyEmail,
      passwordHash: familyHash,
      role: Role.FAMILY,
      status: UserStatus.ACTIVE,
      familyProfile: {
        create: {
          displayName: "Famille Demo",
          postalCode: "H2X1Y4",
          city: "Montreal",
          region: "QC",
          bio: "Nous cherchons de l'aide ponctuelle.",
          needsTags: ["repit", "transport"],
          availability: { weekdays: "soir" }
        }
      }
    },
    include: { familyProfile: true }
  });

  await prisma.subscription.upsert({
    where: { stripeSubscriptionId: "sub_demo_famille" },
    update: {},
    create: {
      userId: family.id,
      status: SubscriptionStatus.ACTIVE,
      stripeCustomerId: "cus_demo_famille",
      stripeSubscriptionId: "sub_demo_famille"
    }
  });

  const devFamilyHash = await argon2.hash("DevFamille123!");
  const devFamily = await prisma.user.upsert({
    where: { email: "famille@local.test" },
    update: {},
    create: {
      email: "famille@local.test",
      passwordHash: devFamilyHash,
      role: Role.FAMILY,
      status: UserStatus.ACTIVE,
      familyProfile: {
        create: {
          displayName: "Famille Locale",
          postalCode: "H3A1A1",
          city: "Montreal",
          region: "QC",
          bio: "Compte seed pour bypass dev.",
          needsTags: ["repit", "gardiennage"],
          availability: { weekdays: "soir", weekend: true }
        }
      }
    }
  });

  await prisma.subscription.upsert({
    where: { stripeSubscriptionId: "sub_dev_famille_local" },
    update: { status: SubscriptionStatus.ACTIVE },
    create: {
      userId: devFamily.id,
      status: SubscriptionStatus.ACTIVE,
      stripeCustomerId: "cus_dev_famille_local",
      stripeSubscriptionId: "sub_dev_famille_local"
    }
  });

  const resourceEmail = "ressource.demo@fab.local";
  const resourceHash = await argon2.hash("Ressource123!");
  await prisma.user.upsert({
    where: { email: resourceEmail },
    update: {},
    create: {
      email: resourceEmail,
      passwordHash: resourceHash,
      role: Role.RESOURCE,
      status: UserStatus.ACTIVE,
      resourceProfile: {
        create: {
          displayName: "Alex",
          postalCode: "H2X2A1",
          city: "Montreal",
          region: "QC",
          bio: "Gardiennage et transport.",
          skillsTags: ["gardiennage", "transport"],
          hourlyRate: 28,
          verificationStatus: ResourceVerificationStatus.VERIFIED,
          publishStatus: ResourcePublishStatus.PUBLISHED,
          onboardingState: ResourceOnboardingState.PUBLISHED,
          contactEmail: "alex@demo.local",
          contactPhone: "514-555-1234",
          availability: { weekdays: "jour", weekend: true }
        }
      }
    }
  });

  const devResourceHash = await argon2.hash("DevRessource123!");
  await prisma.user.upsert({
    where: { email: "ressource@local.test" },
    update: {},
    create: {
      email: "ressource@local.test",
      passwordHash: devResourceHash,
      role: Role.RESOURCE,
      status: UserStatus.ACTIVE,
      resourceProfile: {
        create: {
          displayName: "Ressource Locale",
          postalCode: "H3B1B2",
          city: "Montreal",
          region: "QC",
          bio: "Compte seed pour bypass dev.",
          skillsTags: ["transport", "repit"],
          hourlyRate: 30,
          verificationStatus: ResourceVerificationStatus.VERIFIED,
          publishStatus: ResourcePublishStatus.PUBLISHED,
          onboardingState: ResourceOnboardingState.PUBLISHED,
          contactEmail: "ressource@local.test",
          contactPhone: "514-555-0000",
          availability: { weekdays: "jour" }
        }
      }
    }
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
