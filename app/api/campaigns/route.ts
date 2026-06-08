// =============================================================================
// /api/campaigns — workspace-scoped campaigns.
// Phase 1 — list + create as draft. Send/schedule/test endpoints will live
// under /api/campaigns/[id]/{send,schedule,test} in Phase 3.
// =============================================================================

import { prisma } from "@/lib/prisma";
import { requireWorkspace, withJsonErrors } from "@/lib/workspace";

export async function GET() {
  return withJsonErrors(async () => {
    const ws = await requireWorkspace();
    const campaigns = await prisma.campaign.findMany({
      where: { teamId: ws.teamId },
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { recipients: true } },
        template: { select: { id: true, name: true } },
      },
    });
    return {
      campaigns: campaigns.map((c) => ({
        id: c.id,
        name: c.name,
        subject: c.subject,
        status: c.status,
        scheduledAt: c.scheduledAt?.toISOString() ?? null,
        sentAt: c.sentAt?.toISOString() ?? null,
        recipientCount: c._count.recipients,
        template: c.template,
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
      subject?: string;
      templateId?: string;
      fromName?: string;
      fromEmail?: string;
      replyTo?: string;
      doc?: unknown;
    };
    const name = (body.name || "").trim();
    if (!name) {
      const err: any = new Error("Campaign name is required");
      err.status = 400;
      throw err;
    }
    const campaign = await prisma.campaign.create({
      data: {
        teamId: ws.teamId,
        createdById: ws.userId,
        name,
        subject: (body.subject || "").trim(),
        templateId: body.templateId || null,
        fromName: body.fromName?.trim() || null,
        fromEmail: body.fromEmail?.trim() || null,
        replyTo: body.replyTo?.trim() || null,
        doc: body.doc ? JSON.stringify(body.doc) : null,
      },
    });
    return { campaign };
  });
}
