// =============================================================================
// PUT /api/workspace — rename the active workspace.
// Only OWNERs can rename.
// =============================================================================

import { prisma } from "@/lib/prisma";
import { requireWorkspace, withJsonErrors } from "@/lib/workspace";

export async function PUT(req: Request) {
  return withJsonErrors(async () => {
    const ws = await requireWorkspace();
    const membership = await prisma.membership.findUnique({
      where: { userId_teamId: { userId: ws.userId, teamId: ws.teamId } },
    });
    if (!membership || membership.role !== "OWNER") {
      const err: any = new Error(
        "Only the workspace owner can rename the workspace"
      );
      err.status = 403;
      throw err;
    }
    const body = (await req.json().catch(() => ({}))) as { name?: string };
    const name = (body.name || "").trim();
    if (!name) {
      const err: any = new Error("Workspace name is required");
      err.status = 400;
      throw err;
    }
    const team = await prisma.team.update({
      where: { id: ws.teamId },
      data: { name },
    });
    return { team };
  });
}
