// =============================================================================
// /api/signatures
//   GET  → list signatures in the active workspace
//   POST → create a new signature (body: { name, doc? })
// =============================================================================

import { prisma } from "@/lib/prisma";
import { requireWorkspace, withJsonErrors, parseJson } from "@/lib/workspace";
import { logActivity } from "@/lib/activity";
import { newSignatureDoc } from "@/lib/signatureHtml";

export async function GET() {
  return withJsonErrors(async () => {
    const ws = await requireWorkspace();
    const rows = await prisma.signature.findMany({
      where: { teamId: ws.teamId },
      orderBy: { updatedAt: "desc" },
    });
    return {
      signatures: rows.map((s) => ({
        id: s.id,
        name: s.name,
        doc: parseJson(s.doc),
        createdAt: s.createdAt.getTime(),
        updatedAt: s.updatedAt.getTime(),
        isMine: s.ownerId === ws.userId,
      })),
    };
  });
}

export async function POST(req: Request) {
  return withJsonErrors(async () => {
    const ws = await requireWorkspace();
    const body = (await req.json().catch(() => ({}))) as {
      name?: string;
      doc?: unknown;
    };
    const name = (body.name || "").trim() || "Untitled signature";
    const docPayload =
      body.doc && typeof body.doc === "object" ? body.doc : newSignatureDoc();
    const row = await prisma.signature.create({
      data: {
        teamId: ws.teamId,
        ownerId: ws.userId,
        name,
        doc: JSON.stringify(docPayload),
      },
    });
    logActivity({
      teamId: ws.teamId,
      userId: ws.userId,
      action: "signature.created",
      target: `signature:${row.id}`,
      meta: { name },
    });
    return {
      signature: {
        id: row.id,
        name: row.name,
        doc: parseJson(row.doc),
        createdAt: row.createdAt.getTime(),
        updatedAt: row.updatedAt.getTime(),
        isMine: true,
      },
    };
  });
}
