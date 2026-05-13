// =============================================================================
// GET  /api/teams        — list all teams the current user belongs to
// POST /api/teams        — create a new team and add the user as OWNER
// =============================================================================

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";

export async function GET() {
  try {
    const session = await requireSession();
    const memberships = await prisma.membership.findMany({
      where: { userId: session.userId },
      include: { team: true },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json({
      teams: memberships.map((m) => ({
        id: m.team.id,
        name: m.team.name,
        role: m.role,
      })),
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message || "Error" },
      { status: e.status || 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireSession();
    const { name } = (await req.json().catch(() => ({}))) as { name?: string };
    const finalName = (name || "").trim();
    if (!finalName) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    const team = await prisma.team.create({ data: { name: finalName } });
    await prisma.membership.create({
      data: { userId: session.userId, teamId: team.id, role: "OWNER" },
    });
    return NextResponse.json({
      team: { id: team.id, name: team.name, role: "OWNER" },
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message || "Error" },
      { status: e.status || 500 }
    );
  }
}
