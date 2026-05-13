// =============================================================================
// /api/activity — recent workspace activity, newest first.
// =============================================================================

import { prisma } from "@/lib/prisma";
import { requireWorkspace, withJsonErrors, parseJson } from "@/lib/workspace";

export async function GET() {
  return withJsonErrors(async () => {
    const ws = await requireWorkspace();
    const rows = await prisma.activityLog.findMany({
      where: { teamId: ws.teamId },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { user: { select: { id: true, email: true, name: true } } },
    });
    return {
      activity: rows.map((r) => ({
        id: r.id,
        action: r.action,
        target: r.target,
        meta: parseJson(r.meta),
        user: r.user,
        createdAt: r.createdAt.getTime(),
      })),
    };
  });
}
