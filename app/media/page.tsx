"use client";

// =============================================================================
// /media — workspace media library, redesigned to match the reference
// "Library"-style screen.
//
//   ┌───────────────┬────────────────────────────────────────┐
//   │ Header                                                 │
//   │   Title · Upload (primary)                             │
//   │   Tabs: Images & Documents · Videos · Canva           │
//   ├───────────────┬────────────────────────────────────────┤
//   │ Sidebar       │  Storage bar · Selection bar · View    │
//   │ - Search      │  ┌───────────────────────────────────┐ │
//   │ - All         │  │ Table — thumb · meta · date · size │ │
//   │ - Images      │  └───────────────────────────────────┘ │
//   │ - Documents   │  Show more                              │
//   │ - Recently …  │                                          │
//   │ - Folders     │                                          │
//   └───────────────┴────────────────────────────────────────┘
//
// The drag-and-drop uploader is still present but moved into a slim row at
// the top of the main pane so the table dominates the screen — the previous
// layout buried the list under a huge dropzone.
// =============================================================================

import { useEffect, useMemo, useRef, useState } from "react";
import AppShell, {
  Card,
  DangerButton,
  GhostButton,
  PrimaryButton,
  useConfirm,
} from "@/components/AppShell";

interface M {
  id: string;
  kind: string;
  url: string;
  filename: string;
  contentType: string | null;
  sizeBytes: number | null;
  width: number | null;
  height: number | null;
  createdAt: number | string;
}

type Category = "all" | "images" | "documents" | "recent";
type ViewMode = "list" | "grid";

