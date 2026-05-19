// =============================================================================
// /api/signatures/[id]
//   GET    → return the signature
//   PUT    → update name / doc (owner only)
//   DELETE → remove (owner only)
// =============================================================================

import { prisma } from "@/lib/prisma";
import { requireWorkspace, withJsonErrors, parseJson } from "@/lib/workspace";
import { logActivity } from "@/lib/activity";

async function load(id: string, teamId: string) {
  const s = await prisma.signature.findUnique({ where: { id } });
  if (!s || s.teamId !== teamId) return null;
  return s;
}

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  return withJsonErrors(async () => {
    const ws = await requireWorkspace();
    const s = await load(params.id, ws.teamId);
    if (!s) {
      const err: any = new Error("Not found");
      err.status = 404;
      throw err;
    }
    return {
      signature: {
        id: s.id,
        name: s.name,
        doc: parseJson(s.doc),
        createdAt: s.createdAt.getTime(),
        updatedAt: s.updatedAt.getTime(),
        isMine: s.ownerId === ws.userId,
      },
    };
  });
}

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  return withJsonErrors(async () => {
    const ws = await requireWorkspace();
    const existing = await load(params.id, ws.teamId);
    if (!existing) {
      const err: any = new Error("Not found");
      err.status = 404;
      throw err;
    }
    if (existing.ownerId !== ws.userId) {
      const err: any = new Error("Only the owner can update this signature");
      err.status = 403;
      throw err;
    }
    const body = (await req.json().catch(() => ({}))) as {
      name?: string;
      doc?: unknown;
    };
    const updated = await prisma.signature.update({
      where: { id: existing.id },
      data: {
        name: body.name?.trim() || existing.name,
        doc:
          body.doc !== undefined
            ? JSON.stringify(body.doc)
            : existing.doc,
      },
    });
    return {
      signature: {
        id: updated.id,
        name: updated.name,
        doc: parseJson(updated.doc),
        createdAt: updated.createdAt.getTime(),
        updatedAt: updated.updatedAt.getTime(),
        isMine: true,
      },
    };
  });
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  return withJsonErrors(async () => {
    const ws = await requireWorkspace();
    const existing = await load(params.id, ws.teamId);
    if (!existing) {
      const err: any = new Error("Not found");
      err.status = 404;
      throw err;
    }
    if (existing.ownerId !== ws.userId) {
      const err: any = new Error("Only the owner can delete this signature");
      err.status = 403;
      throw err;
    }
    await prisma.signature.delete({ where: { id: existing.id } });
    logActivity({
      teamId: ws.teamId,
      userId: ws.userId,
      action: "signature.deleted",
      target: `signature:${existing.id}`,
      meta: { name: existing.name },
    });
    return { ok: true };
  });
}
