// =============================================================================
// GET /api/templates/[id]/render — returns the email-safe HTML for a template.
// Used by the preview modal in /templates. The HTML comes from
// generateEmailHtml() — the same renderer the Export HTML / Send Email path
// uses, so what's previewed is exactly what gets delivered.
// =============================================================================

import { prisma } from "@/lib/prisma";
import { requireWorkspace, withJsonErrors } from "@/lib/workspace";
import { generateEmailHtml } from "@/lib/htmlGenerator";
import type { EmailDocument } from "@/lib/types";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  return withJsonErrors(async () => {
    const ws = await requireWorkspace();
    const row = await prisma.template.findUnique({
      where: { id: params.id },
    });
    if (!row || row.teamId !== ws.teamId) {
      const err: any = new Error("Not found");
      err.status = 404;
      throw err;
    }
    let parsed: any;
    try {
      parsed = JSON.parse(row.doc);
    } catch {
      const err: any = new Error("Template body is corrupted");
      err.status = 500;
      throw err;
    }
    // Raw-HTML templates (saved via the HTML editor) are stored as
    // { _kind: "html", html, subject }. Return the HTML verbatim so the
    // preview / send path renders exactly what the author typed.
    if (parsed && parsed._kind === "html") {
      return {
        html: parsed.html || "",
        name: row.name,
        kind: "html" as const,
      };
    }
    const html = generateEmailHtml(parsed as EmailDocument);
    return { html, name: row.name, kind: "doc" as const };
  });
}
