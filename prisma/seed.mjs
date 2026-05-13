// =============================================================================
// prisma/seed.mjs — plain-JS seed, runs with `node prisma/seed.mjs`.
//
// Creates a default account so you can sign in right away.
//   email:    admin@jv.com
//   password: builder1234
//
// Override with env vars:
//   SEED_EMAIL=you@example.com SEED_PASSWORD=changeme \
//     node prisma/seed.mjs
//
// Re-running is safe — existing users are left alone, and we make sure they
// still have an OWNER team membership.
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

  let membership = await prisma.membership.findFirst({
    where: { userId: user.id },
    include: { team: true },
  });

  if (!membership) {
    const team = await prisma.team.create({ data: { name: TEAM_NAME } });
    membership = await prisma.membership.create({
      data: { userId: user.id, teamId: team.id, role: "OWNER" },
      include: { team: true },
    });
  }

  console.log(
    [
      "",
      "Seeded default account:",
      `  email:    ${EMAIL}`,
      `  password: ${PASSWORD}`,
      `  team:     ${membership.team.name}`,
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
