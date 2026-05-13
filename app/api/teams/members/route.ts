// =============================================================================
// GET /api/teams/members — list members of the current active team.
// =============================================================================

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";

export async function GET() {
  try {
    const session = await requireSession();
    if (!session.activeTeamId) {
      return NextResponse.json({ members: [] });
    }
    const members = await prisma.membership.findMany({
      where: { teamId: session.activeTeamId },
      include: { user: true },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json({
      members: members.map((m) => ({
        id: m.user.id,
        email: m.user.email,
        name: m.user.name,
        role: m.role,
        joinedAt: m.createdAt.toISOString(),
      })),
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message || "Error" },
      { status: e.status || 500 }
    );
  }
}
