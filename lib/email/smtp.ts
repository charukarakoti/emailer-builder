// =============================================================================
// lib/email/smtp.ts — thin re-export of the canonical SMTP provider.
//
// The full implementation lives in `lib/email/provider.ts`. This file exists
// so older imports that referenced `@/lib/email/smtp` keep working without
// any code changes.
// =============================================================================

export {
  sendMail,
  isSmtpConfigured,
  EmailConfigError,
  type SendMailInput,
  type SendMailResult,
} from "./provider";
