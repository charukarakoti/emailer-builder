"use client";

// =============================================================================
// /signatures/[id] — drag-and-drop signature builder.
//
//   ┌──────────┬──────────────────────────┬──────────────┐
//   │ Palette  │  Canvas (sortable rows)  │  Properties  │
//   │ (drag)   │  + live preview underneath│ (selected)   │
//   └──────────┴──────────────────────────┴──────────────┘
//
//   Top bar: rename · Save · Copy HTML · Download .html
//   Footer: size warnings (min/max width, byte count vs Gmail limits)
//
// Drag UX:
//   • Palette items use useDraggable; dropping onto the canvas appends
//     a new block of that type (with sensible defaults).
//   • Canvas rows use useSortable so they can be reordered by drag.
//   • Each block has a hover "delete" affordance and clicks select it for
//     editing in the right-hand properties panel.
//
// Outlook compatibility comes from lib/signatureHtml.ts — every row is a
// <tr> inside one outer table; no flex, no grid, no shorthand fonts.
// =============================================================================

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  arrayMove,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import AppShell, {
  Card,
  GhostButton,
  PrimaryButton,
} from "@/components/AppShell";
import {
  type SignatureBlock,
  type SignatureLeafBlock,
  type SignatureRowBlock,
  type SignatureColumn,
  type SignatureDoc,
  type SignatureTheme,
  SIGNATURE_LIMITS,
  DEFAULT_THEME,
  AVAILABLE_FONTS,
  renderSignatureHtml,
  renderSignatureDocument,
} from "@/lib/signatureHtml";

// ---------------------------------------------------------------------------
// Block factory — used when palette tiles are dropped onto the canvas.
// ---------------------------------------------------------------------------

function rid() {
  return `b_${Math.random().toString(36).slice(2, 8)}`;
}

// Palette keys for the row-with-N-columns shortcut.
type PaletteKey = SignatureBlock["type"] | "row-2" | "row-3";

function newLeafBlock(type: SignatureLeafBlock["type"]): SignatureLeafBlock {
  switch (type) {
    case "avatar":
      return {
        id: rid(),
        type,
        url: "https://via.placeholder.com/96.png",
        size: 72,
        shape: "circle",
      };
    case "name":
      return { id: rid(), type, text: "Your Name", bold: true, size: 16 };
    case "title":
      return { id: rid(), type, text: "Your title" };
    case "company":
      return { id: rid(), type, text: "Your Company" };
    case "contact":
      return {
        id: rid(),
        type,
        items: [
          { kind: "email", value: "you@example.com" },
          { kind: "phone", value: "+1 555 010 0000" },
        ],
      };
    case "social":
      return {
        id: rid(),
        type,
        networks: [
          { kind: "linkedin", url: "https://linkedin.com/in/" },
          { kind: "twitter", url: "https://twitter.com/" },
        ],
      };
    case "banner":
      return {
        id: rid(),
        type,
        url: "https://via.placeholder.com/520x80.png",
        link: "",
        alt: "Banner",
      };
    case "divider":
      return { id: rid(), type, color: "#e2e8f0", thickness: 1 };
    case "spacer":
      return { id: rid(), type, height: 8 };
    case "custom":
      return {
        id: rid(),
        type,
        html: "<span>Custom HTML — edit on the right</span>",
      };
  }
}

function newRowBlock(columnCount: number): SignatureRowBlock {
  const w = 100 / columnCount;
  const columns: SignatureColumn[] = Array.from(
    { length: columnCount },
    () => ({ width: w, blocks: [] })
  );
  return {
    id: rid(),
    type: "row",
    columns,
    gutter: 12,
    verticalAlign: "top",
  };
}

/** Create a block (leaf or row) from a palette key. */
function newBlock(key: PaletteKey): SignatureBlock {
  if (key === "row-2") return newRowBlock(2);
  if (key === "row-3") return newRowBlock(3);
  return newLeafBlock(key as SignatureLeafBlock["type"]);
}

const PALETTE: { type: PaletteKey; label: string; icon: string }[] = [
  { type: "row-2", label: "Row · 2 cols", icon: "▌▐" },
  { type: "row-3", label: "Row · 3 cols", icon: "▌▌▌" },
  { type: "avatar", label: "Avatar", icon: "👤" },
  { type: "name", label: "Name", icon: "🅰" },
  { type: "title", label: "Title", icon: "T" },
  { type: "company", label: "Company", icon: "🏢" },
  { type: "contact", label: "Contact row", icon: "☎" },
  { type: "social", label: "Social row", icon: "🔗" },
  { type: "banner", label: "Banner image", icon: "🖼" },
  { type: "divider", label: "Divider", icon: "—" },
  { type: "spacer", label: "Spacer", icon: "↕" },
  { type: "custom", label: "Custom HTML", icon: "</>" },
];

// ---------------------------------------------------------------------------
// Main editor
// ---------------------------------------------------------------------------

