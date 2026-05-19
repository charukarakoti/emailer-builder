// =============================================================================
// /api/designations — workspace-scoped job-title / designation directory.
// GET   — list (with contact usage counts)
// POST  body: { name, category? }
// =============================================================================

import { prisma } from "@/lib/prisma";
import { requireWorkspace, withJsonErrors } from "@/lib/workspace";

export async function GET() {
  return withJsonErrors(async () => {
    const ws = await requireWorkspace();
    const rows = await prisma.designation.findMany({
      where: { teamId: ws.teamId },
      orderBy: { name: "asc" },
      include: { _count: { select: { contacts: true } } },
    });
    return {
      designations: rows.map((d) => ({
        id: d.id,
        name: d.name,
        category: d.category,
        usage: d._count.contacts,
      })),
    };
  });
}

export async function POST(req: Request) {
  return withJsonErrors(async () => {
    const ws = await requireWorkspace();
    const body = (await req.json().catch(() => ({}))) as {
      name?: string;
      category?: string;
    };
    const name = (body.name || "").trim();
    if (!name) {
      const err: any = new Error("Designation name is required");
      err.status = 400;
      throw err;
    }
    const designation = await prisma.designation.upsert({
      where: { teamId_name: { teamId: ws.teamId, name } },
      update: { category: body.category?.trim() || undefined },
      create: {
        teamId: ws.teamId,
        name,
        category: body.category?.trim() || null,
      },
    });
    return { designation };
  });
}
