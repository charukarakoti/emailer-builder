// =============================================================================
// GET    /api/templates/[id]  — read a single template (must be in same team)
// PUT    /api/templates/[id]  — update (owner only)
// DELETE /api/templates/[id]  — delete (owner only)
// =============================================================================

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";

function safeParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

async function loadTeamTemplate(id: string, teamId: string | null) {
  if (!teamId) return null;
  const t = await prisma.template.findUnique({
    where: { id },
    include: { owner: { select: { id: true, email: true, name: true } } },
  });
  if (!t) return null;
  if (t.teamId !== teamId) return null;
  return t;
}

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireSession();
    const t = await loadTeamTemplate(params.id, session.activeTeamId);
    if (!t) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({
      template: {
        id: t.id,
        name: t.name,
        doc: safeParse(t.doc),
        createdAt: t.createdAt.getTime(),
        updatedAt: t.updatedAt.getTime(),
        owner: t.owner,
        isMine: t.ownerId === session.userId,
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message || "Error" },
      { status: e.status || 500 }
    );
  }
}

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireSession();
    const existing = await loadTeamTemplate(params.id, session.activeTeamId);
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (existing.ownerId !== session.userId) {
      return NextResponse.json(
        { error: "Only the template owner can update it" },
        { status: 403 }
      );
    }
    const body = (await req.json().catch(() => ({}))) as {
      name?: string;
      doc?: unknown;
    };
    const t = await prisma.template.update({
      where: { id: params.id },
      data: {
        name: body.name?.trim() || existing.name,
        doc:
          body.doc !== undefined ? JSON.stringify(body.doc) : existing.doc,
      },
    });
    return NextResponse.json({
      template: {
        id: t.id,
        name: t.name,
        doc: safeParse(t.doc),
        createdAt: t.createdAt.getTime(),
        updatedAt: t.updatedAt.getTime(),
        isMine: true,
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message || "Error" },
      { status: e.status || 500 }
    );
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireSession();
    const existing = await loadTeamTemplate(params.id, session.activeTeamId);
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (existing.ownerId !== session.userId) {
      return NextResponse.json(
        { error: "Only the template owner can delete it" },
        { status: 403 }
      );
    }
    await prisma.template.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message || "Error" },
      { status: e.status || 500 }
    );
  }
}
