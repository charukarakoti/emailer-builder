// =============================================================================
// GET  /api/templates — list every template in the user's active team.
// POST /api/templates — create a new template in the active team.
//
// Templates are team-scoped: anyone in the team can read them; only the
// owner can update/delete via /api/templates/[id].
//
// The "save as new" behavior (append " (2)" if name collides) is preserved
// from the old localStorage version so callers don't have to change.
// =============================================================================

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";

async function uniqueName(desired: string, teamId: string): Promise<string> {
  const existing = await prisma.template.findMany({
    where: { teamId },
    select: { name: true },
  });
  const taken = new Set(existing.map((t) => t.name));
  if (!taken.has(desired)) return desired;
  let n = 2;
  while (taken.has(`${desired} (${n})`)) n++;
  return `${desired} (${n})`;
}

function safeParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    const session = await requireSession();
    if (!session.activeTeamId) {
      return NextResponse.json({ templates: [] });
    }
    const rows = await prisma.template.findMany({
      where: { teamId: session.activeTeamId },
      include: { owner: { select: { id: true, email: true, name: true } } },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({
      templates: rows.map((t) => {
        const parsed = safeParse(t.doc) as any;
        const kind =
          parsed && typeof parsed === "object" && parsed._kind === "html"
            ? "html"
            : "doc";
        return {
          id: t.id,
          name: t.name,
          doc: parsed,
          kind,
          createdAt: t.createdAt.getTime(),
          updatedAt: t.updatedAt.getTime(),
          owner: t.owner,
          isMine: t.ownerId === session.userId,
        };
      }),
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message || "Error" },
      { status: e.status || 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireSession();
    if (!session.activeTeamId) {
      return NextResponse.json(
        { error: "No active team — please create or join one first" },
        { status: 400 }
      );
    }
    const body = (await req.json().catch(() => ({}))) as {
      name?: string;
      doc?: unknown;
      // Raw HTML mode (HTML editor saves through here).
      rawHtml?: string;
      subject?: string;
    };
    const desiredName = (body.name || "").trim() || "Untitled template";

    // Two save shapes:
    //   1. Visual builder → { doc: EmailDocument } (existing flow)
    //   2. HTML editor    → { rawHtml: "<html>…", subject: "…" }
    //
    // Both end up serialised into the `doc` string column. The render
    // endpoint detects the second shape via the `_kind: "html"` marker
    // we attach below.
    let docToStore: string;
    if (typeof body.rawHtml === "string") {
      docToStore = JSON.stringify({
        _kind: "html",
        html: body.rawHtml,
        subject: body.subject || "",
      });
    } else if (body.doc && typeof body.doc === "object") {
      docToStore = JSON.stringify(body.doc);
    } else {
      return NextResponse.json(
        { error: "doc or rawHtml is required" },
        { status: 400 }
      );
    }

    const finalName = await uniqueName(desiredName, session.activeTeamId);
    const t = await prisma.template.create({
      data: {
        name: finalName,
        doc: docToStore,
        ownerId: session.userId,
        teamId: session.activeTeamId,
      },
    });
    return NextResponse.json({
      template: {
        id: t.id,
        name: t.name,
        doc: safeParse(t.doc),
        createdAt: t.createdAt.getTime(),
        updatedAt: t.updatedAt.getTime(),
        isMine: true,
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message || "Error" },
      { status: e.status || 500 }
    );
  }
}
