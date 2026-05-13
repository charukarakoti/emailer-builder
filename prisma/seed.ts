// =============================================================================
// prisma/seed.ts — creates a default account so you can log in right away.
//
// Run with:  npm run prisma:seed
// Credentials:
//   email:    admin@jv.com
//   password: builder1234
//
// Override with env vars if you want different defaults:
//   SEED_EMAIL=you@example.com SEED_PASSWORD=changeme SEED_NAME="JV Team" \
//   npm run prisma:seed
//
// Re-running this is safe: if the user already exists we leave them alone
// and just make sure they have a team + OWNER membership.
// =============================================================================

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const EMAIL = (process.env.SEED_EMAIL || "admin@jv.com").toLowerCase();
const PASSWORD = process.env.SEED_PASSWORD || "builder1234";
const NAME = process.env.SEED_NAME || "JV Admin";
const TEAM_NAME = process.env.SEED_TEAM || "JV Workspace";

async function main() {
  const passwordHash = await bcrypt.hash(PASSWORD, 12);

  const user = await prisma.user.upsert({
    where: { email: EMAIL },
    update: { name: NAME },
    create: { email: EMAIL, name: NAME, passwordHash },
  });

  // Ensure the seed user has at least one team they own.
  const existingMembership = await prisma.membership.findFirst({
    where: { userId: user.id },
    include: { team: true },
  });

  let team = existingMembership?.team;
  if (!team) {
    team = await prisma.team.create({ data: { name: TEAM_NAME } });
    await prisma.membership.create({
      data: { userId: user.id, teamId: team.id, role: "OWNER" },
    });
  }

  // eslint-disable-next-line no-console
  console.log(
    [
      "",
      "Seeded default account:",
      `  email:    ${EMAIL}`,
      `  password: ${PASSWORD}`,
      `  team:     ${team.name}`,
      "",
      "Sign in at http://localhost:3000/login",
      "",
    ].join("\n")
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
