// =============================================================================
// /api/media — workspace-scoped image / asset library.
// Phase 1 — list rows + register a new asset by metadata. Phase 5 wires
// uploads through lib/media/storage.ts (S3 / Cloudinary / local) via
// /api/media/sign or /api/media/upload.
// =============================================================================

import { prisma } from "@/lib/prisma";
import { requireWorkspace, withJsonErrors } from "@/lib/workspace";

export async function GET() {
  return withJsonErrors(async () => {
    const ws = await requireWorkspace();
    const media = await prisma.media.findMany({
      where: { teamId: ws.teamId },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return { media };
  });
}

export async function POST(req: Request) {
  return withJsonErrors(async () => {
    const ws = await requireWorkspace();
    const body = (await req.json().catch(() => ({}))) as {
      url?: string;
      storageKey?: string;
      filename?: string;
      contentType?: string;
      sizeBytes?: number;
      width?: number;
      height?: number;
      kind?: string;
    };
    if (!body.url || !body.filename) {
      const err: any = new Error("url and filename are required");
      err.status = 400;
      throw err;
    }
    const row = await prisma.media.create({
      data: {
        teamId: ws.teamId,
        uploadedById: ws.userId,
        kind: body.kind === "file" ? "file" : "image",
        url: body.url,
        storageKey: body.storageKey ?? null,
        filename: body.filename,
        contentType: body.contentType ?? null,
        sizeBytes: body.sizeBytes ?? null,
        width: body.width ?? null,
        height: body.height ?? null,
      },
    });
    return { media: row };
  });
}
