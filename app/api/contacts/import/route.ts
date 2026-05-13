// =============================================================================
// POST /api/contacts/import — bulk-import contacts from CSV.
//
// Body (text/plain): the raw CSV. The first row must be the header.
// Recognised columns (case-insensitive): email, first_name | firstName,
// last_name | lastName, status. Any extra columns are stored on
// `Contact.attributes` as JSON.
//
// Query params:
//   listId — if set, every imported contact is added to this list
//   tagId  — if set, every imported contact is tagged
//
// Existing contacts (matched by email) are updated, not duplicated, so the
// import is idempotent.
// =============================================================================

import { prisma } from "@/lib/prisma";
import { requireWorkspace, withJsonErrors } from "@/lib/workspace";
import { logActivity } from "@/lib/activity";
import { parseCsv } from "@/lib/csv";

const EMAIL_KEYS = ["email", "e-mail", "e_mail"];
const FIRST_KEYS = ["first_name", "firstname", "first", "given_name"];
const LAST_KEYS = ["last_name", "lastname", "last", "surname", "family_name"];
const STATUS_KEYS = ["status"];

function pick(row: Record<string, string>, keys: string[]): string | null {
  const lower: Record<string, string> = {};
  for (const k of Object.keys(row)) lower[k.toLowerCase()] = row[k];
  for (const k of keys) {
    if (lower[k] !== undefined && lower[k] !== "") return lower[k];
  }
  return null;
}

function extraAttributes(row: Record<string, string>): Record<string, string> {
  const known = new Set(
    [...EMAIL_KEYS, ...FIRST_KEYS, ...LAST_KEYS, ...STATUS_KEYS]
  );
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(row)) {
    if (v === "" || known.has(k.toLowerCase())) continue;
    out[k] = v;
  }
  return out;
}

export async function POST(req: Request) {
  return withJsonErrors(async () => {
    const ws = await requireWorkspace();
    const url = new URL(req.url);
    const listId = url.searchParams.get("listId");
    const tagId = url.searchParams.get("tagId");

    const text = await req.text();
    if (!text.trim()) {
      const err: any = new Error("Empty CSV");
      err.status = 400;
      throw err;
    }
    const { rows } = parseCsv(text);

    let created = 0;
    let updated = 0;
    let skipped = 0;
    const errors: { row: number; reason: string }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rawEmail = pick(row, EMAIL_KEYS);
      const email = rawEmail?.trim().toLowerCase();
      if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        skipped++;
        errors.push({ row: i + 2, reason: "missing or invalid email" });
        continue;
      }
      const firstName = pick(row, FIRST_KEYS);
      const lastName = pick(row, LAST_KEYS);
      const status = pick(row, STATUS_KEYS) || undefined;
      const attrs = extraAttributes(row);

      const existing = await prisma.contact.findUnique({
        where: { teamId_email: { teamId: ws.teamId, email } },
      });
      const contact = existing
        ? await prisma.contact.update({
            where: { id: existing.id },
            data: {
              firstName: firstName ?? existing.firstName,
              lastName: lastName ?? existing.lastName,
              status: status ?? existing.status,
              attributes:
                Object.keys(attrs).length > 0
                  ? JSON.stringify(attrs)
                  : existing.attributes,
            },
          })
        : await prisma.contact.create({
            data: {
              teamId: ws.teamId,
              email,
              firstName,
              lastName,
              status: status || "subscribed",
              source: "import",
              attributes:
                Object.keys(attrs).length > 0
                  ? JSON.stringify(attrs)
                  : null,
            },
          });
      if (existing) updated++;
      else created++;

      if (listId) {
        await prisma.contactList.upsert({
          where: {
            contactId_listId: { contactId: contact.id, listId },
          },
          update: {},
          create: { contactId: contact.id, listId },
        });
      }
      if (tagId) {
        await prisma.contactTag.upsert({
          where: { contactId_tagId: { contactId: contact.id, tagId } },
          update: {},
          create: { contactId: contact.id, tagId },
        });
      }
    }

    logActivity({
      teamId: ws.teamId,
      userId: ws.userId,
      action: "contacts.imported",
      meta: { created, updated, skipped },
    });

    return { created, updated, skipped, errors };
  });
}
