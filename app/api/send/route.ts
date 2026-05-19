// =============================================================================
// POST /api/send — send the current canvas (or a saved template) as email.
//
// Body (one of):
//   { to: string[], subject?, doc, fromName?, replyTo? }
//   { to: string[], subject?, templateId, fromName?, replyTo? }
//
// `to` is an array. Each recipient gets a separate SMTP message so a bad
// address doesn't poison the rest of the batch. The HTML is generated from
// the EmailDocument with the same `generateEmailHtml()` the Export HTML
// button uses, so what the user sees in preview is what gets delivered.
//
// Activity is logged. Per-recipient EmailEvent rows are inserted for future
// analytics (type = "delivered" on success, "bounce" on hard failure).
// =============================================================================

import { prisma } from "@/lib/prisma";
import { requireWorkspace, withJsonErrors } from "@/lib/workspace";
import { logActivity } from "@/lib/activity";
import {
  sendMail,
  isSmtpConfigured,
  EmailConfigError,
} from "@/lib/email/provider";
import { generateEmailHtml } from "@/lib/htmlGenerator";
import type { EmailDocument } from "@/lib/types";

interface SendBody {
  to?: string[];
  subject?: string;
  doc?: EmailDocument;
  templateId?: string;
  /** Send raw HTML composed in the HTML editor (no template row needed). */
  rawHtml?: string;
  fromName?: string;
  replyTo?: string;
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export async function POST(req: Request) {
  return withJsonErrors(async () => {
    const ws = await requireWorkspace();

    if (!isSmtpConfigured()) {
      throw new EmailConfigError(
        "SMTP is not configured. Open .env and fill in SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM, then restart the dev server."
      );
    }

    const body = (await req.json().catch(() => ({}))) as SendBody;

    // ----- validate recipients --------------------------------------------
    const recipients = (body.to || [])
      .map((s) => String(s).trim().toLowerCase())
      .filter((s) => s.length > 0);
    const invalid = recipients.filter((r) => !EMAIL_RE.test(r));
    if (recipients.length === 0) {
      throw badRequest("At least one recipient email is required");
    }
    if (invalid.length) {
      throw badRequest(`Invalid email address(es): ${invalid.join(", ")}`);
    }

    // ----- resolve document → HTML ----------------------------------------
    // Two template shapes are supported:
    //   • Visual builder doc (EmailDocument)  → rendered with generateEmailHtml
    //   • Raw HTML (saved by the HTML editor) → sent verbatim
    let html = "";
    let doc: EmailDocument | null = null;
    let templateName: string | null = null;
    let rawHtmlSubject: string | null = null;

    if (body.templateId) {
      const row = await prisma.template.findUnique({
        where: { id: body.templateId },
      });
      if (!row || row.teamId !== ws.teamId) {
        throw notFound("Template not found in this workspace");
      }
      let parsed: any;
      try {
        parsed = JSON.parse(row.doc);
      } catch {
        throw badRequest("Saved template has a corrupted body");
      }
      templateName = row.name;
      if (parsed && parsed._kind === "html") {
        html = String(parsed.html || "");
        rawHtmlSubject = parsed.subject || null;
      } else {
        doc = parsed as EmailDocument;
        html = generateEmailHtml(doc);
      }
    } else if (typeof body.rawHtml === "string" && body.rawHtml.trim()) {
      // HTML editor → send the source verbatim. No EmailDocument is built.
      html = body.rawHtml;
    } else if (body.doc && typeof body.doc === "object") {
      doc = body.doc as EmailDocument;
      html = generateEmailHtml(doc);
    } else {
      throw badRequest("Either doc, templateId or rawHtml is required");
    }

    const subject =
      (body.subject || "").trim() ||
      doc?.meta?.subject ||
      rawHtmlSubject ||
      templateName ||
      "(no subject)";

    // ----- send per-recipient ---------------------------------------------
    const sent: string[] = [];
    const failed: { email: string; error: string }[] = [];

    for (const to of recipients) {
      try {
        await sendMail({
          to,
          subject,
          html,
          fromName: body.fromName,
          replyTo: body.replyTo,
        });
        sent.push(to);
        // Best-effort tracking. The contact row may not exist; if it does,
        // we link the event to it so the future analytics dashboard works.
        const contact = await prisma.contact
          .findUnique({
            where: { teamId_email: { teamId: ws.teamId, email: to } },
            select: { id: true },
          })
          .catch(() => null);
        await prisma.emailEvent
          .create({
            data: {
              teamId: ws.teamId,
              contactId: contact?.id ?? null,
              type: "delivered",
              meta: JSON.stringify({ subject }),
              source: "smtp",
            },
          })
          .catch(() => {});
      } catch (err: any) {
        failed.push({ email: to, error: err?.message || "send failed" });
        await prisma.emailEvent
          .create({
            data: {
              teamId: ws.teamId,
              type: "bounce",
              meta: JSON.stringify({
                to,
                subject,
                error: err?.message || "send failed",
              }),
              source: "smtp",
            },
          })
          .catch(() => {});
      }
    }

    logActivity({
      teamId: ws.teamId,
      userId: ws.userId,
      action: "email.sent",
      target: body.templateId ? `template:${body.templateId}` : null,
      meta: {
        subject,
        sent: sent.length,
        failed: failed.length,
        recipients: recipients.length,
      },
    });

    return { sent, failed };
  });
}

function badRequest(msg: string) {
  const err: any = new Error(msg);
  err.status = 400;
  return err;
}
function notFound(msg: string) {
  const err: any = new Error(msg);
  err.status = 404;
  return err;
}
