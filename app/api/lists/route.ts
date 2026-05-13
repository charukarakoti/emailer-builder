// =============================================================================
// /api/lists — workspace-scoped contact lists.
// GET  → all lists in the active workspace + member counts.
// POST → create a list. Body: { name, description? }
// =============================================================================

import { prisma } from "@/lib/prisma";
import { requireWorkspace, withJsonErrors } from "@/lib/workspace";

export async function GET() {
  return withJsonErrors(async () => {
    const ws = await requireWorkspace();
    const lists = await prisma.list.findMany({
      where: { teamId: ws.teamId },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { contacts: true } } },
    });
    return {
      lists: lists.map((l) => ({
        id: l.id,
        name: l.name,
        description: l.description,
        memberCount: l._count.contacts,
        createdAt: l.createdAt.getTime(),
      })),
    };
  });
}

export async function POST(req: Request) {
  return withJsonErrors(async () => {
    const ws = await requireWorkspace();
    const body = (await req.json().catch(() => ({}))) as {
      name?: string;
      description?: string;
    };
    const name = (body.name || "").trim();
    if (!name) {
      const err: any = new Error("List name is required");
      err.status = 400;
      throw err;
    }
    const list = await prisma.list.create({
      data: {
        teamId: ws.teamId,
        name,
        description: body.description?.trim() || null,
      },
    });
    return {
      list: { id: list.id, name: list.name, description: list.description },
    };
  });
}
