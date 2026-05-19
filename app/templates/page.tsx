"use client";

// =============================================================================
// /templates — Benchmark-style template gallery (v3).
//
// Visual fixes in this revision:
//   • Dropped the duplicate "Recent" section — the main grid is already
//     sorted by most-recent, so the duplicate was confusing.
//   • Thumbnail iframe now uses email-canvas dimensions (600px wide) clipped
//     by the card with `overflow:hidden`, so a short email no longer shows
//     huge empty whitespace at the bottom of the thumbnail.
//   • Filter chips moved to the top of the page next to the page title for
//     stronger hierarchy.
//   • Cards have a fixed aspect (3:4) for visual uniformity, tighter type,
//     and a single primary action ("Use") with a small overflow menu for
//     Preview / Delete to declutter the footer.
// =============================================================================

import { useEffect, useMemo, useRef, useState } from "react";
import AppShell, {
  Card,
  GhostButton,
  PrimaryButton,
} from "@/components/AppShell";
import NewTemplateModal from "@/components/NewTemplateModal";

interface T {
  id: string;
  name: string;
  kind: "doc" | "html";
  createdAt: number;
  updatedAt: number;
  owner: { id: string; email: string; name: string | null };
  isMine: boolean;
}

type Filter = "all" | "visual" | "html" | "mine";

export default function TemplatesGallery() {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [chooserOpen, setChooserOpen] = useState(false);
  const [preview, setPreview] = useState<T | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    try {
      const r = await fetch("/api/templates");
      const data = await r.json();
      setItems((data.templates || []) as T[]);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    refresh();
  }, []);

  const filtered = useMemo(() => {
    let list = items;
    if (filter === "visual") list = list.filter((t) => t.kind !== "html");
    if (filter === "html") list = list.filter((t) => t.kind === "html");
    if (filter === "mine") list = list.filter((t) => t.isMine);
    if (q) {
      const needle = q.toLowerCase();
      list = list.filter((t) => t.name.toLowerCase().includes(needle));
    }
    return list;
  }, [items, filter, q]);

  async function openPreview(t: T) {
    setPreview(t);
    setPreviewHtml(null);
    try {
      const r = await fetch(`/api/templates/${t.id}/render`);
      if (r.ok) {
        const data = await r.json();
        setPreviewHtml(data.html || "");
      } else {
        setPreviewHtml("<p>Preview unavailable.</p>");
      }
    } catch {
      setPreviewHtml("<p>Preview unavailable.</p>");
    }
  }

  async function deleteTemplate(t: T) {
    if (!confirm(`Delete template "${t.name}"? This can't be undone.`)) return;
    const r = await fetch(`/api/templates/${t.id}`, { method: "DELETE" });
    if (r.ok) {
      setStatus(`Deleted "${t.name}".`);
      await refresh();
    } else {
      const data = await r.json().catch(() => ({}));
      setStatus(data.error || "Delete failed");
    }
  }

  const counts = {
    all: items.length,
    visual: items.filter((t) => t.kind !== "html").length,
    html: items.filter((t) => t.kind === "html").length,
    mine: items.filter((t) => t.isMine).length,
  };

  return (
    <AppShell
      title="Templates"
      actions={
        <PrimaryButton onClick={() => setChooserOpen(true)}>
          ＋ New template
        </PrimaryButton>
      }
    >
      <NewTemplateModal
        open={chooserOpen}
        onClose={() => setChooserOpen(false)}
      />

      {status && (
        <div className="mb-4 text-sm bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg px-3 py-2">
          {status}
        </div>
      )}

      {/* Toolbar — filter chips + search + count, all inline. */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="inline-flex rounded-lg border border-slate-200 bg-white overflow-hidden">
          {(
            [
              ["all", "All", counts.all],
              ["visual", "Visual", counts.visual],
              ["html", "HTML", counts.html],
              ["mine", "Yours", counts.mine],
            ] as const
          ).map(([k, label, n]) => (
            <button
              key={k}
              onClick={() => setFilter(k as Filter)}
              className={
                "px-3.5 py-2 text-sm transition border-r border-slate-200 last:border-r-0 " +
                (filter === k
                  ? "bg-indigo-600 text-white"
                  : "text-slate-600 hover:bg-slate-50")
              }
            >
              {label}
              <span
                className={
                  "text-xs ml-1.5 " +
                  (filter === k ? "text-white/80" : "text-slate-400")
                }
              >
                {n}
              </span>
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
            🔍
          </span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search templates…"
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div className="ml-auto text-xs text-slate-500">
          {filtered.length} of {items.length}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <Card key={i} className="overflow-hidden">
              <div className="aspect-[3/4] bg-slate-100 animate-pulse" />
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <CreateEmptyState
          hasAny={items.length > 0}
          onCreate={() => setChooserOpen(true)}
        />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filtered.map((t) => (
            <TemplateCard
              key={t.id}
              t={t}
              onPreview={() => openPreview(t)}
              onDelete={() => deleteTemplate(t)}
            />
          ))}
        </div>
      )}

      {preview && (
        <PreviewModal
          template={preview}
          html={previewHtml}
          onClose={() => {
            setPreview(null);
            setPreviewHtml(null);
          }}
        />
      )}
    </AppShell>
  );
}

