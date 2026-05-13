// =============================================================================
// /api/tags — workspace-scoped contact tags.
// GET  → all tags + usage count.
// POST → create a tag. Body: { name, color? }
// =============================================================================

import { prisma } from "@/lib/prisma";
import { requireWorkspace, withJsonErrors } from "@/lib/workspace";

export async function GET() {
  return withJsonErrors(async () => {
    const ws = await requireWorkspace();
    const tags = await prisma.tag.findMany({
      where: { teamId: ws.teamId },
      orderBy: { name: "asc" },
      include: { _count: { select: { contacts: true } } },
    });
    return {
      tags: tags.map((t) => ({
        id: t.id,
        name: t.name,
        color: t.color,
        usage: t._count.contacts,
      })),
    };
  });
}

export async function POST(req: Request) {
  return withJsonErrors(async () => {
    const ws = await requireWorkspace();
    const body = (await req.json().catch(() => ({}))) as {
      name?: string;
      color?: string;
    };
    const name = (body.name || "").trim();
    if (!name) {
      const err: any = new Error("Tag name is required");
      err.status = 400;
      throw err;
    }
    const tag = await prisma.tag.upsert({
      where: { teamId_name: { teamId: ws.teamId, name } },
      update: { color: body.color?.trim() || undefined },
      create: { teamId: ws.teamId, name, color: body.color?.trim() || null },
    });
    return { tag: { id: tag.id, name: tag.name, color: tag.color } };
  });
}
