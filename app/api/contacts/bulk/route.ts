// =============================================================================
// POST /api/contacts/bulk — bulk actions over selected contacts.
//
// Body: {
//   ids: string[],
//   action: "delete" | "addToList" | "removeFromList" | "tag" | "untag" |
//           "setStatus",
//   listId?: string,        // for addToList / removeFromList
//   tagId?: string,         // for tag / untag
//   status?: string,        // for setStatus
// }
//
// Every action is workspace-scoped — contacts outside the active workspace
// are filtered out before the action runs.
// =============================================================================

import { prisma } from "@/lib/prisma";
import { requireWorkspace, withJsonErrors } from "@/lib/workspace";
import { logActivity } from "@/lib/activity";

export async function POST(req: Request) {
  return withJsonErrors(async () => {
    const ws = await requireWorkspace();
    const body = (await req.json().catch(() => ({}))) as {
      ids?: string[];
      action?: string;
      listId?: string;
      tagId?: string;
      status?: string;
    };
    const ids = (body.ids || []).filter((x) => typeof x === "string");
    if (ids.length === 0) {
      const err: any = new Error("ids[] required");
      err.status = 400;
      throw err;
    }

    // Filter to contacts inside this workspace.
    const owned = await prisma.contact.findMany({
      where: { id: { in: ids }, teamId: ws.teamId },
      select: { id: true },
    });
    const ownedIds = owned.map((c) => c.id);

    switch (body.action) {
      case "delete":
        await prisma.contact.deleteMany({ where: { id: { in: ownedIds } } });
        break;

      case "addToList":
        if (!body.listId) throw badRequest("listId required");
        await prisma.contactList.createMany({
          data: ownedIds.map((contactId) => ({
            contactId,
            listId: body.listId!,
          })),
        });
        break;

      case "removeFromList":
        if (!body.listId) throw badRequest("listId required");
        await prisma.contactList.deleteMany({
          where: { contactId: { in: ownedIds }, listId: body.listId },
        });
        break;

      case "tag":
        if (!body.tagId) throw badRequest("tagId required");
        await prisma.contactTag.createMany({
          data: ownedIds.map((contactId) => ({
            contactId,
            tagId: body.tagId!,
          })),
        });
        break;

      case "untag":
        if (!body.tagId) throw badRequest("tagId required");
        await prisma.contactTag.deleteMany({
          where: { contactId: { in: ownedIds }, tagId: body.tagId },
        });
        break;

      case "setStatus":
        if (!body.status) throw badRequest("status required");
        await prisma.contact.updateMany({
          where: { id: { in: ownedIds } },
          data: { status: body.status },
        });
        break;

      default:
        throw badRequest("unknown action");
    }

    logActivity({
      teamId: ws.teamId,
      userId: ws.userId,
      action: `contacts.bulk.${body.action}`,
      meta: { count: ownedIds.length },
    });

    return { affected: ownedIds.length };
  });
}

function badRequest(msg: string) {
  const err: any = new Error(msg);
  err.status = 400;
  return err;
}
