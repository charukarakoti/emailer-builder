// =============================================================================
// DELETE /api/media/[id] — remove a media row + best-effort delete of the
// file on disk. Workspace-scoped.
// =============================================================================

import { prisma } from "@/lib/prisma";
import { requireWorkspace, withJsonErrors } from "@/lib/workspace";
import { logActivity } from "@/lib/activity";
import { unlink } from "node:fs/promises";
import path from "node:path";

/**
 * PATCH /api/media/[id] — partial update of a media row.
 *
 * Currently used by the media list view to backfill `width` × `height`
 * once the browser has decoded the image. Only width/height are accepted
 * to keep the surface small; if you need to rename or recategorise a
 * file, add explicit fields here.
 */
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  return withJsonErrors(async () => {
    const ws = await requireWorkspace();
    const row = await prisma.media.findUnique({ where: { id: params.id } });
    if (!row || row.teamId !== ws.teamId) {
      const err: any = new Error("Not found");
      err.status = 404;
      throw err;
    }
    const body = (await req.json().catch(() => ({}))) as {
      width?: number;
      height?: number;
    };
    const width =
      typeof body.width === "number" && body.width > 0
        ? Math.round(body.width)
        : undefined;
    const height =
      typeof body.height === "number" && body.height > 0
        ? Math.round(body.height)
        : undefined;
    if (width === undefined && height === undefined) return { ok: true };
    const updated = await prisma.media.update({
      where: { id: row.id },
      data: { width, height },
    });
    return { media: updated };
  });
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  return withJsonErrors(async () => {
    const ws = await requireWorkspace();
    const row = await prisma.media.findUnique({ where: { id: params.id } });
    if (!row || row.teamId !== ws.teamId) {
      const err: any = new Error("Not found");
      err.status = 404;
      throw err;
    }
    if (row.storageKey) {
      const dest = path.join(
        process.cwd(),
        "public",
        "uploads",
        "media",
        row.storageKey
      );
      await unlink(dest).catch(() => {
        /* already gone — fine */
      });
    }
    await prisma.media.delete({ where: { id: row.id } });
    logActivity({
      teamId: ws.teamId,
      userId: ws.userId,
      action: "media.deleted",
      target: `media:${row.id}`,
      meta: { filename: row.filename },
    });
    return { ok: true };
  });
}