export default function SignatureEditor() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();

  const [doc, setDoc] = useState<SignatureDoc | null>(null);
  const [name, setName] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragging, setDragging] = useState<{ source: "palette" | "canvas"; key: string } | null>(
    null
  );
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  );

  // Load
  useEffect(() => {
    if (!id) return;
    fetch(`/api/signatures/${id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data?.signature) {
          setDoc(data.signature.doc as SignatureDoc);
          setName(data.signature.name);
        } else {
          setError(data?.error || "Signature not found");
        }
      })
      .catch((e) => setError(e?.message || "Load failed"));
  }, [id]);

  // Memoised renders. These hooks MUST run on every render (React's rules
  // of hooks), even before `doc` has loaded — otherwise the hook count
  // changes between the loading and loaded states and React throws
  // "Rendered more hooks than during the previous render." We short-circuit
  // with empty strings while doc is null.
  const renderedHtml = useMemo(
    () => (doc ? renderSignatureDocument(doc) : ""),
    [doc]
  );
  const byteSize = useMemo(
    () => (doc ? new Blob([renderSignatureHtml(doc)]).size : 0),
    [doc]
  );

  if (error && !doc) {
    return (
      <AppShell title="Signature">
        <div className="text-sm bg-rose-50 border border-rose-200 text-rose-700 rounded-lg px-3 py-2">
          {error}
        </div>
      </AppShell>
    );
  }
  if (!doc) {
    return (
      <AppShell title="Signature">
        <div className="text-sm text-slate-500">Loading…</div>
      </AppShell>
    );
  }

  // ----- mutators -----
  // Recursive patch — applies the patch to the matching block whether it
  // lives at the root or inside a Row column.
  function patchBlock(blockId: string, patch: Partial<SignatureBlock>) {
    setDoc((d) => {
      if (!d) return d;
      const apply = (b: SignatureBlock): SignatureBlock => {
        if (b.id === blockId) return { ...b, ...patch } as SignatureBlock;
        if (b.type === "row") {
          return {
            ...b,
            columns: b.columns.map((c) => ({
              ...c,
              blocks: c.blocks.map((cb) =>
                cb.id === blockId
                  ? ({ ...cb, ...patch } as SignatureLeafBlock)
                  : cb
              ),
            })),
          };
        }
        return b;
      };
      return { ...d, blocks: d.blocks.map(apply) };
    });
  }

  // Recursive delete — removes the block whether it lives at the root or
  // inside a Row column.
  function deleteBlock(blockId: string) {
    setDoc((d) => {
      if (!d) return d;
      const blocks = d.blocks
        .filter((b) => b.id !== blockId)
        .map((b) =>
          b.type === "row"
            ? {
                ...b,
                columns: b.columns.map((c) => ({
                  ...c,
                  blocks: c.blocks.filter((cb) => cb.id !== blockId),
                })),
              }
            : b
        );
      return { ...d, blocks };
    });
    if (selectedId === blockId) setSelectedId(null);
  }
  function patchTheme(patch: Partial<SignatureTheme>) {
    setDoc((d) => (d ? { ...d, theme: { ...d.theme, ...patch } } : d));
  }

  // ----- DnD -----
  function onDragStart(e: DragStartEvent) {
    const data = e.active.data.current as any;
    if (data?.source === "palette") {
      setDragging({ source: "palette", key: data.blockType });
    } else if (data?.source === "canvas") {
      setDragging({ source: "canvas", key: data.blockId });
    }
  }
  function onDragEnd(e: DragEndEvent) {
    setDragging(null);
    const { active, over } = e;
    if (!over) return;
    const aData = active.data.current as any;
    const oData = over.data.current as any;

    // Palette → drop somewhere on the canvas.
    if (aData?.source === "palette") {
      const block = newBlock(aData.blockType as PaletteKey);

      // Drop into a specific row column.
      if (oData?.type === "row-col") {
        // Rows themselves aren't allowed inside columns — keep markup
        // shallow. If the user dropped a Row into a Row column, fall back
        // to a root-level append.
        if (block.type === "row") {
          setDoc((d) =>
            d ? { ...d, blocks: [...d.blocks, block] } : d
          );
          setSelectedId(block.id);
          return;
        }
        const { rowId, colIndex } = oData as {
          type: "row-col";
          rowId: string;
          colIndex: number;
        };
        setDoc((d) => {
          if (!d) return d;
          return {
            ...d,
            blocks: d.blocks.map((b) =>
              b.id === rowId && b.type === "row"
                ? {
                    ...b,
                    columns: b.columns.map((c, i) =>
                      i === colIndex
                        ? { ...c, blocks: [...c.blocks, block as SignatureLeafBlock] }
                        : c
                    ),
                  }
                : b
            ),
          };
        });
        setSelectedId(block.id);
        return;
      }

      // Drop on or near a top-level block (insert before it) or onto root.
      setDoc((d) => {
        if (!d) return d;
        let next = [...d.blocks];
        if (oData?.type === "block") {
          const i = next.findIndex((b) => b.id === oData.blockId);
          if (i >= 0) {
            next.splice(i, 0, block);
            return { ...d, blocks: next };
          }
        }
        next.push(block);
        return { ...d, blocks: next };
      });
      setSelectedId(block.id);
      return;
    }

    // Canvas re-order.
    if (aData?.source === "canvas" && oData?.type === "block") {
      if (active.id === over.id) return;
      setDoc((d) => {
        if (!d) return d;
        const from = d.blocks.findIndex((b) => b.id === aData.blockId);
        const to = d.blocks.findIndex((b) => b.id === oData.blockId);
        if (from < 0 || to < 0) return d;
        return { ...d, blocks: arrayMove(d.blocks, from, to) };
      });
    }
  }

  // ----- save / copy / download -----
  async function save() {
    setSaving(true);
    setError(null);
    setStatus(null);
    const r = await fetch(`/api/signatures/${id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, doc }),
    });
    const data = await r.json();
    setSaving(false);
    if (!r.ok) {
      setError(data?.error || "Save failed");
      return;
    }
    setStatus("Saved.");
  }

  async function copy() {
    if (!doc) return;
    await navigator.clipboard.writeText(renderSignatureHtml(doc));
    setStatus("HTML copied to clipboard. Paste into Gmail → Settings → Signature.");
  }
  function download() {
    if (!doc) return;
    const html = renderSignatureDocument(doc);
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(name || "signature").replace(/\s+/g, "-")}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // `doc` is guaranteed non-null here — the early returns above bail when
  // it's still loading. `renderedHtml` and `byteSize` are computed by the
  // hooks above (which are called unconditionally).
  function findBlock(id: string | null): SignatureBlock | null {
    if (!id) return null;
    for (const b of doc.blocks) {
      if (b.id === id) return b;
      if (b.type === "row") {
        const nested = b.columns
          .flatMap((c) => c.blocks)
          .find((cb) => cb.id === id);
        if (nested) return nested;
      }
    }
    return null;
  }

  const selected = findBlock(selectedId);
  const sizeBad = byteSize > SIGNATURE_LIMITS.maxHtmlBytes;
  const widthBad =
    doc.theme.maxWidth < SIGNATURE_LIMITS.minWidthPx ||
    doc.theme.maxWidth > SIGNATURE_LIMITS.maxWidthPx;

  return (
    <AppShell
      title="Signature builder"
      actions={
        <>
          <GhostButton onClick={() => router.push("/signatures")}>
            ← Back
          </GhostButton>
          <GhostButton onClick={copy}>Copy HTML</GhostButton>
          <GhostButton onClick={download}>Download .html</GhostButton>
          <PrimaryButton onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </PrimaryButton>
        </>
      }
    >
      {status && (
        <div className="mb-3 text-sm bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg px-3 py-2">
          {status}
        </div>
      )}
      {error && (
        <div className="mb-3 text-sm bg-rose-50 border border-rose-200 text-rose-700 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      <div className="mb-3 flex items-center gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Signature name"
          className="flex-1 max-w-md border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <SizeIndicator
          bytes={byteSize}
          widthBad={widthBad}
          sizeBad={sizeBad}
        />
      </div>

      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr_280px] gap-4">
          {/* Left: palette */}
          <Card className="p-3 h-fit">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2">
              Drag onto canvas
            </div>
            <div className="grid grid-cols-2 gap-2">
              {PALETTE.map((p) => (
                <PaletteTile
                  key={p.type}
                  type={p.type}
                  label={p.label}
                  icon={p.icon}
                />
              ))}
            </div>
          </Card>

          {/* Middle: canvas + preview.
              `min-w-0` overrides CSS grid's implicit `min-width: auto`
              so long unbreakable content (e.g. an image URL pasted into a
              Banner block) doesn't blow out the 1fr track and push the
              right-hand Properties panel off-screen. */}
          <div className="space-y-4 min-w-0">
            <Card className="p-4">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2">
                Canvas · drag blocks to reorder
              </div>
              <CanvasDropZone>
                <SortableContext
                  items={doc.blocks.map((b) => b.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {doc.blocks.length === 0 ? (
                    <div className="border-2 border-dashed border-slate-200 rounded-lg p-8 text-center text-sm text-slate-400">
                      Drop a tile from the left to start your signature.
                    </div>
                  ) : (
                    doc.blocks.map((b) =>
                      b.type === "row" ? (
                        <CanvasRow
                          key={b.id}
                          block={b}
                          selectedId={selectedId}
                          onSelect={setSelectedId}
                          onDelete={deleteBlock}
                        />
                      ) : (
                        <CanvasBlock
                          key={b.id}
                          block={b}
                          selected={selectedId === b.id}
                          onSelect={() => setSelectedId(b.id)}
                          onDelete={() => deleteBlock(b.id)}
                        />
                      )
                    )
                  )}
                </SortableContext>
              </CanvasDropZone>
            </Card>

            <Card className="overflow-hidden">
              <div className="px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-100">
                Live preview · what recipients see
              </div>
              <iframe
                title="Signature preview"
                srcDoc={renderedHtml}
                sandbox=""
                className="w-full h-72 bg-white"
              />
            </Card>
          </div>

          {/* Right: properties */}
          <Card className="p-4 h-fit">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-3">
              Properties
            </div>
            {selected ? (
              <PropertiesPanel block={selected} onChange={patchBlock} />
            ) : (
              <ThemePanel theme={doc.theme} onChange={patchTheme} />
            )}
          </Card>
        </div>

        <DragOverlay>
          {dragging ? (
            <div className="rounded-md bg-slate-900 text-white text-xs px-2 py-1 shadow-xl">
              {dragging.source === "palette"
                ? `Drop to add ${dragging.key}`
                : "Moving block"}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </AppShell>
  );
}

/* ------------------------------------------------------------------ */
/*  Palette tile (draggable)                                          */
/* ------------------------------------------------------------------ */

function PaletteTile({
  type,
  label,
  icon,
}: {
  type: PaletteKey;
  label: string;
  icon: string;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette-${type}`,
    data: { source: "palette", blockType: type },
  });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{ touchAction: "none" }}
      className={
        "flex flex-col items-center gap-1 p-2 rounded-md bg-white border border-slate-200 cursor-grab select-none transition hover:border-indigo-300 hover:shadow-sm text-center " +
        (isDragging ? "opacity-50" : "")
      }
    >
      <span className="text-base">{icon}</span>
      <span className="text-[11px] font-medium text-slate-700">{label}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Canvas drop zone                                                   */
/* ------------------------------------------------------------------ */

function CanvasDropZone({ children }: { children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({
    id: "canvas-root",
    data: { type: "canvas-root" },
  });
  return (
    <div
      ref={setNodeRef}
      className={
        "rounded-lg p-3 transition " +
        (isOver ? "bg-indigo-50/60 outline-dashed outline-2 outline-indigo-400" : "")
      }
    >
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Canvas block (sortable)                                            */
/* ------------------------------------------------------------------ */

function CanvasBlock({
  block,
  selected,
  onSelect,
  onDelete,
  compact = false,
}: {
  block: SignatureBlock;
  selected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  /** Compact rendering used when the block lives inside a row column. */
  compact?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: block.id,
    data: { type: "block", blockId: block.id, source: "canvas" },
  });
  return (
    <div
      ref={setNodeRef}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      {...attributes}
      {...listeners}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
        touchAction: "none",
      }}
      className={
        "group relative rounded-md border bg-white px-3 py-2 mb-2 cursor-grab text-sm " +
        (selected
          ? "border-indigo-500 ring-2 ring-indigo-500/30"
          : "border-slate-200 hover:border-indigo-300")
      }
    >
      <div className="flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-wider text-slate-500 w-16">
          {block.type}
        </span>
        <div className="flex-1 min-w-0 truncate text-slate-700">
          {summary(block)}
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="opacity-0 group-hover:opacity-100 transition h-7 w-7 inline-flex items-center justify-center rounded text-rose-500 hover:bg-rose-50"
          title="Delete"
        >
          🗑
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  CanvasRow — a row container with one droppable per column         */
/* ------------------------------------------------------------------ */

function CanvasRow({
  block,
  selectedId,
  onSelect,
  onDelete,
}: {
  block: SignatureRowBlock;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: block.id,
    data: { type: "block", blockId: block.id, source: "canvas" },
  });
  const selected = selectedId === block.id;
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
      className={
        "group relative rounded-md border bg-white mb-2 " +
        (selected
          ? "border-indigo-500 ring-2 ring-indigo-500/30"
          : "border-slate-200 hover:border-indigo-300")
      }
    >
      <div
        {...attributes}
        {...listeners}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(block.id);
        }}
        style={{ touchAction: "none" }}
        className="flex items-center gap-2 px-3 py-1 border-b border-slate-100 bg-slate-50 cursor-grab text-[11px] uppercase tracking-wider text-slate-500"
      >
        <span>row · {block.columns.length} cols</span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(block.id);
          }}
          className="ml-auto opacity-0 group-hover:opacity-100 transition h-6 w-6 inline-flex items-center justify-center rounded text-rose-500 hover:bg-rose-50"
          title="Delete row"
        >
          🗑
        </button>
      </div>
      <div
        // `min-w-0` on the row's column container is the second half of
        // the fix — without it, a flexbox child can grow to fit its own
        // min-content (the URL) and ignore the percentage width.
        // No `gap` on the parent — each column carries its own
        // marginRight (col.gapAfter ?? block.gutter), so individual gaps
        // can be tuned without forcing every column to use the same
        // value.
        className="flex p-2 min-w-0"
      >
        {block.columns.map((col, i) => (
          <ColumnDropZone
            key={i}
            rowId={block.id}
            colIndex={i}
            width={col.width}
            gapAfter={
              i < block.columns.length - 1
                ? col.gapAfter ?? block.gutter ?? 12
                : 0
            }
          >
            {col.blocks.length === 0 ? (
              <div className="text-[11px] text-slate-400 text-center py-3">
                Drop here
              </div>
            ) : (
              col.blocks.map((cb) => (
                <CanvasBlock
                  key={cb.id}
                  block={cb}
                  selected={selectedId === cb.id}
                  onSelect={() => onSelect(cb.id)}
                  onDelete={() => onDelete(cb.id)}
                  compact
                />
              ))
            )}
          </ColumnDropZone>
        ))}
      </div>
    </div>
  );
}

function ColumnDropZone({
  rowId,
  colIndex,
  width,
  gapAfter = 0,
  children,
}: {
  rowId: string;
  colIndex: number;
  width: number;
  /** px of margin between this column and the next (0 on last column). */
  gapAfter?: number;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `col-${rowId}-${colIndex}`,
    data: { type: "row-col", rowId, colIndex },
  });
  return (
    <div
      ref={setNodeRef}
      style={{ width: `${width}%`, marginRight: gapAfter }}
      // `min-w-0` + `overflow-hidden` ensure a Banner block's long URL
      // (or any unbreakable text inside a child block) gets clipped
      // instead of stretching the column past its declared width %.
      className={
        "rounded-md border border-dashed p-1.5 min-h-[60px] min-w-0 overflow-hidden transition " +
        (isOver
          ? "border-indigo-500 bg-indigo-50/60"
          : "border-slate-200 bg-white")
      }
    >
      {children}
    </div>
  );
}

function summary(b: SignatureBlock): string {
  switch (b.type) {
    case "row":
      return `${b.columns.length} columns`;
    case "avatar":
      return b.url || "(no image)";
    case "name":
    case "title":
    case "company":
      return b.text;
    case "contact":
      return `${b.items.length} item${b.items.length === 1 ? "" : "s"}`;
    case "social":
      return b.networks.map((n) => n.kind).join(", ");
    case "banner":
      return b.url;
    case "divider":
      return `${b.thickness}px ${b.color}`;
    case "spacer":
      return `${b.height}px`;
    case "custom":
      return b.html.slice(0, 40);
  }
}

/* ------------------------------------------------------------------ */
/*  Properties panel                                                   */
/* ------------------------------------------------------------------ */

function PropertiesPanel({
  block,
  onChange,
}: {
  block: SignatureBlock;
  onChange: (id: string, patch: Partial<SignatureBlock>) => void;
}) {
  function set<T extends Partial<SignatureBlock>>(patch: T) {
    onChange(block.id, patch);
  }
  switch (block.type) {
    case "row": {
      // Row props — adjust column count, per-column widths, gutter, valign.
      const r = block as SignatureRowBlock;
      function setColumnCount(n: number) {
        const next = r.columns.slice(0, n);
        while (next.length < n) {
          next.push({ width: 100 / n, blocks: [] });
        }
        const w = 100 / n;
        set({ columns: next.map((c) => ({ ...c, width: w })) } as any);
      }
      function setWidth(i: number, w: number) {
        const cols = r.columns.map((c, idx) =>
          idx === i ? { ...c, width: Math.max(5, w) } : c
        );
        // Normalise so the total is 100.
        const sum = cols.reduce((a, b) => a + b.width, 0) || 1;
        const norm = cols.map((c) => ({
          ...c,
          width: +(c.width * (100 / sum)).toFixed(2),
        }));
        set({ columns: norm } as any);
      }
      return (
        <div className="space-y-3 text-sm">
          <StyleBlock />
          <Field label="Columns">
            <select
              value={r.columns.length}
              onChange={(e) => setColumnCount(Math.max(1, Math.min(4, Number(e.target.value))))}
              className="input"
            >
              <option value={1}>1</option>
              <option value={2}>2</option>
              <option value={3}>3</option>
              <option value={4}>4</option>
            </select>
          </Field>
          <div>
            <div className="text-slate-600 mb-1">
              Column widths (%) — auto-normalised to 100
            </div>
            <div className="grid grid-cols-2 gap-2">
              {r.columns.map((c, i) => (
                <label key={i} className="block text-xs">
                  <span className="block text-slate-500 mb-0.5">
                    Column {i + 1}
                  </span>
                  <input
                    type="number"
                    min={5}
                    max={95}
                    value={Math.round(c.width)}
                    onChange={(e) =>
                      setWidth(i, Number(e.target.value) || c.width)
                    }
                    className="input"
                  />
                </label>
              ))}
            </div>
          </div>
          <Field label="Default gap (px between columns)">
            <input
              type="number"
              min={0}
              max={48}
              value={r.gutter ?? 12}
              onChange={(e) =>
                set({
                  gutter: Math.max(
                    0,
                    Math.min(48, Number(e.target.value) || 0)
                  ),
                } as any)
              }
              className="input"
            />
          </Field>

          {/* Per-gap overrides — one slot for each adjacent column pair.
              Each accepts a number or blank ("blank" = inherit the row's
              default gap). Empties out cleanly via Number.isFinite. */}
          {r.columns.length > 1 && (
            <div>
              <div className="text-slate-600 mb-1">
                Individual gaps (override the default per pair)
              </div>
              <div className="grid grid-cols-2 gap-2">
                {r.columns.slice(0, -1).map((c, i) => (
                  <label key={i} className="block text-xs">
                    <span className="block text-slate-500 mb-0.5">
                      Col {i + 1} → {i + 2}
                    </span>
                    <input
                      type="number"
                      min={0}
                      max={48}
                      placeholder={String(r.gutter ?? 12)}
                      value={c.gapAfter ?? ""}
                      onChange={(e) => {
                        const v = e.target.value;
                        const num = Number(v);
                        const cols = r.columns.map((cc, idx) =>
                          idx === i
                            ? {
                                ...cc,
                                gapAfter:
                                  v === ""
                                    ? undefined
                                    : Number.isFinite(num)
                                    ? Math.max(0, Math.min(48, num))
                                    : cc.gapAfter,
                              }
                            : cc
                        );
                        set({ columns: cols } as any);
                      }}
                      className="input"
                    />
                  </label>
                ))}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                Leave blank to inherit the default gap. Set to 0 to close
                the gap between those two columns.
              </div>
            </div>
          )}
          <Field label="Vertical align">
            <select
              value={r.verticalAlign ?? "top"}
              onChange={(e) => set({ verticalAlign: e.target.value as any } as any)}
              className="input"
            >
              <option value="top">Top</option>
              <option value="middle">Middle</option>
              <option value="bottom">Bottom</option>
            </select>
          </Field>
          <div className="text-xs text-slate-500">
            Drag tiles from the palette into any column. The Outlook
            renderer turns each column into its own `&lt;td&gt;` so the
            layout holds in Outlook 2016/365.
          </div>
        </div>
      );
    }
    case "avatar":
      return (
        <div className="space-y-3 text-sm">
          <Field label="Image URL">
            <input
              value={block.url}
              onChange={(e) => set({ url: e.target.value } as any)}
              className="input"
            />
          </Field>
          <Field label="Size (px)">
            <input
              type="number"
              value={block.size}
              min={32}
              max={SIGNATURE_LIMITS.maxImagePx}
              onChange={(e) =>
                set({ size: Math.max(32, Math.min(SIGNATURE_LIMITS.maxImagePx, Number(e.target.value) || 0)) } as any)
              }
              className="input"
            />
          </Field>
          <Field label="Shape">
            <select
              value={block.shape}
              onChange={(e) => set({ shape: e.target.value as any } as any)}
              className="input"
            >
              <option value="circle">Circle</option>
              <option value="square">Square</option>
              <option value="rounded">Rounded</option>
            </select>
          </Field>
          <Style />
        </div>
      );
    case "name":
    case "title":
    case "company":
      return (
        <div className="space-y-3 text-sm">
          <StyleBlock />
          <Field label="Text">
            <input
              value={block.text}
              onChange={(e) => set({ text: e.target.value } as any)}
              className="input"
            />
          </Field>
          <TypographyControls block={block} set={set} />
        </div>
      );
    case "contact":
      return (
        <div className="space-y-3 text-sm">
          {block.items.map((it, idx) => (
            <div key={idx} className="border border-slate-100 rounded p-2 space-y-2">
              <select
                value={it.kind}
                onChange={(e) => {
                  const items = block.items.slice();
                  items[idx] = { ...it, kind: e.target.value as any };
                  set({ items } as any);
                }}
                className="input"
              >
                <option value="email">Email</option>
                <option value="phone">Phone</option>
                <option value="website">Website</option>
                <option value="address">Address</option>
              </select>
              <input
                value={it.value}
                onChange={(e) => {
                  const items = block.items.slice();
                  items[idx] = { ...it, value: e.target.value };
                  set({ items } as any);
                }}
                className="input"
              />
              <button
                onClick={() => {
                  const items = block.items.filter((_, i) => i !== idx);
                  set({ items } as any);
                }}
                className="text-xs text-rose-600 hover:underline"
              >
                Remove
              </button>
            </div>
          ))}
          <button
            onClick={() =>
              set({
                items: [
                  ...block.items,
                  { kind: "email", value: "you@example.com" },
                ],
              } as any)
            }
            className="text-sm text-indigo-600 hover:underline"
          >
            + Add row
          </button>
          <Style />
        </div>
      );
    case "social":
      return (
        <div className="space-y-3 text-sm">
          <StyleBlock />
          {/* Visual style + size for the whole row — applies to every chip.
              filled = brand colour fill + white glyph (default)
              circle = same as filled but pill-shaped
              outline = white fill + brand-coloured border & glyph */}
          <div className="grid grid-cols-2 gap-2">
            <Field label="Icon style">
              <select
                value={block.style ?? "filled"}
                onChange={(e) =>
                  set({ style: e.target.value as any } as any)
                }
                className="input"
              >
                <option value="filled">Filled</option>
                <option value="circle">Circle</option>
                <option value="outline">Outline</option>
              </select>
            </Field>
            <Field label="Size (px)">
              <input
                type="number"
                min={16}
                max={48}
                value={block.size ?? 24}
                onChange={(e) =>
                  set({
                    size: Math.max(
                      16,
                      Math.min(48, Number(e.target.value) || 24)
                    ),
                  } as any)
                }
                className="input"
              />
            </Field>
          </div>

          {block.networks.map((n, idx) => (
            <div key={idx} className="border border-slate-100 rounded p-2 space-y-2">
              <select
                value={n.kind}
                onChange={(e) => {
                  const networks = block.networks.slice();
                  networks[idx] = { ...n, kind: e.target.value as any };
                  set({ networks } as any);
                }}
                className="input"
              >
                <option value="linkedin">LinkedIn</option>
                <option value="twitter">Twitter</option>
                <option value="instagram">Instagram</option>
                <option value="facebook">Facebook</option>
                <option value="github">GitHub</option>
                <option value="youtube">YouTube</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="telegram">Telegram</option>
                <option value="tiktok">TikTok</option>
                <option value="dribbble">Dribbble</option>
                <option value="behance">Behance</option>
                <option value="medium">Medium</option>
                <option value="pinterest">Pinterest</option>
                <option value="snapchat">Snapchat</option>
                <option value="custom">Custom Icon</option>
              </select>
              {n.kind === "custom" && (
                <>
                  <input
                    value={n.label || ""}
                    onChange={(e) => {
                      const networks = block.networks.slice();
                      networks[idx] = { ...n, label: e.target.value };
                      set({ networks } as any);
                    }}
                    className="input"
                    placeholder="Label (e.g., 'My Brand')"
                  />
                  <input
                    value={n.iconUrl || ""}
                    onChange={(e) => {
                      const networks = block.networks.slice();
                      networks[idx] = { ...n, iconUrl: e.target.value };
                      set({ networks } as any);
                    }}
                    className="input"
                    placeholder="Icon URL (PNG image)"
                  />
                  <div className="text-xs text-slate-500">
                    Icon URL: Use a PNG image URL. Recommended size: 64x64 or larger.
                  </div>
                  <input
                    type="color"
                    value={n.brandColor || "#666666"}
                    onChange={(e) => {
                      const networks = block.networks.slice();
                      networks[idx] = { ...n, brandColor: e.target.value };
                      set({ networks } as any);
                    }}
                    className="h-8 w-full border border-slate-200 rounded"
                  />
                  <div className="text-xs text-slate-500">
                    Brand color (used for outline style)
                  </div>
                </>
              )}
              <input
                value={n.url}
                onChange={(e) => {
                  const networks = block.networks.slice();
                  networks[idx] = { ...n, url: e.target.value };
                  set({ networks } as any);
                }}
                className="input"
                placeholder="https://"
              />
              <button
                onClick={() => {
                  const networks = block.networks.filter((_, i) => i !== idx);
                  set({ networks } as any);
                }}
                className="text-xs text-rose-600 hover:underline"
              >
                Remove
              </button>
            </div>
          ))}
          <button
            onClick={() =>
              set({
                networks: [
                  ...block.networks,
                  { kind: "linkedin", url: "https://" },
                ],
              } as any)
            }
            className="text-sm text-indigo-600 hover:underline"
          >
            + Add network
          </button>
        </div>
      );
    case "banner":
      return (
        <div className="space-y-3 text-sm">
          <Field label="Image URL">
            <input
              value={block.url}
              onChange={(e) => set({ url: e.target.value } as any)}
              className="input"
            />
          </Field>
          <Field label="Link URL (optional)">
            <input
              value={block.link || ""}
              onChange={(e) => set({ link: e.target.value } as any)}
              className="input"
            />
          </Field>
          <Field label="Alt text">
            <input
              value={block.alt || ""}
              onChange={(e) => set({ alt: e.target.value } as any)}
              className="input"
            />
          </Field>
          {/* Fixed width / height — leave blank to fall back to fluid
              (100% width, auto height preserving aspect ratio). Both
              values are emitted as HTML attributes AND inline CSS so the
              size holds in Outlook desktop as well as Gmail / Apple Mail. */}
          <div className="grid grid-cols-2 gap-2">
            <Field label="Width (px)">
              <input
                type="number"
                min={0}
                max={1200}
                value={block.width ?? ""}
                placeholder="auto"
                onChange={(e) => {
                  const n = Number(e.target.value);
                  set({
                    width: Number.isFinite(n) && n > 0 ? Math.min(1200, n) : undefined,
                  } as any);
                }}
                className="input"
              />
            </Field>
            <Field label="Height (px)">
              <input
                type="number"
                min={0}
                max={1200}
                value={block.height ?? ""}
                placeholder="auto"
                onChange={(e) => {
                  const n = Number(e.target.value);
                  set({
                    height: Number.isFinite(n) && n > 0 ? Math.min(1200, n) : undefined,
                  } as any);
                }}
                className="input"
              />
            </Field>
          </div>
          <div className="text-xs text-slate-500">
            Leave width or height blank to keep the image fluid (auto-fit
            with preserved aspect ratio).
          </div>
          <Style />
        </div>
      );
    case "divider":
      return (
        <div className="space-y-3 text-sm">
          <Field label="Color">
            <input
              type="color"
              value={block.color || "#e2e8f0"}
              onChange={(e) => set({ color: e.target.value } as any)}
              className="h-9 w-full border border-slate-200 rounded"
            />
          </Field>
          <Field label="Thickness (px)">
            <input
              type="number"
              min={1}
              max={6}
              value={block.thickness || 1}
              onChange={(e) =>
                set({ thickness: Math.max(1, Math.min(6, Number(e.target.value) || 1)) } as any)
              }
              className="input"
            />
          </Field>
        </div>
      );
    case "spacer":
      return (
        <div className="space-y-3 text-sm">
          <Field label="Height (px)">
            <input
              type="number"
              min={2}
              max={48}
              value={block.height}
              onChange={(e) =>
                set({ height: Math.max(2, Math.min(48, Number(e.target.value) || 2)) } as any)
              }
              className="input"
            />
          </Field>
        </div>
      );
    case "custom":
      return (
        <div className="space-y-3 text-sm">
          <Field label="HTML">
            <textarea
              rows={6}
              value={block.html}
              onChange={(e) => set({ html: e.target.value } as any)}
              className="input font-mono text-xs"
            />
          </Field>
          <div className="text-xs text-slate-500">
            Tip: keep this Outlook-safe — use table-based HTML, inline CSS, no
            flex / grid.
          </div>
        </div>
      );
  }
}

/* ------------------------------------------------------------------ */
/*  Theme panel (shown when nothing is selected)                       */
/* ------------------------------------------------------------------ */

function ThemePanel({
  theme,
  onChange,
}: {
  theme: SignatureTheme;
  onChange: (patch: Partial<SignatureTheme>) => void;
}) {
  return (
    <div className="space-y-3 text-sm">
      <div className="text-xs text-slate-500">
        Click a block in the canvas to edit it. The fields below set the
        theme used by every block.
      </div>
      <Field label="Accent color">
        <input
          type="color"
          value={theme.accent}
          onChange={(e) => onChange({ accent: e.target.value })}
          className="h-9 w-full border border-slate-200 rounded"
        />
      </Field>
      <Field label="Text color">
        <input
          type="color"
          value={theme.text}
          onChange={(e) => onChange({ text: e.target.value })}
          className="h-9 w-full border border-slate-200 rounded"
        />
      </Field>
      <Field label="Muted color">
        <input
          type="color"
          value={theme.muted}
          onChange={(e) => onChange({ muted: e.target.value })}
          className="h-9 w-full border border-slate-200 rounded"
        />
      </Field>
      <Field label="Font family">
        <select
          value={theme.fontFamily}
          onChange={(e) => onChange({ fontFamily: e.target.value })}
          className="input"
        >
          {AVAILABLE_FONTS.map((font) => (
            <option key={font.value} value={font.value}>
              {font.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Base font size (px)">
        <input
          type="number"
          min={10}
          max={20}
          value={theme.fontSize}
          onChange={(e) =>
            onChange({
              fontSize: Math.max(10, Math.min(20, Number(e.target.value) || 13)),
            })
          }
          className="input"
        />
      </Field>
      <Field
        label={`Max width (px) · ${SIGNATURE_LIMITS.minWidthPx}–${SIGNATURE_LIMITS.maxWidthPx}`}
      >
        <input
          type="number"
          min={SIGNATURE_LIMITS.minWidthPx}
          max={SIGNATURE_LIMITS.maxWidthPx}
          value={theme.maxWidth}
          onChange={(e) =>
            onChange({
              maxWidth: Math.max(
                SIGNATURE_LIMITS.minWidthPx,
                Math.min(
                  SIGNATURE_LIMITS.maxWidthPx,
                  Number(e.target.value) || DEFAULT_THEME.maxWidth
                )
              ),
            })
          }
          className="input"
        />
      </Field>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Small bits                                                         */
/* ------------------------------------------------------------------ */

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-slate-600 mb-1">{label}</span>
      {children}
    </label>
  );
}

// Hack: inject a shared `input` class via a style tag so we don't have to
// repeat the Tailwind classes on every <input>/<select>/<textarea>.
function Style() {
  return null;
}

// Styled inputs — the `.input` class is defined globally via <style> below.
function StyleBlock() {
  return (
    <style jsx global>{`
      .input {
        width: 100%;
        border: 1px solid rgb(226 232 240);
        border-radius: 0.375rem;
        padding: 0.4rem 0.6rem;
        font-size: 0.875rem;
        background: white;
      }
      .input:focus {
        outline: none;
        box-shadow: 0 0 0 2px rgb(99 102 241 / 0.4);
        border-color: rgb(99 102 241);
      }
    `}</style>
  );
}

/* ------------------------------------------------------------------ */
/*  Shared typography controls — used by Name / Title / Company.       */
/*                                                                      */
/*  Surfaces every styling prop the renderer respects: size, colour,    */
/*  weight (numeric CSS font-weight 100–900), italic, and line-height   */
/*  (CSS unitless multiplier). Empty values fall back to the renderer's */
/*  per-block defaults — so the user can leave anything blank.          */
/* ------------------------------------------------------------------ */

function TypographyControls({
  block,
  set,
}: {
  block: {
    size?: number;
    color?: string;
    bold?: boolean;
    italic?: boolean;
    weight?: number;
    lineHeight?: number;
  };
  set: (patch: Record<string, any>) => void;
}) {
  // Resolve the effective weight for the dropdown — explicit `weight`
  // wins; otherwise the legacy `bold` toggle maps to 700.
  const currentWeight =
    typeof block.weight === "number"
      ? block.weight
      : block.bold
      ? 700
      : 400;

  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Font size (px)">
          <input
            type="number"
            min={8}
            max={48}
            value={block.size ?? ""}
            placeholder="auto"
            onChange={(e) => {
              const n = Number(e.target.value);
              set({
                size: Number.isFinite(n) && n > 0 ? Math.min(48, n) : undefined,
              });
            }}
            className="input"
          />
        </Field>
        <Field label="Line height">
          <input
            type="number"
            min={0.8}
            max={3}
            step={0.05}
            value={block.lineHeight ?? ""}
            placeholder="1.45"
            onChange={(e) => {
              const n = Number(e.target.value);
              set({
                lineHeight: Number.isFinite(n) && n > 0 ? n : undefined,
              });
            }}
            className="input"
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Field label="Weight">
          <select
            value={currentWeight}
            onChange={(e) => {
              const w = Number(e.target.value);
              // Keep `bold` in sync so older saved docs round-trip cleanly.
              set({ weight: w, bold: w >= 600 });
            }}
            className="input"
          >
            <option value={300}>Light · 300</option>
            <option value={400}>Regular · 400</option>
            <option value={500}>Medium · 500</option>
            <option value={600}>Semibold · 600</option>
            <option value={700}>Bold · 700</option>
            <option value={800}>Extrabold · 800</option>
            <option value={900}>Black · 900</option>
          </select>
        </Field>
        <Field label="Color">
          <input
            type="color"
            value={block.color || "#0f172a"}
            onChange={(e) => set({ color: e.target.value })}
            className="h-9 w-full border border-slate-200 rounded"
          />
        </Field>
      </div>

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={!!block.italic}
          onChange={(e) => set({ italic: e.target.checked })}
        />
        Italic
      </label>
      <div className="text-xs text-slate-500">
        Leave size / line height blank to use the theme defaults. All
        weight values render in Gmail, Outlook, and Apple Mail.
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Size indicator                                                     */
/* ------------------------------------------------------------------ */

function SizeIndicator({
  bytes,
  widthBad,
  sizeBad,
}: {
  bytes: number;
  widthBad: boolean;
  sizeBad: boolean;
}) {
  return (
    <>
      <StyleBlock />
      <div className="text-xs text-slate-500 flex items-center gap-3">
        <span
          className={
            sizeBad
              ? "text-rose-600 font-medium"
              : "text-slate-600"
          }
          title={`Gmail clips signatures above ~102 KB. Outlook is most reliable below ${SIGNATURE_LIMITS.maxHtmlBytes / 1024} KB.`}
        >
          {Math.round(bytes / 100) / 10} KB
          {sizeBad && ` · over ${SIGNATURE_LIMITS.maxHtmlBytes / 1024} KB`}
        </span>
        {widthBad && (
          <span className="text-rose-600 font-medium">
            Width out of range
          </span>
        )}
      </div>
    </>
  );
}
