// =============================================================================
// /api/events — read-only aggregate / list endpoint for the active workspace.
// Write endpoints are split out per source under /api/events/track/*
// (Phase 4) so they can be hit without auth from tracking pixels.
// =============================================================================

import { prisma } from "@/lib/prisma";
import { requireWorkspace, withJsonErrors } from "@/lib/workspace";

export async function GET(req: Request) {
  return withJsonErrors(async () => {
    const ws = await requireWorkspace();
    const url = new URL(req.url);
    const campaignId = url.searchParams.get("campaignId");
    const type = url.searchParams.get("type");
    const events = await prisma.emailEvent.findMany({
      where: {
        teamId: ws.teamId,
        ...(campaignId ? { campaignId } : {}),
        ...(type ? { type } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 500,
    });
    return { events };
  });
}
