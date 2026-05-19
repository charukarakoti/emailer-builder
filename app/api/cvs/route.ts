// =============================================================================
// /api/cvs — workspace-scoped CV / resume library.
// GET  — list, newest first
// POST — multipart/form-data upload: { file, title?, contactId? }
//
// Files are saved to /public/uploads/cvs/<random>-<filename>. For production
// swap this for an S3 / Cloudinary adapter (see lib/media/storage.ts in the
// roadmap). The endpoint is intentionally simple so the first version works
// without any cloud config.
// =============================================================================

import { prisma } from "@/lib/prisma";
import { requireWorkspace, withJsonErrors } from "@/lib/workspace";
import { logActivity } from "@/lib/activity";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const ACCEPTED = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
]);
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

export async function GET() {
  return withJsonErrors(async () => {
    const ws = await requireWorkspace();
    const rows = await prisma.cv.findMany({
      where: { teamId: ws.teamId },
      orderBy: { createdAt: "desc" },
      include: {
        contact: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });
    return {
      cvs: rows.map((c) => ({
        id: c.id,
        title: c.title,
        url: c.url,
        filename: c.filename,
        contentType: c.contentType,
        sizeBytes: c.sizeBytes,
        createdAt: c.createdAt.getTime(),
        contact: c.contact,
      })),
    };
  });
}

export async function POST(req: Request) {
  return withJsonErrors(async () => {
    const ws = await requireWorkspace();
    const form = await req.formData();
    const file = form.get("file");
    const title = (form.get("title") as string | null)?.trim();
    const contactId = (form.get("contactId") as string | null) || null;

    if (!(file instanceof File)) {
      const err: any = new Error("file is required (multipart/form-data)");
      err.status = 400;
      throw err;
    }
    if (file.size > MAX_BYTES) {
      const err: any = new Error(
        `File too large (${Math.round(file.size / 1024)} KB). Max 10 MB.`
      );
      err.status = 400;
      throw err;
    }
    if (file.type && !ACCEPTED.has(file.type)) {
      const err: any = new Error(
        `Unsupported file type: ${file.type}. Accepts PDF, DOC, DOCX, TXT.`
      );
      err.status = 400;
      throw err;
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const suffix = crypto.randomBytes(6).toString("base64url");
    const finalName = `${suffix}-${safeName}`;
    const dir = path.join(process.cwd(), "public", "uploads", "cvs");
    await mkdir(dir, { recursive: true });
    const dest = path.join(dir, finalName);
    const buf = Buffer.from(await file.arrayBuffer());
    await writeFile(dest, buf);
    const publicUrl = `/uploads/cvs/${finalName}`;

    const cv = await prisma.cv.create({
      data: {
        teamId: ws.teamId,
        contactId: contactId || null,
        uploadedById: ws.userId,
        title: title || file.name,
        url: publicUrl,
        storageKey: finalName,
        filename: file.name,
        contentType: file.type || null,
        sizeBytes: file.size,
      },
    });

    logActivity({
      teamId: ws.teamId,
      userId: ws.userId,
      action: "cv.uploaded",
      target: `cv:${cv.id}`,
      meta: { filename: file.name },
    });

    return { cv };
  });
}
