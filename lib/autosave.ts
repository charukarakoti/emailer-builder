"use client";
import { useEffect, useRef } from "react";
import { EmailDocument } from "./types";

// =============================================================================
// v3.1 — persists doc + history + future so undo/redo survives reloads.
// History is capped to MAX_HISTORY entries to keep localStorage usage in
// bounds (each EmailDocument is several KB and the 5MB browser cap is real).
// =============================================================================

const STATE_KEY = "email-builder:state:v3";
const META_KEY = "email-builder:savedAt:v3";
const MAX_HISTORY = 50;

export interface PersistedState {
  doc: EmailDocument;
  history: EmailDocument[];
  future: EmailDocument[];
}

export function loadState(): PersistedState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.doc?.sections) return null; // v2 data shape — drop it
    return {
      doc: parsed.doc,
      history: Array.isArray(parsed.history) ? parsed.history : [],
      future: Array.isArray(parsed.future) ? parsed.future : [],
    };
  } catch {
    return null;
  }
}

/** Back-compat helper for callers that only want the doc. */
export function loadSaved(): EmailDocument | null {
  return loadState()?.doc ?? null;
}

export function loadSavedAt(): number | null {
  if (typeof window === "undefined") return null;
  const v = localStorage.getItem(META_KEY);
  return v ? Number(v) : null;
}

/**
 * Auto-save the full builder state every `intervalMs` (default 4s) ONLY
 * when any of (doc, history, future) has changed since last save.
 */
export function useAutoSave(
  doc: EmailDocument,
  history: EmailDocument[],
  future: EmailDocument[],
  intervalMs = 4000
) {
  const last = useRef<{
    doc: EmailDocument | null;
    history: EmailDocument[] | null;
    future: EmailDocument[] | null;
  }>({ doc: null, history: null, future: null });

  useEffect(() => {
    const persist = () => {
      try {
        const payload: PersistedState = {
          doc,
          history: history.slice(-MAX_HISTORY),
          future: future.slice(0, MAX_HISTORY),
        };
        localStorage.setItem(STATE_KEY, JSON.stringify(payload));
        localStorage.setItem(META_KEY, String(Date.now()));
        last.current = { doc, history, future };
      } catch {
        // quota / privacy mode — fail silently
      }
    };

    const t = setInterval(() => {
      if (
        doc !== last.current.doc ||
        history !== last.current.history ||
        future !== last.current.future
      ) {
        persist();
      }
    }, intervalMs);

    window.addEventListener("beforeunload", persist);
    return () => {
      clearInterval(t);
      window.removeEventListener("beforeunload", persist);
    };
  }, [doc, history, future, intervalMs]);
}

export function clearSaved() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STATE_KEY);
  localStorage.removeItem(META_KEY);
}
