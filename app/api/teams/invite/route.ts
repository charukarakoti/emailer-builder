// =============================================================================
// POST /api/teams/invite
// Body: { email? }   — email is optional; if omitted the invite is open.
//
// Creates an Invite for the active team. Returns a code + URL the inviter
// can share. The invite expires in 7 days. Only OWNERs can create invites.
// =============================================================================

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import crypto from "crypto";

function makeCode() {
  // 18 base64url chars ≈ 108 bits — plenty for a shareable invite code.
  return crypto.randomBytes(14).toString("base64url");
}

export async function POST(req: Request) {
  try {
    const session = await requireSession();
    if (!session.activeTeamId) {
      return NextResponse.json(
        { error: "No active team" },
        { status: 400 }
      );
    }

    const member = await prisma.membership.findUnique({
      where: {
        userId_teamId: {
          userId: session.userId,
          teamId: session.activeTeamId,
        },
      },
    });
    if (!member || member.role !== "OWNER") {
      return NextResponse.json(
        { error: "Only the team owner can invite people" },
        { status: 403 }
      );
    }

    const body = (await req.json().catch(() => ({}))) as { email?: string };
    const email = body.email ? String(body.email).trim().toLowerCase() : null;

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const code = makeCode();
    const invite = await prisma.invite.create({
      data: {
        code,
        teamId: session.activeTeamId,
        email,
        invitedBy: session.userId,
        expiresAt,
      },
    });

    return NextResponse.json({
      invite: {
        code: invite.code,
        email: invite.email,
        expiresAt: invite.expiresAt.toISOString(),
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message || "Error" },
      { status: e.status || 500 }
    );
  }
}
