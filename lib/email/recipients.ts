const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function normalizeRecipient(raw: string): string {
  let value = String(raw || "").trim();
  if (!value) return "";

  if (value.toLowerCase().startsWith("mailto:")) {
    value = value.slice(7).trim();
  }

  const match = value.match(/<([^>]+)>/);
  if (match) {
    value = match[1].trim();
  }

  return value;
}

export function parseRecipients(raw: string | string[]): string[] {
  const items = Array.isArray(raw)
    ? raw
    : String(raw)
        .split(/[\n\r,;]+/)
        .map((item) => item.trim());

  return items
    .map(normalizeRecipient)
    .filter((item) => item.length > 0);
}

export function isValidRecipient(email: string): boolean {
  return EMAIL_RE.test(email);
}
