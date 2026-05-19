// =============================================================================
// /api/companies — workspace-scoped company directory.
// GET   ?q=        — list (search by name / industry)
// POST  body: { name, industry?, website?, notes? }
// =============================================================================

import { prisma } from "@/lib/prisma";
import { requireWorkspace, withJsonErrors } from "@/lib/workspace";
import { logActivity } from "@/lib/activity";

export async function GET(req: Request) {
  return withJsonErrors(async () => {
    const ws = await requireWorkspace();
    const q = new URL(req.url).searchParams.get("q")?.trim() || "";
    const where: any = { teamId: ws.teamId };
    if (q) {
      where.OR = [
        { name: { contains: q } },
        { industry: { contains: q } },
      ];
    }
    const rows = await prisma.company.findMany({
      where,
      orderBy: { name: "asc" },
      include: { _count: { select: { contacts: true } } },
    });
    return {
      companies: rows.map((c) => ({
        id: c.id,
        name: c.name,
        industry: c.industry,
        website: c.website,
        notes: c.notes,
        contactCount: c._count.contacts,
        createdAt: c.createdAt.getTime(),
      })),
    };
  });
}

export async function POST(req: Request) {
  return withJsonErrors(async () => {
    const ws = await requireWorkspace();
    const body = (await req.json().catch(() => ({}))) as {
      name?: string;
      industry?: string;
      website?: string;
      notes?: string;
    };
    const name = (body.name || "").trim();
    if (!name) {
      const err: any = new Error("Company name is required");
      err.status = 400;
      throw err;
    }
    const company = await prisma.company.upsert({
      where: { teamId_name: { teamId: ws.teamId, name } },
      update: {
        industry: body.industry?.trim() || undefined,
        website: body.website?.trim() || undefined,
        notes: body.notes?.trim() || undefined,
      },
      create: {
        teamId: ws.teamId,
        name,
        industry: body.industry?.trim() || null,
        website: body.website?.trim() || null,
        notes: body.notes?.trim() || null,
      },
    });
    logActivity({
      teamId: ws.teamId,
      userId: ws.userId,
      action: "company.created",
      target: `company:${company.id}`,
      meta: { name },
    });
    return { company };
  });
}
