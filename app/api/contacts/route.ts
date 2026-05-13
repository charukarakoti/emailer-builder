// =============================================================================
// /api/contacts — workspace-scoped CRM contacts.
//
// GET   ?q=&status=&listId=&tagId=&take=&skip=
// POST  body: { email, firstName?, lastName?, attributes?, listIds?, tagIds? }
//
// The list returns total + rows so the page can paginate. Filters are
// composable (q searches email, first, last; status / listId / tagId
// narrow further).
// =============================================================================

import { prisma } from "@/lib/prisma";
import { requireWorkspace, withJsonErrors, parseJson } from "@/lib/workspace";
import { logActivity } from "@/lib/activity";

export async function GET(req: Request) {
  return withJsonErrors(async () => {
    const ws = await requireWorkspace();
    const url = new URL(req.url);
    const q = url.searchParams.get("q")?.trim() || "";
    const status = url.searchParams.get("status");
    const listId = url.searchParams.get("listId");
    const tagId = url.searchParams.get("tagId");
    const take = Math.min(
      200,
      Math.max(1, Number(url.searchParams.get("take")) || 50)
    );
    const skip = Math.max(0, Number(url.searchParams.get("skip")) || 0);

    const where: any = { teamId: ws.teamId };
    if (status) where.status = status;
    if (listId) where.lists = { some: { listId } };
    if (tagId) where.tags = { some: { tagId } };
    if (q) {
      // SQLite "contains" is case-sensitive — but field-level normalization
      // is good enough for Phase 1. Promote to ILIKE on Postgres later.
      where.OR = [
        { email: { contains: q } },
        { firstName: { contains: q } },
        { lastName: { contains: q } },
      ];
    }

    const [rows, total] = await Promise.all([
      prisma.contact.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take,
        skip,
        include: {
          lists: { include: { list: { select: { id: true, name: true } } } },
          tags: { include: { tag: { select: { id: true, name: true, color: true } } } },
        },
      }),
      prisma.contact.count({ where }),
    ]);

    return {
      total,
      take,
      skip,
      contacts: rows.map((c) => ({
        id: c.id,
        email: c.email,
        firstName: c.firstName,
        lastName: c.lastName,
        status: c.status,
        source: c.source,
        attributes: parseJson(c.attributes),
        createdAt: c.createdAt.getTime(),
        lists: c.lists.map((cl) => cl.list),
        tags: c.tags.map((ct) => ct.tag),
      })),
    };
  });
}

export async function POST(req: Request) {
  return withJsonErrors(async () => {
    const ws = await requireWorkspace();
    const body = (await req.json().catch(() => ({}))) as {
      email?: string;
      firstName?: string;
      lastName?: string;
      attributes?: Record<string, unknown>;
      status?: string;
      listIds?: string[];
      tagIds?: string[];
    };
    const email = (body.email || "").trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      const err: any = new Error("A valid email is required");
      err.status = 400;
      throw err;
    }

    const contact = await prisma.contact.upsert({
      where: { teamId_email: { teamId: ws.teamId, email } },
      update: {
        firstName: body.firstName?.trim() || undefined,
        lastName: body.lastName?.trim() || undefined,
        attributes: body.attributes
          ? JSON.stringify(body.attributes)
          : undefined,
        status: body.status || undefined,
      },
      create: {
        teamId: ws.teamId,
        email,
        firstName: body.firstName?.trim() || null,
        lastName: body.lastName?.trim() || null,
        attributes: body.attributes ? JSON.stringify(body.attributes) : null,
        status: body.status || "subscribed",
        source: "manual",
      },
    });

    if (body.listIds?.length) {
      await Promise.all(
        body.listIds.map((listId) =>
          prisma.contactList.upsert({
            where: { contactId_listId: { contactId: contact.id, listId } },
            update: {},
            create: { contactId: contact.id, listId },
          })
        )
      );
    }
    if (body.tagIds?.length) {
      await Promise.all(
        body.tagIds.map((tagId) =>
          prisma.contactTag.upsert({
            where: { contactId_tagId: { contactId: contact.id, tagId } },
            update: {},
            create: { contactId: contact.id, tagId },
          })
        )
      );
    }

    logActivity({
      teamId: ws.teamId,
      userId: ws.userId,
      action: "contact.created",
      target: `contact:${contact.id}`,
      meta: { email },
    });

    return { contact };
  });
}
