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

export async function GET() {
  try {
    const session = await requireSession();
    if (!session.activeTeamId) {
      return NextResponse.json({ invites: [] });
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
      return NextResponse.json({ invites: [] });
    }

    const invites = await prisma.invite.findMany({
      where: { teamId: session.activeTeamId },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return NextResponse.json({
      invites: invites.map((invite) => ({
        id: invite.id,
        code: invite.code,
        email: invite.email,
        createdAt: invite.createdAt.toISOString(),
        expiresAt: invite.expiresAt.toISOString(),
        redeemedAt: invite.redeemedAt ? invite.redeemedAt.toISOString() : null,
      })),
    });
  } catch (e: any) {
    return NextResponse.json(
      { invites: [] },
      { status: e.status || 500 }
    );
  }
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

export async function DELETE(req: Request) {
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
        { error: "Only the team owner can revoke invites" },
        { status: 403 }
      );
    }

    const body = (await req.json().catch(() => ({}))) as { id?: string };
    if (!body.id) {
      return NextResponse.json(
        { error: "Invite id is required" },
        { status: 400 }
      );
    }

    const invite = await prisma.invite.findUnique({
      where: { id: body.id },
    });
    if (!invite || invite.teamId !== session.activeTeamId) {
      return NextResponse.json(
        { error: "Invite not found" },
        { status: 404 }
      );
    }

    await prisma.invite.delete({ where: { id: body.id } });

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message || "Error" },
      { status: e.status || 500 }
    );
  }
}
