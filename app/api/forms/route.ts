// =============================================================================
// /api/forms — workspace-scoped subscriber forms.
// Phase 1 — list + create. The public submit endpoint lives at
// /api/forms/[id]/submit (Phase 5) and is the only unauthenticated form route.
// =============================================================================

import { prisma } from "@/lib/prisma";
import { requireWorkspace, withJsonErrors, parseJson } from "@/lib/workspace";

export async function GET() {
  return withJsonErrors(async () => {
    const ws = await requireWorkspace();
    const forms = await prisma.form.findMany({
      where: { teamId: ws.teamId },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { submissions: true } } },
    });
    return {
      forms: forms.map((f) => ({
        id: f.id,
        name: f.name,
        type: f.type,
        config: parseJson(f.config),
        listId: f.listId,
        submissionCount: f._count.submissions,
        createdAt: f.createdAt.getTime(),
      })),
    };
  });
}

export async function POST(req: Request) {
  return withJsonErrors(async () => {
    const ws = await requireWorkspace();
    const body = (await req.json().catch(() => ({}))) as {
      name?: string;
      type?: string;
      config?: unknown;
      listId?: string | null;
    };
    const name = (body.name || "").trim();
    if (!name) {
      const err: any = new Error("Form name is required");
      err.status = 400;
      throw err;
    }
    const form = await prisma.form.create({
      data: {
        teamId: ws.teamId,
        name,
        type: body.type === "popup" || body.type === "inline" ? body.type : "embed",
        config: JSON.stringify(body.config ?? { fields: [{ key: "email", label: "Email", required: true }] }),
        listId: body.listId || null,
      },
    });
    return { form };
  });
}
