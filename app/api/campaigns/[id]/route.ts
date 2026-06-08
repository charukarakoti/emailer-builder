import { prisma } from "@/lib/prisma";
import { requireWorkspace, withJsonErrors } from "@/lib/workspace";

function safeParse(value: string | null): unknown {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  return withJsonErrors(async () => {
    const ws = await requireWorkspace();
    const campaign = await prisma.campaign.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        name: true,
        subject: true,
        templateId: true,
        template: { select: { id: true, name: true } },
        doc: true,
        teamId: true,
      },
    });
    if (!campaign || campaign.teamId !== ws.teamId) {
      const err: any = new Error("Campaign not found");
      err.status = 404;
      throw err;
    }
    return {
      campaign: {
        id: campaign.id,
        name: campaign.name,
        subject: campaign.subject,
        templateId: campaign.templateId,
        template: campaign.template,
        doc: safeParse(campaign.doc),
      },
    };
  });
}

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  return withJsonErrors(async () => {
    const ws = await requireWorkspace();
    const body = (await req.json().catch(() => ({}))) as {
      doc?: unknown;
      subject?: string;
      fromName?: string;
      fromEmail?: string;
      replyTo?: string;
    };

    if (!body.doc || typeof body.doc !== "object") {
      const err: any = new Error("Campaign doc is required");
      err.status = 400;
      throw err;
    }

    const campaign = await prisma.campaign.updateMany({
      where: { id: params.id, teamId: ws.teamId },
      data: {
        doc: JSON.stringify(body.doc),
        subject: body.subject?.trim() ?? undefined,
        fromName: body.fromName?.trim() ?? undefined,
        fromEmail: body.fromEmail?.trim() ?? undefined,
        replyTo: body.replyTo?.trim() ?? undefined,
      },
    });

    if (campaign.count !== 1) {
      const err: any = new Error("Campaign not found");
      err.status = 404;
      throw err;
    }

    const updated = await prisma.campaign.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        name: true,
        subject: true,
        templateId: true,
        template: { select: { id: true, name: true } },
        doc: true,
      },
    });

    return {
      campaign: {
        id: updated?.id,
        name: updated?.name,
        subject: updated?.subject,
        templateId: updated?.templateId,
        template: updated?.template,
        doc: safeParse(updated?.doc ?? null),
      },
    };
  });
}