function prettyBytes(b: number | null): string {
  if (!b && b !== 0) return "—";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 * 1024 * 1024)
    return `${(b / 1024 / 1024).toFixed(1)} MB`;
  return `${(b / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
function fmtDate(d: number | string) {
  const dt = new Date(d as any);
  return dt.toLocaleDateString(undefined, {
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
  });
}
function shortType(ct: string | null): string {
  if (!ct) return "—";
  const slash = ct.indexOf("/");
  return (slash >= 0 ? ct.slice(slash + 1) : ct).toUpperCase();
}

const QUOTA_BYTES = 25 * 1024 * 1024 * 1024; // 25 GB target — purely visual.

export default function MediaPage() {
  const confirm = useConfirm();
  const [items, setItems] = useState<M[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<Category>("all");
  const [view, setView] = useState<ViewMode>("list");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dragging, setDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [preview, setPreview] = useState<M | null>(null);
  const [showMore, setShowMore] = useState(50);
  const inputRef = useRef<HTMLInputElement>(null);

  async function refresh() {
    setLoading(true);
    try {
      const r = await fetch("/api/media");
      const data = await r.json();
      setItems((data.media || []) as M[]);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    refresh();
  }, []);

  async function upload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    setStatus(null);
    setUploadProgress({ done: 0, total: files.length });
    const list = Array.from(files);
    let ok = 0;
    for (let i = 0; i < list.length; i++) {
      const fd = new FormData();
      fd.append("file", list[i]);
      const r = await fetch("/api/media/upload", { method: "POST", body: fd });
      if (r.ok) ok++;
      else {
        const d = await r.json().catch(() => ({}));
        if (d?.errors?.[0]?.reason) setError(d.errors[0].reason);
      }
      setUploadProgress({ done: i + 1, total: list.length });
    }
    setUploadProgress(null);
    if (ok > 0) setStatus(`Uploaded ${ok} of ${list.length}`);
    await refresh();
  }

  async function deleteOne(m: M) {
    const ok = await confirm({
      title: `Delete "${m.filename}"?`,
      message:
        "The file is removed from your workspace immediately and any email or signature that still references its URL will show a broken image. This cannot be undone.",
      confirmLabel: "Delete file",
      danger: true,
    });
    if (!ok) return;
    const r = await fetch(`/api/media/${m.id}`, { method: "DELETE" });
    if (r.ok) {
      setStatus(`Deleted ${m.filename}.`);
      await refresh();
    } else {
      const d = await r.json().catch(() => ({}));
      setError(d.error || "Delete failed");
    }
  }
  async function deleteSelected() {
    if (selected.size === 0) return;
    const ok = await confirm({
      title: `Delete ${selected.size} item${selected.size === 1 ? "" : "s"}?`,
      message:
        "Selected files are removed from your workspace immediately. Any emails or signatures that still reference their URLs will show broken images.",
      confirmLabel: `Delete ${selected.size}`,
      danger: true,
    });
    if (!ok) return;
    for (const id of selected) {
      await fetch(`/api/media/${id}`, { method: "DELETE" });
    }
    setSelected(new Set());
    setStatus(`Deleted ${selected.size} item(s).`);
    await refresh();
  }
  function copyUrl(m: M) {
    const full = window.location.origin + m.url;
    navigator.clipboard.writeText(full).then(
      () => setStatus("URL copied to clipboard"),
      () => setError("Copy failed")
    );
  }
  function toggleSelect(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  /**
   * Backfill width/height once the browser has decoded the image. Called
   * by ListView / GridView via the `<img onLoad>` callback. We only fire
   * the PATCH if the row's dimensions are currently null, and the local
   * state is updated optimistically so the Size column shows the result
   * without waiting for a refetch.
   */
  function rememberDimensions(id: string, w: number, h: number) {
    setItems((prev) =>
      prev.map((m) =>
        m.id === id && (!m.width || !m.height)
          ? { ...m, width: w, height: h }
          : m
      )
    );
    const target = items.find((m) => m.id === id);
    if (target && (!target.width || !target.height)) {
      fetch(`/api/media/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ width: w, height: h }),
      }).catch(() => {
        /* dimensions are best-effort — silently ignore */
      });
    }
  }

  // ------------------------------------------------------------------
  //  Derived data
  // ------------------------------------------------------------------
  const counts = useMemo(() => {
    const isImage = (m: M) =>
      m.kind === "image" || /^image\//.test(m.contentType || "");
    const isDoc = (m: M) =>
      m.kind !== "image" && !/^image\//.test(m.contentType || "");
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return {
      all: items.length,
      images: items.filter(isImage).length,
      documents: items.filter(isDoc).length,
      recent: items.filter((m) => Number(new Date(m.createdAt as any)) > cutoff)
        .length,
    };
  }, [items]);

  const totalBytes = useMemo(
    () => items.reduce((s, m) => s + (m.sizeBytes || 0), 0),
    [items]
  );
  const pctFull = Math.min(100, Math.round((totalBytes / QUOTA_BYTES) * 100));

  const filtered = useMemo(() => {
    let list = items;
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    if (category === "images") {
      list = list.filter(
        (m) => m.kind === "image" || /^image\//.test(m.contentType || "")
      );
    } else if (category === "documents") {
      list = list.filter(
        (m) =>
          m.kind !== "image" && !/^image\//.test(m.contentType || "")
      );
    } else if (category === "recent") {
      list = list.filter(
        (m) => Number(new Date(m.createdAt as any)) > cutoff
      );
    }
    if (q.trim()) {
      const needle = q.toLowerCase();
      list = list.filter((m) =>
        m.filename.toLowerCase().includes(needle)
      );
    }
    return list;
  }, [items, q, category]);

  const visible = filtered.slice(0, showMore);
  const allVisibleSelected =
    visible.length > 0 && visible.every((m) => selected.has(m.id));

  // ------------------------------------------------------------------
  //  Render
  // ------------------------------------------------------------------

  return (
    <AppShell
      title="Library"
      actions={
        <PrimaryButton onClick={() => inputRef.current?.click()}>
          ＋ Upload
        </PrimaryButton>
      }
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/gif,image/svg+xml,image/webp"
        multiple
        className="hidden"
        onChange={(e) => upload(e.target.files)}
      />

      {/* Tabs */}
      <div className="border-b border-slate-200 mb-5">
        <div className="flex gap-6 text-sm">
          <button className="px-1 py-2 border-b-2 border-indigo-600 text-indigo-600 font-medium">
            Images & Documents
          </button>
          <button
            className="px-1 py-2 text-slate-400 cursor-not-allowed"
            title="Videos coming soon"
          >
            Videos
          </button>
          <button
            className="px-1 py-2 text-slate-400 cursor-not-allowed"
            title="Canva integration is part of a later phase"
          >
            Canva Designs
          </button>
        </div>
      </div>

      {/* Body — two panes */}
      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
        {/* ---------------------- Sidebar ---------------------- */}
        <aside className="space-y-4">
          <Card className="p-3">
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">
                🔍
              </span>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search filename…"
                className="w-full pl-7 pr-2 py-1.5 text-sm rounded-md border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </Card>

          <Card className="overflow-hidden">
            <CategoryItem
              icon="📁"
              label="All"
              count={counts.all}
              active={category === "all"}
              onClick={() => setCategory("all")}
            />
            <CategoryItem
              icon="🖼"
              label="Images"
              count={counts.images}
              active={category === "images"}
              onClick={() => setCategory("images")}
            />
            <CategoryItem
              icon="📄"
              label="Documents"
              count={counts.documents}
              active={category === "documents"}
              onClick={() => setCategory("documents")}
            />
            <CategoryItem
              icon="🕒"
              label="Recently added"
              count={counts.recent}
              active={category === "recent"}
              onClick={() => setCategory("recent")}
            />
          </Card>

          <Card className="overflow-hidden">
            <div className="px-3 py-2 flex items-center justify-between border-b border-slate-100">
              <div className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                Folders
              </div>
              <button
                title="Folders coming soon"
                className="h-6 w-6 inline-flex items-center justify-center rounded text-slate-400 hover:bg-slate-100"
              >
                ＋
              </button>
            </div>
            <div className="px-3 py-3 text-xs text-slate-500">
              Folders are part of a later phase. For now, use{" "}
              <em>Recently added</em> + search to keep this manageable.
            </div>
          </Card>
        </aside>

        {/* ---------------------- Main pane ---------------------- */}
        <section className="space-y-4">
          {/* Slim drag-drop strip */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              upload(e.dataTransfer.files);
            }}
            className={
              "rounded-xl border-2 border-dashed px-4 py-3 text-center text-sm transition " +
              (dragging
                ? "border-indigo-400 bg-indigo-50/60"
                : "border-slate-200 bg-white")
            }
          >
            <span className="mr-2">📥</span>
            Drop images here, or{" "}
            <button
              onClick={() => inputRef.current?.click()}
              className="text-indigo-600 hover:underline"
            >
              browse
            </button>
            <span className="text-slate-400 ml-2">
              · PNG, JPG, GIF, SVG, WEBP · up to 8 MB each
            </span>
            {uploadProgress && (
              <div className="mt-2 max-w-md mx-auto">
                <div className="h-1.5 rounded-full bg-slate-200 overflow-hidden">
                  <div
                    className="h-full bg-indigo-500 transition-all"
                    style={{
                      width: `${
                        (uploadProgress.done / uploadProgress.total) * 100
                      }%`,
                    }}
                  />
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  Uploading {uploadProgress.done} / {uploadProgress.total}…
                </div>
              </div>
            )}
          </div>

          {/* Storage strip */}
          <Card className="px-4 py-3">
            <div className="flex items-baseline gap-2 text-sm">
              <span className="font-semibold">{pctFull}% Full</span>
              <span className="text-slate-500">
                Using {prettyBytes(totalBytes)} of {prettyBytes(QUOTA_BYTES)}
              </span>
            </div>
            <div className="mt-2 h-1.5 rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-400 to-indigo-500 transition-all"
                style={{ width: `${pctFull}%` }}
              />
            </div>
          </Card>

          {/* Selection bar + view toggle */}
          {status && (
            <div className="text-sm bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg px-3 py-2">
              {status}
            </div>
          )}
          {error && (
            <div className="text-sm bg-rose-50 border border-rose-200 text-rose-700 rounded-lg px-3 py-2">
              {error}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-slate-700">
              <span className="font-medium">{selected.size}</span>{" "}
              <span className="text-slate-500">
                of {filtered.length} Selected
              </span>
            </span>
            <button
              disabled
              className="text-sm text-slate-400 inline-flex items-center gap-1 px-2 py-1"
              title="Folders coming soon"
            >
              📁 Add to folder ▾
            </button>
            <DangerButton
              onClick={deleteSelected}
              disabled={selected.size === 0}
            >
              Delete
            </DangerButton>
            <div className="ml-auto inline-flex rounded-md border border-slate-200 bg-white overflow-hidden">
              <button
                onClick={() => setView("list")}
                className={
                  "h-8 w-8 inline-flex items-center justify-center " +
                  (view === "list"
                    ? "bg-indigo-600 text-white"
                    : "text-slate-500 hover:bg-slate-50")
                }
                title="List view"
              >
                ≡
              </button>
              <button
                onClick={() => setView("grid")}
                className={
                  "h-8 w-8 inline-flex items-center justify-center " +
                  (view === "grid"
                    ? "bg-indigo-600 text-white"
                    : "text-slate-500 hover:bg-slate-50")
                }
                title="Grid view"
              >
                ▦
              </button>
            </div>
          </div>

          {/* Content */}
          {loading ? (
            <div className="text-sm text-slate-500 py-12 text-center">
              Loading…
            </div>
          ) : filtered.length === 0 ? (
            <Card className="p-10 text-center">
              <div className="text-3xl mb-2">🖼</div>
              <div className="text-sm font-semibold">
                {items.length === 0
                  ? "No media yet"
                  : "Nothing matches that filter"}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                {items.length === 0
                  ? "Drop a file above or click Upload to add your first image."
                  : "Try clearing the filter or search term."}
              </div>
            </Card>
          ) : view === "list" ? (
            <ListView
              items={visible}
              selected={selected}
              allChecked={allVisibleSelected}
              onToggle={toggleSelect}
              onToggleAll={() => {
                if (allVisibleSelected) {
                  const next = new Set(selected);
                  visible.forEach((m) => next.delete(m.id));
                  setSelected(next);
                } else {
                  const next = new Set(selected);
                  visible.forEach((m) => next.add(m.id));
                  setSelected(next);
                }
              }}
              onPreview={setPreview}
              onCopy={copyUrl}
              onDelete={deleteOne}
              onImageMeta={rememberDimensions}
            />
          ) : (
            <GridView
              items={visible}
              selected={selected}
              onToggle={toggleSelect}
              onPreview={setPreview}
              onCopy={copyUrl}
              onDelete={deleteOne}
              onImageMeta={rememberDimensions}
            />
          )}

          {filtered.length > visible.length && (
            <div className="text-center">
              <GhostButton onClick={() => setShowMore((n) => n + 50)}>
                Show more ({filtered.length - visible.length} left)
              </GhostButton>
            </div>
          )}
        </section>
      </div>

      {preview && (
        <PreviewModal
          m={preview}
          onClose={() => setPreview(null)}
          onCopy={() => copyUrl(preview)}
          onDelete={() => {
            deleteOne(preview);
            setPreview(null);
          }}
        />
      )}
    </AppShell>
  );
}

