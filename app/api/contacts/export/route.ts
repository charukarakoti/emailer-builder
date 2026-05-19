// =============================================================================
// GET /api/contacts/export — workspace contacts as a CSV download.
//
// Query params (same filters as /api/contacts GET):
//   q, status, listId, tagId
//
// Returns a text/csv response with headers + one row per contact. Custom
// attributes are flattened to attributes_<key> columns at the right. Lists
// and tags are joined as semicolon-separated values so they survive a round
// trip through Excel.
// =============================================================================

import { prisma } from "@/lib/prisma";
import { requireWorkspace } from "@/lib/workspace";
import { parseJson } from "@/lib/workspace";

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function GET(req: Request) {
  try {
    const ws = await requireWorkspace();
    const url = new URL(req.url);
    const q = url.searchParams.get("q")?.trim() || "";
    const status = url.searchParams.get("status");
    const listId = url.searchParams.get("listId");
    const tagId = url.searchParams.get("tagId");

    const where: any = { teamId: ws.teamId };
    if (status) where.status = status;
    if (listId) where.lists = { some: { listId } };
    if (tagId) where.tags = { some: { tagId } };
    if (q) {
      where.OR = [
        { email: { contains: q } },
        { firstName: { contains: q } },
        { lastName: { contains: q } },
      ];
    }

    const rows = await prisma.contact.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        lists: { include: { list: { select: { name: true } } } },
        tags: { include: { tag: { select: { name: true } } } },
        company: { select: { name: true } },
        designation: { select: { name: true } },
      },
    });

    // Collect every custom-attribute key so the header line has a column
    // for each.
    const attrKeys = new Set<string>();
    const parsedAttrs: Record<string, Record<string, string>> = {};
    for (const r of rows) {
      const o = parseJson<Record<string, string>>(r.attributes) || {};
      parsedAttrs[r.id] = o;
      Object.keys(o).forEach((k) => attrKeys.add(k));
    }
    const attrCols = [...attrKeys].sort();

    const header = [
      "email",
      "first_name",
      "last_name",
      "status",
      "source",
      "company",
      "designation",
      "lists",
      "tags",
      "created_at",
      ...attrCols.map((k) => `attributes_${k}`),
    ];

    const lines: string[] = [header.map(csvCell).join(",")];
    for (const r of rows) {
      const attrs = parsedAttrs[r.id] || {};
      lines.push(
        [
          r.email,
          r.firstName,
          r.lastName,
          r.status,
          r.source,
          r.company?.name || "",
          r.designation?.name || "",
          r.lists.map((cl) => cl.list.name).join("; "),
          r.tags.map((ct) => ct.tag.name).join("; "),
          r.createdAt.toISOString(),
          ...attrCols.map((k) => attrs[k] ?? ""),
        ]
          .map(csvCell)
          .join(",")
      );
    }

    const csv = lines.join("\n");
    const filename = `contacts-${new Date().toISOString().slice(0, 10)}.csv`;
    return new Response(csv, {
      status: 200,
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (e: any) {
    return new Response(
      JSON.stringify({ error: e?.message || "Export failed" }),
      {
        status: e?.status || 500,
        headers: { "content-type": "application/json" },
      }
    );
  }
}
