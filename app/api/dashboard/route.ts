// =============================================================================
// GET /api/dashboard — aggregate metrics for the active workspace.
// Returns the four "hero" cards plus a simple 14-day events series for the
// chart, and the latest activity rows.
// =============================================================================

import { prisma } from "@/lib/prisma";
import { requireWorkspace, withJsonErrors, parseJson } from "@/lib/workspace";

export async function GET() {
  return withJsonErrors(async () => {
    const ws = await requireWorkspace();
    const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

    const [
      campaigns,
      contacts,
      templates,
      deliveredCount,
      openCount,
      bounceCount,
      activity,
    ] = await Promise.all([
      prisma.campaign.count({ where: { teamId: ws.teamId } }),
      prisma.contact.count({ where: { teamId: ws.teamId } }),
      prisma.template.count({ where: { teamId: ws.teamId } }),
      prisma.emailEvent.count({
        where: { teamId: ws.teamId, type: "delivered" },
      }),
      prisma.emailEvent.count({ where: { teamId: ws.teamId, type: "open" } }),
      prisma.emailEvent.count({
        where: { teamId: ws.teamId, type: "bounce" },
      }),
      prisma.activityLog.findMany({
        where: { teamId: ws.teamId },
        orderBy: { createdAt: "desc" },
        take: 10,
        include: { user: { select: { email: true, name: true } } },
      }),
    ]);

    const openRate =
      deliveredCount > 0
        ? Math.round((openCount / deliveredCount) * 100)
        : 0;
    const deliveryRate =
      deliveredCount + bounceCount > 0
        ? Math.round((deliveredCount / (deliveredCount + bounceCount)) * 100)
        : 100;

    // Tiny daily-bucket series for a sparkline / bar chart. Counts events
    // per day for the last 14 days.
    const rawEvents = await prisma.emailEvent.findMany({
      where: { teamId: ws.teamId, createdAt: { gte: since } },
      select: { createdAt: true, type: true },
    });
    const series: { day: string; delivered: number; opens: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      series.push({ day: key, delivered: 0, opens: 0 });
    }
    const byDay = new Map(series.map((p) => [p.day, p]));
    for (const e of rawEvents) {
      const key = e.createdAt.toISOString().slice(0, 10);
      const bucket = byDay.get(key);
      if (!bucket) continue;
      if (e.type === "delivered") bucket.delivered++;
      if (e.type === "open") bucket.opens++;
    }

    return {
      stats: {
        campaigns,
        contacts,
        templates,
        openRate,
        deliveryRate,
        delivered: deliveredCount,
        bounces: bounceCount,
      },
      series,
      activity: activity.map((a) => ({
        id: a.id,
        action: a.action,
        target: a.target,
        meta: parseJson(a.meta),
        createdAt: a.createdAt.getTime(),
        user: a.user,
      })),
    };
  });
}
