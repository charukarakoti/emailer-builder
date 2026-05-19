// =============================================================================
// POST /api/media/upload — multipart image upload.
//
// Body: multipart/form-data with one or more `file` fields.
// Files land in /public/uploads/media/<random>-<safe-name>. Workspace-scoped
// Media rows are inserted so the gallery and the builder can list / pick
// them later.
//
// For Phase 5 production: replace the local writer with an S3 / Cloudinary
// adapter (see ARCHITECTURE.md → lib/media/storage.ts). The Media row shape
// is already compatible — only `url` + `storageKey` change.
// =============================================================================

import { prisma } from "@/lib/prisma";
import { requireWorkspace, withJsonErrors } from "@/lib/workspace";
import { logActivity } from "@/lib/activity";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const ACCEPTED = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/gif",
  "image/svg+xml",
  "image/webp",
]);
const MAX_BYTES = 8 * 1024 * 1024; // 8 MB per file

export async function POST(req: Request) {
  return withJsonErrors(async () => {
    const ws = await requireWorkspace();
    const form = await req.formData();
    const files = form.getAll("file").filter((v) => v instanceof File) as File[];
    if (files.length === 0) {
      const err: any = new Error("No files in request");
      err.status = 400;
      throw err;
    }
    const dir = path.join(process.cwd(), "public", "uploads", "media");
    await mkdir(dir, { recursive: true });

    const inserted: any[] = [];
    const errors: { filename: string; reason: string }[] = [];

    for (const f of files) {
      try {
        if (f.size > MAX_BYTES) {
          errors.push({
            filename: f.name,
            reason: `Too large (${Math.round(f.size / 1024)} KB). Max 8 MB.`,
          });
          continue;
        }
        if (f.type && !ACCEPTED.has(f.type)) {
          errors.push({
            filename: f.name,
            reason: `Unsupported type ${f.type}`,
          });
          continue;
        }
        const safe = f.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const key = `${crypto.randomBytes(6).toString("base64url")}-${safe}`;
        const dest = path.join(dir, key);
        const buf = Buffer.from(await f.arrayBuffer());
        await writeFile(dest, buf);

        const row = await prisma.media.create({
          data: {
            teamId: ws.teamId,
            uploadedById: ws.userId,
            kind: "image",
            url: `/uploads/media/${key}`,
            storageKey: key,
            filename: f.name,
            contentType: f.type || null,
            sizeBytes: f.size,
          },
        });
        inserted.push(row);
      } catch (e: any) {
        errors.push({
          filename: f.name,
          reason: e?.message || "write failed",
        });
      }
    }

    if (inserted.length > 0) {
      logActivity({
        teamId: ws.teamId,
        userId: ws.userId,
        action: "media.uploaded",
        meta: { count: inserted.length },
      });
    }

    return { uploaded: inserted, errors };
  });
}