/* ------------------------------------------------------------------ */
/*  Sidebar category row                                              */
/* ------------------------------------------------------------------ */

function CategoryItem({
  icon,
  label,
  count,
  active,
  onClick,
}: {
  icon: string;
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={
        "w-full flex items-center gap-2.5 px-3 py-2 text-sm transition border-l-2 " +
        (active
          ? "border-indigo-600 bg-indigo-50 text-indigo-700 font-medium"
          : "border-transparent text-slate-700 hover:bg-slate-50")
      }
    >
      <span className="w-5 text-base text-slate-400">{icon}</span>
      <span className="flex-1 text-left">{label}</span>
      <span className="text-xs text-slate-500">{count}</span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  List view (table)                                                  */
/* ------------------------------------------------------------------ */

function ListView({
  items,
  selected,
  allChecked,
  onToggle,
  onToggleAll,
  onPreview,
  onCopy,
  onDelete,
  onImageMeta,
}: {
  items: M[];
  selected: Set<string>;
  allChecked: boolean;
  onToggle: (id: string) => void;
  onToggleAll: () => void;
  onPreview: (m: M) => void;
  onCopy: (m: M) => void;
  onDelete: (m: M) => void;
  onImageMeta: (id: string, w: number, h: number) => void;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 border-b border-slate-200">
              <th className="w-10 px-3 py-2">
                <input
                  type="checkbox"
                  checked={allChecked}
                  onChange={onToggleAll}
                />
              </th>
              <th className="w-20 px-3 py-2 font-medium">Thumbnail</th>
              <th className="px-3 py-2 font-medium">Basic info</th>
              <th className="px-3 py-2 font-medium">Date added</th>
              <th className="px-3 py-2 font-medium">Size</th>
              <th className="w-32 px-3 py-2 font-medium text-right">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((m) => (
              <tr
                key={m.id}
                className="border-b border-slate-100 hover:bg-slate-50"
              >
                <td className="px-3 py-2 align-top">
                  <input
                    type="checkbox"
                    checked={selected.has(m.id)}
                    onChange={() => onToggle(m.id)}
                  />
                </td>
                <td className="px-3 py-2">
                  <button
                    onClick={() => onPreview(m)}
                    className="block h-12 w-12 rounded overflow-hidden bg-slate-100 border border-slate-200"
                    title="Preview"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={m.url}
                      alt={m.filename}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      onLoad={(e) => {
                        // Capture intrinsic image size and persist it on
                        // the Media row so the Size column shows it.
                        const img = e.currentTarget;
                        if (img.naturalWidth && img.naturalHeight) {
                          onImageMeta(
                            m.id,
                            img.naturalWidth,
                            img.naturalHeight
                          );
                        }
                      }}
                    />
                  </button>
                </td>
                <td className="px-3 py-2">
                  <button
                    onClick={() => onPreview(m)}
                    className="font-medium text-indigo-600 hover:underline text-left"
                  >
                    {m.filename}
                  </button>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Type: {shortType(m.contentType)}
                  </div>
                  {m.width && m.height && (
                    <div className="text-xs text-slate-500">
                      Dimensions: {m.width} × {m.height} px
                    </div>
                  )}
                  <div className="text-xs text-slate-500">
                    Source: Upload
                  </div>
                </td>
                <td className="px-3 py-2 text-slate-700">
                  {fmtDate(m.createdAt)}
                </td>
                <td className="px-3 py-2 text-slate-700">
                  {m.width && m.height ? (
                    <>
                      <div>
                        {m.width} × {m.height}
                      </div>
                      <div className="text-xs text-slate-500">
                        {prettyBytes(m.sizeBytes)}
                      </div>
                    </>
                  ) : (
                    prettyBytes(m.sizeBytes)
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  <div className="inline-flex items-center gap-1.5">
                    <button
                      onClick={() => onPreview(m)}
                      title="Preview"
                      className="h-7 w-7 inline-flex items-center justify-center rounded hover:bg-slate-100 text-slate-500"
                    >
                      ⓘ
                    </button>
                    <button
                      onClick={() => onCopy(m)}
                      title="Copy URL"
                      className="h-7 w-7 inline-flex items-center justify-center rounded hover:bg-slate-100 text-slate-500"
                    >
                      🔗
                    </button>
                    <button
                      onClick={() => onDelete(m)}
                      title="Delete"
                      className="h-7 w-7 inline-flex items-center justify-center rounded hover:bg-rose-50 text-rose-500"
                    >
                      🗑
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Grid view (compact tiles)                                          */
/* ------------------------------------------------------------------ */

function GridView({
  items,
  selected,
  onToggle,
  onPreview,
  onCopy,
  onDelete,
  onImageMeta,
}: {
  items: M[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onPreview: (m: M) => void;
  onCopy: (m: M) => void;
  onDelete: (m: M) => void;
  onImageMeta: (id: string, w: number, h: number) => void;
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
      {items.map((m) => {
        const sel = selected.has(m.id);
        return (
          <div
            key={m.id}
            className={
              "group relative aspect-square rounded-lg overflow-hidden bg-slate-100 border transition " +
              (sel
                ? "border-indigo-500 ring-2 ring-indigo-500/30"
                : "border-slate-200 hover:shadow-md")
            }
          >
            <button
              onClick={() => onPreview(m)}
              className="absolute inset-0"
              aria-label="Preview"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={m.url}
                alt={m.filename}
                className="w-full h-full object-cover"
                loading="lazy"
                onLoad={(e) => {
                  const img = e.currentTarget;
                  if (img.naturalWidth && img.naturalHeight) {
                    onImageMeta(m.id, img.naturalWidth, img.naturalHeight);
                  }
                }}
              />
            </button>
            <input
              type="checkbox"
              checked={sel}
              onChange={() => onToggle(m.id)}
              className="absolute top-1.5 left-1.5"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent opacity-0 group-hover:opacity-100 transition flex flex-col justify-end p-2">
              <div className="text-[11px] text-white truncate">
                {m.filename}
              </div>
              <div className="mt-1 flex items-center gap-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onCopy(m);
                  }}
                  className="flex-1 h-7 px-2 text-[11px] bg-white/90 hover:bg-white rounded transition"
                >
                  Copy URL
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(m);
                  }}
                  className="h-7 w-7 inline-flex items-center justify-center text-[11px] bg-white/90 hover:bg-rose-50 text-rose-600 rounded transition"
                >
                  ✕
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Preview modal                                                      */
/* ------------------------------------------------------------------ */

function PreviewModal({
  m,
  onClose,
  onCopy,
  onDelete,
}: {
  m: M;
  onClose: () => void;
  onCopy: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center px-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
          <div className="min-w-0">
            <div className="font-semibold truncate">{m.filename}</div>
            <div className="text-xs text-slate-500">
              {shortType(m.contentType)} · {prettyBytes(m.sizeBytes)}
              {m.width && m.height && ` · ${m.width} × ${m.height} px`}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <GhostButton onClick={onCopy}>Copy URL</GhostButton>
            <DangerButton onClick={onDelete}>Delete</DangerButton>
            <button
              onClick={onClose}
              className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-100"
            >
              ✕
            </button>
          </div>
        </div>
        <div className="p-6 bg-slate-100 flex items-center justify-center max-h-[70vh] overflow-auto">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={m.url}
            alt={m.filename}
            className="max-w-full max-h-[60vh] rounded bg-white shadow"
          />
        </div>
      </div>
    </div>
  );
}
