// =============================================================================
// lib/prisma.ts — singleton PrismaClient
// =============================================================================
// Next.js dev mode hot-reloads modules, which would otherwise spawn a new
// PrismaClient on every reload and exhaust Postgres connections. We stash
// the client on globalThis in non-prod environments.
// =============================================================================

import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export const prisma: PrismaClient =
  global.__prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  global.__prisma = prisma;
}
