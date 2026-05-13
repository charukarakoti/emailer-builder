// =============================================================================
// GET /api/auth/me — returns the current user, active team, and team list.
// Used by client components to detect login state without re-fetching by hand.
// =============================================================================

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/auth";

export async function GET() {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ user: null }, { status: 200 });
  }

  const memberships = await prisma.membership.findMany({
    where: { userId: session.userId },
    include: { team: true },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({
    user: {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
    },
    activeTeam: session.activeTeam
      ? { id: session.activeTeam.id, name: session.activeTeam.name }
      : null,
    teams: memberships.map((m) => ({
      id: m.team.id,
      name: m.team.name,
      role: m.role,
    })),
  });
}
