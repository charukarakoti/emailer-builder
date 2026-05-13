// =============================================================================
// /api/contacts/[id]
// GET    — fetch
// PUT    — update fields and replace list/tag membership
// DELETE — remove (and cascade ContactList / ContactTag via FK)
// =============================================================================

import { prisma } from "@/lib/prisma";
import { requireWorkspace, withJsonErrors, parseJson } from "@/lib/workspace";
import { logActivity } from "@/lib/activity";

async function loadOwned(id: string, teamId: string) {
  const c = await prisma.contact.findUnique({
    where: { id },
    include: {
      lists: { include: { list: true } },
      tags: { include: { tag: true } },
    },
  });
  if (!c || c.teamId !== teamId) return null;
  return c;
}

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  return withJsonErrors(async () => {
    const ws = await requireWorkspace();
    const c = await loadOwned(params.id, ws.teamId);
    if (!c) {
      const err: any = new Error("Not found");
      err.status = 404;
      throw err;
    }
    return {
      contact: {
        id: c.id,
        email: c.email,
        firstName: c.firstName,
        lastName: c.lastName,
        status: c.status,
        attributes: parseJson(c.attributes),
        lists: c.lists.map((l) => l.list),
        tags: c.tags.map((t) => t.tag),
        createdAt: c.createdAt.getTime(),
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
    const existing = await loadOwned(params.id, ws.teamId);
    if (!existing) {
      const err: any = new Error("Not found");
      err.status = 404;
      throw err;
    }
    const body = (await req.json().catch(() => ({}))) as {
      firstName?: string;
      lastName?: string;
      status?: string;
      attributes?: Record<string, unknown>;
      listIds?: string[];
      tagIds?: string[];
    };

    await prisma.contact.update({
      where: { id: existing.id },
      data: {
        firstName: body.firstName?.trim() || null,
        lastName: body.lastName?.trim() || null,
        status: body.status || existing.status,
        attributes: body.attributes
          ? JSON.stringify(body.attributes)
          : existing.attributes,
      },
    });

    if (body.listIds) {
      await prisma.contactList.deleteMany({
        where: { contactId: existing.id },
      });
      if (body.listIds.length) {
        await prisma.contactList.createMany({
          data: body.listIds.map((listId) => ({
            contactId: existing.id,
            listId,
          })),
        });
      }
    }
    if (body.tagIds) {
      await prisma.contactTag.deleteMany({
        where: { contactId: existing.id },
      });
      if (body.tagIds.length) {
        await prisma.contactTag.createMany({
          data: body.tagIds.map((tagId) => ({
            contactId: existing.id,
            tagId,
          })),
        });
      }
    }

    logActivity({
      teamId: ws.teamId,
      userId: ws.userId,
      action: "contact.updated",
      target: `contact:${existing.id}`,
    });

    return { ok: true };
  });
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  return withJsonErrors(async () => {
    const ws = await requireWorkspace();
    const existing = await loadOwned(params.id, ws.teamId);
    if (!existing) {
      const err: any = new Error("Not found");
      err.status = 404;
      throw err;
    }
    await prisma.contact.delete({ where: { id: existing.id } });
    logActivity({
      teamId: ws.teamId,
      userId: ws.userId,
      action: "contact.deleted",
      target: `contact:${existing.id}`,
      meta: { email: existing.email },
    });
    return { ok: true };
  });
}
