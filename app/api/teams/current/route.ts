// =============================================================================
// POST /api/teams/current
// Body: { teamId }
//
// Sets the active team on the current session. The user must already be a
// member of the team.
// =============================================================================

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const session = await requireSession();
    const { teamId } = (await req.json().catch(() => ({}))) as {
      teamId?: string;
    };
    if (!teamId) {
      return NextResponse.json({ error: "teamId required" }, { status: 400 });
    }
    const member = await prisma.membership.findUnique({
      where: { userId_teamId: { userId: session.userId, teamId } },
    });
    if (!member) {
      return NextResponse.json(
        { error: "You are not a member of that team" },
        { status: 403 }
      );
    }
    await prisma.session.update({
      where: { id: session.id },
      data: { activeTeamId: teamId },
    });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message || "Error" },
      { status: e.status || 500 }
    );
  }
}
