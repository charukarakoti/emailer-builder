"use client";
// =============================================================================
// userTemplates.ts — user-saved templates persisted in localStorage.
//
// IMPORTANT: saveUserTemplate now ALWAYS creates a new entry. If the name
// collides with an existing template, we append " (2)", " (3)", etc. so the
// previous version is never silently overwritten — that was the bug behind
// "I made a new template but the old one shows up".
//
// If the caller actually wants to update an existing entry by id, use
// updateUserTemplate(id, name, doc) instead.
// =============================================================================
import type { EmailDocument } from "./types";

const KEY = "email-builder:user-templates:v3";

export interface UserTemplate {
  id: string;
  name: string;
  doc: EmailDocument;
  createdAt: number;
}

export function loadUserTemplates(): UserTemplate[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (t) => t && typeof t.name === "string" && t.doc?.sections
    );
  } catch {
    return [];
  }
}

function persist(list: UserTemplate[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* quota — ignore */
  }
}

/**
 * Resolve a unique display name. If "Welcome" already exists, returns
 * "Welcome (2)"; if that exists too, "Welcome (3)"; etc.
 */
function uniqueName(desired: string, list: UserTemplate[]): string {
  const taken = new Set(list.map((t) => t.name));
  if (!taken.has(desired)) return desired;
  let n = 2;
  while (taken.has(`${desired} (${n})`)) n++;
  return `${desired} (${n})`;
}

function newId(): string {
  return `ut_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 6)}`;
}

/**
 * Always creates a NEW template entry. The saved doc is a deep clone, so
 * subsequent edits to the live canvas don't mutate the saved copy.
 */
export function saveUserTemplate(name: string, doc: EmailDocument): UserTemplate {
  const list = loadUserTemplates();
  const finalName = uniqueName(name.trim() || "Untitled template", list);
  const t: UserTemplate = {
    id: newId(),
    name: finalName,
    doc: clone(doc),
    createdAt: Date.now(),
  };
  persist([...list, t]);
  return t;
}

/**
 * Replace an existing template's name + doc. Used when the user explicitly
 * picks "Update <name>" rather than "Save as new".
 */
export function updateUserTemplate(
  id: string,
  name: string,
  doc: EmailDocument
): UserTemplate | null {
  const list = loadUserTemplates();
  const existing = list.find((t) => t.id === id);
  if (!existing) return null;
  const updated: UserTemplate = {
    ...existing,
    name: name.trim() || existing.name,
    doc: clone(doc),
    createdAt: Date.now(),
  };
  persist(list.map((t) => (t.id === id ? updated : t)));
  return updated;
}

export function deleteUserTemplate(id: string) {
  persist(loadUserTemplates().filter((t) => t.id !== id));
}

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}
