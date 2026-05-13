// =============================================================================
// POST /api/auth/signup
// Body: { email, password, name?, teamName? }
//
// Creates a new user, a personal Team (name defaults to "<name>'s workspace"),
// an OWNER Membership, and an active session. Returns { user, team }.
// =============================================================================

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  hashPassword,
  createSession,
  setSessionCookie,
} from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const name = body.name ? String(body.name).trim() : null;
    const teamName =
      (body.teamName && String(body.teamName).trim()) ||
      (name ? `${name}'s workspace` : "My workspace");

    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "An account already exists for that email" },
        { status: 409 }
      );
    }

    const passwordHash = await hashPassword(password);

    // Create the user, default team, and OWNER membership in one transaction.
    const { user, team } = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { email, passwordHash, name },
      });
      const team = await tx.team.create({ data: { name: teamName } });
      await tx.membership.create({
        data: { userId: user.id, teamId: team.id, role: "OWNER" },
      });
      return { user, team };
    });

    const { token, expiresAt } = await createSession(user.id, team.id);
    await setSessionCookie(token, expiresAt);

    return NextResponse.json({
      user: { id: user.id, email: user.email, name: user.name },
      team: { id: team.id, name: team.name },
    });
  } catch (e: any) {
    const msg =
      e?.code === "P2021" || /no such table/i.test(e?.message || "")
        ? "Database not set up yet. Run `npx prisma db push` and try again."
        : e?.message || "Sign-up failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
