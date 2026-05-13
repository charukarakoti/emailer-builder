// =============================================================================
// lib/email/provider.ts — outbound email via SMTP (nodemailer).
//
// Reads SMTP credentials from environment variables and exposes a single
// `sendMail()` helper. Used by /api/send today and by the campaign sender
// in a later phase.
//
// The transporter is cached as a module-level singleton because nodemailer
// does its own connection pooling internally — recreating per request would
// reopen connections every time.
//
// Required env vars:
//   SMTP_HOST  — e.g. smtp.gmail.com
//   SMTP_PORT  — usually 587 (STARTTLS) or 465 (SMTPS)
//   SMTP_USER  — login
//   SMTP_PASS  — password / app password / API key
//   SMTP_FROM  — what recipients see in From: (e.g. `JV <you@example.com>`)
// =============================================================================

import nodemailer, { type Transporter } from "nodemailer";

let cached: Transporter | null = null;
let cachedKey = "";

function envKey() {
  return [
    process.env.SMTP_HOST,
    process.env.SMTP_PORT,
    process.env.SMTP_USER,
    process.env.SMTP_PASS,
    process.env.SMTP_FROM,
  ].join("|");
}

export class EmailConfigError extends Error {
  status = 500;
  constructor(msg: string) {
    super(msg);
  }
}

function getTransporter(): Transporter {
  const host = process.env.SMTP_HOST?.trim();
  const port = Number(process.env.SMTP_PORT) || 587;
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) {
    throw new EmailConfigError(
      "SMTP is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM in your .env and restart the server."
    );
  }
  const key = envKey();
  if (cached && cachedKey === key) return cached;
  cached = nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // SMTPS on 465, STARTTLS otherwise
    auth: { user, pass },
  });
  cachedKey = key;
  return cached;
}

export interface SendMailInput {
  to: string;
  subject: string;
  html: string;
  fromName?: string;
  /** RFC 822 list to populate the Reply-To header. */
  replyTo?: string;
}

export interface SendMailResult {
  messageId: string;
  accepted: string[];
  rejected: string[];
}

/**
 * Send a single email. For multiple recipients, call this in a loop so
 * each recipient gets their own delivery row (and so one bad address doesn't
 * fail the whole batch).
 */
export async function sendMail(input: SendMailInput): Promise<SendMailResult> {
  const transporter = getTransporter();
  const envFrom = process.env.SMTP_FROM?.trim() || process.env.SMTP_USER!;
  // Allow per-send overrides of the display name while keeping the verified
  // address — many SMTP providers reject unverified From: addresses.
  const from = input.fromName
    ? `${input.fromName} <${extractAddress(envFrom)}>`
    : envFrom;

  const info = await transporter.sendMail({
    from,
    to: input.to,
    subject: input.subject,
    html: input.html,
    replyTo: input.replyTo,
  });

  return {
    messageId: info.messageId,
    accepted: (info.accepted as string[]) || [],
    rejected: (info.rejected as string[]) || [],
  };
}

/** Pull the bare email out of "Name <email@host>" — or return as-is. */
function extractAddress(s: string): string {
  const m = s.match(/<([^>]+)>/);
  return m ? m[1] : s;
}

/** Server-side check used by /api/send to give a clear error early. */
export function isSmtpConfigured(): boolean {
  return Boolean(
    process.env.SMTP_HOST &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASS &&
      process.env.SMTP_FROM
  );
}
