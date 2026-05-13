// =============================================================================
// POST /api/send/test — send a "this is a test" email to a single address.
// Used by the builder's Send dialog to validate SMTP config without touching
// the real recipient list.
//
// Body: { to: string, subject?: string }
// =============================================================================

import { withJsonErrors, requireWorkspace } from "@/lib/workspace";
import { sendMail, isSmtpConfigured, EmailConfigError } from "@/lib/email/provider";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export async function POST(req: Request) {
  return withJsonErrors(async () => {
    await requireWorkspace();
    if (!isSmtpConfigured()) {
      throw new EmailConfigError(
        "SMTP is not configured. Fill in SMTP_* in .env and restart the dev server."
      );
    }
    const body = (await req.json().catch(() => ({}))) as {
      to?: string;
      subject?: string;
    };
    const to = (body.to || "").trim().toLowerCase();
    if (!EMAIL_RE.test(to)) {
      const err: any = new Error("A valid recipient email is required");
      err.status = 400;
      throw err;
    }
    const subject = (body.subject || "Test from Email Builder").trim();
    const html = `
      <div style="font-family:Arial,sans-serif;font-size:14px;color:#111">
        <p>This is a test email from your Email Builder app.</p>
        <p>If you're reading this, your SMTP configuration works and you can
           send to your full recipient list.</p>
      </div>`;
    const result = await sendMail({ to, subject, html });
    return { ok: true, messageId: result.messageId };
  });
}