/* ------------------------------------------------------------------ */
/*  Template card                                                      */
/* ------------------------------------------------------------------ */

function TemplateCard({
  t,
  onPreview,
  onDelete,
}: {
  t: T;
  onPreview: () => void;
  onDelete: () => void;
}) {
  const [menu, setMenu] = useState(false);
  const ownerInitial = (t.owner?.name || t.owner?.email || "?")
    .charAt(0)
    .toUpperCase();
  const useHref =
    t.kind === "html"
      ? `/html-editor?template=${encodeURIComponent(t.id)}`
      : `/?template=${encodeURIComponent(t.id)}`;

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(false);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [menu]);

  return (
    <Card className="overflow-hidden group hover:shadow-md hover:-translate-y-0.5 transition flex flex-col">
      {/* Thumbnail — fixed 3:4 portrait for visual uniformity. */}
      <button
        onClick={onPreview}
        className="relative block w-full aspect-[3/4] bg-white overflow-hidden border-b border-slate-100"
        title="Open preview"
      >
        <Thumbnail templateId={t.id} kind={t.kind} />
        {/* Hover overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/0 to-transparent opacity-0 group-hover:opacity-100 transition flex items-end p-2">
          <span className="inline-flex items-center gap-1 text-[11px] text-white bg-black/45 backdrop-blur-sm px-2 py-1 rounded">
            🔍 Preview
          </span>
        </div>
        {/* Kind chip — top-left */}
        <span
          className={
            "absolute top-2 left-2 text-[10px] font-semibold tracking-wider uppercase px-1.5 py-0.5 rounded shadow-sm " +
            (t.kind === "html"
              ? "bg-slate-900 text-white"
              : "bg-indigo-600 text-white")
          }
        >
          {t.kind === "html" ? "HTML" : "Visual"}
        </span>
      </button>

      {/* Footer — name + small action row. */}
      <div className="p-3 flex flex-col">
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm truncate">{t.name}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              {t.isMine ? "Yours" : t.owner?.email} ·{" "}
              {new Date(t.updatedAt).toLocaleDateString()}
            </div>
          </div>
          <div className="h-6 w-6 rounded-full bg-slate-100 text-slate-600 text-[10px] font-medium flex items-center justify-center">
            {ownerInitial}
          </div>
        </div>
        <div className="mt-2.5 flex items-center gap-1.5">
          <a
            href={useHref}
            className="flex-1 text-center text-sm px-3 py-1.5 rounded-md bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition"
          >
            Use
          </a>
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setMenu((v) => !v);
              }}
              className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
              title="More"
            >
              ⋯
            </button>
            {menu && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute right-0 mt-1 w-40 bg-white border border-slate-200 rounded-lg shadow-lg z-30 py-1 text-sm"
              >
                <button
                  onClick={() => {
                    setMenu(false);
                    onPreview();
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-slate-50"
                >
                  Preview
                </button>
                <a
                  href={useHref}
                  className="block w-full text-left px-3 py-1.5 hover:bg-slate-50"
                >
                  Open in editor
                </a>
                {t.isMine && (
                  <>
                    <div className="h-px bg-slate-100 my-1" />
                    <button
                      onClick={() => {
                        setMenu(false);
                        onDelete();
                      }}
                      className="w-full text-left px-3 py-1.5 text-rose-600 hover:bg-rose-50"
                    >
                      Delete
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

/**
 * Lazy-loaded iframe thumbnail. The iframe is rendered at the canonical
 * email width (600px) so the layout matches what subscribers see, then
 * scaled with CSS transform to fit the card. We use overflow:hidden on the
 * parent so anything past the card area is cropped rather than scrollable.
 */
function Thumbnail({
  templateId,
  kind,
}: {
  templateId: string;
  kind: "doc" | "html";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [html, setHtml] = useState<string | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    if (!ref.current || typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setInView(true);
            obs.disconnect();
          }
        }
      },
      { rootMargin: "200px" }
    );
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!inView) return;
    let cancelled = false;
    fetch(`/api/templates/${templateId}/render`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled) setHtml(d?.html || "");
      })
      .catch(() => {
        if (!cancelled) setHtml("");
      });
    return () => {
      cancelled = true;
    };
  }, [inView, templateId]);

  return (
    <div ref={ref} className="absolute inset-0 bg-slate-50">
      {html ? (
        <iframe
          title="thumbnail"
          srcDoc={html}
          sandbox=""
          // 600px is the standard email canvas. We anchor at top-left and let
          // the parent crop the bottom so a tall email shows its first
          // viewport and a short one fills the card cleanly.
          style={{
            width: "600px",
            height: "800px",
            transform: "scale(0.5)",
            transformOrigin: "top left",
            border: "0",
            pointerEvents: "none",
          }}
          className="bg-white"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-3xl text-slate-300">
          {kind === "html" ? "</>" : "✉"}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Preview modal                                                      */
/* ------------------------------------------------------------------ */

function PreviewModal({
  template,
  html,
  onClose,
}: {
  template: T;
  html: string | null;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-3xl max-h-[90vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
          <div className="min-w-0">
            <div className="font-semibold text-base truncate">
              {template.name}
            </div>
            <div className="text-xs text-slate-500">
              Preview ·{" "}
              {template.isMine ? "Yours" : template.owner?.email}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={
                template.kind === "html"
                  ? `/html-editor?template=${encodeURIComponent(template.id)}`
                  : `/?template=${encodeURIComponent(template.id)}`
              }
              className="h-9 inline-flex items-center px-3 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition"
            >
              Use this template
            </a>
            <button
              onClick={onClose}
              className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-100"
            >
              ✕
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-auto bg-slate-100 p-4">
          {html === null ? (
            <div className="text-center text-sm text-slate-500 py-12">
              Loading preview…
            </div>
          ) : (
            <iframe
              title={`Preview of ${template.name}`}
              srcDoc={html}
              sandbox=""
              className="w-full h-[70vh] bg-white rounded-lg shadow"
            />
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Empty state                                                        */
/* ------------------------------------------------------------------ */

function CreateEmptyState({
  hasAny,
  onCreate,
}: {
  hasAny: boolean;
  onCreate: () => void;
}) {
  if (hasAny) {
    return (
      <Card className="p-10 text-center">
        <div className="text-2xl mb-2">🔍</div>
        <div className="text-sm font-semibold">No matches</div>
        <div className="text-sm text-slate-500 mt-1">
          Try clearing filters or using a different keyword.
        </div>
      </Card>
    );
  }
  return (
    <Card className="p-10 text-center bg-gradient-to-br from-white via-slate-50 to-indigo-50/30 border-dashed">
      <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 text-white text-xl mb-4 shadow-sm">
        ✉
      </div>
      <h2 className="text-lg font-semibold">Create your first template</h2>
      <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
        Start visually with the drag-and-drop builder, or paste your own HTML
        into the source editor. Either way, the saved template shows up here
        for everyone in your workspace to reuse.
      </p>
      <div className="mt-5 flex items-center justify-center gap-2">
        <PrimaryButton onClick={onCreate}>＋ New template</PrimaryButton>
        <GhostButton onClick={() => (window.location.href = "/html-editor")}>
          Or paste HTML
        </GhostButton>
      </div>
    </Card>
  );
}
