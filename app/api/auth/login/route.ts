// =============================================================================
// POST /api/auth/login
// Body: { email, password }
//
// Validates credentials, creates a new session, sets the cookie, and
// returns the user + their first team (which is set as the active team).
// =============================================================================

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  verifyPassword,
  createSession,
  setSessionCookie,
} from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        memberships: {
          include: { team: true },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    const ok = user
      ? await verifyPassword(password, user.passwordHash)
      : false;

    if (!user || !ok) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    const activeTeam = user.memberships[0]?.team ?? null;
    const { token, expiresAt } = await createSession(
      user.id,
      activeTeam?.id ?? null
    );
    await setSessionCookie(token, expiresAt);

    return NextResponse.json({
      user: { id: user.id, email: user.email, name: user.name },
      team: activeTeam
        ? { id: activeTeam.id, name: activeTeam.name }
        : null,
    });
  } catch (e: any) {
    // Common cause in dev: Postgres/SQLite not reachable, or migrations not
    // run yet (table "User" doesn't exist). Surface a JSON error so the
    // login form can render it instead of choking on an HTML error page.
    const msg =
      e?.code === "P2021" || /no such table/i.test(e?.message || "")
        ? "Database not set up yet. Run `npx prisma db push && npm run prisma:seed` and try again."
        : e?.message || "Login failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
