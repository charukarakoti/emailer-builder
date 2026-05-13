"use client";
// =============================================================================
// userTemplates.ts — team-scoped templates persisted in Postgres.
//
// Replaces the old localStorage implementation. The function names and the
// `UserTemplate` shape are kept identical so the calling components (TopBar,
// etc.) only have to switch from sync to async — the previous "create new
// entry, never overwrite" semantics is enforced server-side in
// /api/templates (POST) so the caller behavior is unchanged.
//
// For owner-only update/delete, the API returns 403 if the current user
// isn't the owner. We surface the error here so the UI can decide what to
// show (the existing TopBar code just notifies on success).
// =============================================================================
import type { EmailDocument } from "./types";

export interface UserTemplate {
  id: string;
  name: string;
  doc: EmailDocument;
  createdAt: number;
  /** Server-only: true if the current user owns this row. */
  isMine?: boolean;
  /** Server-only: owner identity for templates created by teammates. */
  owner?: { id: string; email: string; name: string | null };
}

async function jsonOrThrow(res: Response): Promise<any> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || `HTTP ${res.status}`);
  }
  return data;
}

/** List every template in the current user's active team. */
export async function loadUserTemplates(): Promise<UserTemplate[]> {
  try {
    const res = await fetch("/api/templates", { credentials: "same-origin" });
    if (!res.ok) return [];
    const { templates } = await res.json();
    if (!Array.isArray(templates)) return [];
    return templates as UserTemplate[];
  } catch {
    return [];
  }
}

/**
 * Always creates a NEW template entry. Name-collision handling (" (2)",
 * " (3)", …) is done on the server, in /api/templates POST.
 */
export async function saveUserTemplate(
  name: string,
  doc: EmailDocument
): Promise<UserTemplate> {
  const res = await fetch("/api/templates", {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ name, doc }),
  });
  const { template } = await jsonOrThrow(res);
  return template as UserTemplate;
}

/** Replace an existing template's name + doc. 403 if not the owner. */
export async function updateUserTemplate(
  id: string,
  name: string,
  doc: EmailDocument
): Promise<UserTemplate | null> {
  const res = await fetch(`/api/templates/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ name, doc }),
  });
  if (res.status === 404) return null;
  const { template } = await jsonOrThrow(res);
  return template as UserTemplate;
}

/** Delete a template. 403 if not the owner. */
export async function deleteUserTemplate(id: string): Promise<void> {
  const res = await fetch(`/api/templates/${encodeURIComponent(id)}`, {
    method: "DELETE",
    credentials: "same-origin",
  });
  await jsonOrThrow(res);
}
