// =============================================================================
// GET /api/signatures/[id]/render — returns the signature as HTML.
// Used by the preview iframe + the copy/download flow.
// =============================================================================

import { prisma } from "@/lib/prisma";
import { requireWorkspace, withJsonErrors } from "@/lib/workspace";
import {
  renderSignatureHtml,
  renderSignatureDocument,
  type SignatureDoc,
} from "@/lib/signatureHtml";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  return withJsonErrors(async () => {
    const ws = await requireWorkspace();
    const row = await prisma.signature.findUnique({ where: { id: params.id } });
    if (!row || row.teamId !== ws.teamId) {
      const err: any = new Error("Not found");
      err.status = 404;
      throw err;
    }
    let doc: SignatureDoc;
    try {
      doc = JSON.parse(row.doc) as SignatureDoc;
    } catch {
      const err: any = new Error("Signature body is corrupted");
      err.status = 500;
      throw err;
    }
    const full = new URL(req.url).searchParams.get("full") === "1";
    return {
      html: full ? renderSignatureDocument(doc) : renderSignatureHtml(doc),
      bytes: Buffer.byteLength(renderSignatureHtml(doc), "utf8"),
    };
  });
}
