// =============================================================================
// POST /api/teams/join
// Body: { code }
//
// Redeems an invite for the current user. Adds them to the team as MEMBER
// and switches their active team to it. Idempotent — re-joining is a no-op.
// =============================================================================

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const session = await requireSession();
    const { code } = (await req.json().catch(() => ({}))) as { code?: string };
    if (!code) {
      return NextResponse.json({ error: "code required" }, { status: 400 });
    }

    const invite = await prisma.invite.findUnique({
      where: { code },
      include: { team: true },
    });
    if (!invite) {
      return NextResponse.json({ error: "Invalid code" }, { status: 404 });
    }
    if (invite.expiresAt < new Date()) {
      return NextResponse.json({ error: "Invite expired" }, { status: 410 });
    }
    if (invite.email && invite.email !== session.user.email) {
      return NextResponse.json(
        { error: "This invite is for a different email address" },
        { status: 403 }
      );
    }

    // Add membership if not already a member.
    await prisma.membership.upsert({
      where: {
        userId_teamId: {
          userId: session.userId,
          teamId: invite.teamId,
        },
      },
      update: {},
      create: {
        userId: session.userId,
        teamId: invite.teamId,
        role: "MEMBER",
      },
    });

    if (!invite.redeemedAt) {
      await prisma.invite.update({
        where: { id: invite.id },
        data: { redeemedAt: new Date(), redeemedBy: session.userId },
      });
    }

    // Switch active team.
    await prisma.session.update({
      where: { id: session.id },
      data: { activeTeamId: invite.teamId },
    });

    return NextResponse.json({
      team: { id: invite.team.id, name: invite.team.name },
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message || "Error" },
      { status: e.status || 500 }
    );
  }
}
