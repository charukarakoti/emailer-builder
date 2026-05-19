"use client";
import { useState } from "react";
import { useBuilder } from "@/lib/store";
import { BlockType, ColumnLayout } from "@/lib/types";
import { blockPalette } from "@/lib/blockRegistry";
import { useDraggable } from "@dnd-kit/core";

// =============================================================================
// Left panel — redesigned as a two-column layout:
//
//   ┌──────┬───────────────────────────┐
//   │ Rail │  Active tab content       │
//   │ ──── │  (3-col block grid, etc.) │
//   └──────┴───────────────────────────┘
//
// The rail mirrors the look of modern email-builder SaaS (Beefree, Mailchimp,
// Benchmark): narrow vertical strip with stacked icon + label buttons. Each
// rail tab swaps the right-hand content area:
//   • Content / Blocks → section-layout strip + 3-column block grid
//   • Body / Images / Uploads / Audit → light placeholders that point at
//     features that already live elsewhere in the SaaS (right panel, /media,
//     /cvs, /reports respectively).
//
// The actual draggable blocks come from blockPalette() exactly as before, so
// the editor logic is untouched; only presentation changes.
// =============================================================================

const LAYOUTS: { v: ColumnLayout; label: string; preview: string }[] = [
  { v: "1", label: "1 col", preview: "█" },
  { v: "50-50", label: "50/50", preview: "█ █" },
  { v: "60-40", label: "60/40", preview: "██ █" },
  { v: "33-33-33", label: "3 col", preview: "█ █ █" },
  { v: "25-25-25-25", label: "4 col", preview: "█ █ █ █" },
];

type Tab = "content" | "blocks" | "body" | "images" | "uploads" | "audit";

const RAIL: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: "content", label: "Content", icon: <IconContent /> },
  { key: "blocks", label: "Blocks", icon: <IconBlocks /> },
  { key: "body", label: "Body", icon: <IconBody /> },
  { key: "images", label: "Images", icon: <IconImages /> },
  { key: "uploads", label: "Uploads", icon: <IconUpload /> },
  { key: "audit", label: "Audit", icon: <IconAudit /> },
];

export default function LeftPanel() {
  const { addSection } = useBuilder();
  const blocks = blockPalette();
  const [tab, setTab] = useState<Tab>("content");

  return (
    <aside className="flex w-[300px] border-r border-slate-200 bg-white">
      {/* ---------------- Icon rail ---------------- */}
      <div className="w-14 bg-slate-50/80 border-r border-slate-200 py-3 flex flex-col items-center gap-1">
        {RAIL.map((item) => {
          const active = tab === item.key;
          return (
            <button
              key={item.key}
              onClick={() => setTab(item.key)}
              className={
                "w-12 py-2 rounded-lg flex flex-col items-center gap-1 transition " +
                (active
                  ? "bg-white text-indigo-600 shadow-sm border border-slate-200"
                  : "text-slate-500 hover:text-slate-900 hover:bg-white")
              }
            >
              <span className="h-5 w-5 flex items-center justify-center">
                {item.icon}
              </span>
              <span className="text-[10px] font-medium leading-none">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* ---------------- Main column ---------------- */}
      <div className="flex-1 overflow-y-auto">
        {(tab === "content" || tab === "blocks") && (
          <>
            {tab === "content" && (
              <SectionStrip onAdd={addSection} />
            )}

            <div className="px-3 pt-3 pb-2">
              <SectionHeader>Blocks</SectionHeader>
            </div>

            <div className="px-3 pb-4 grid grid-cols-3 gap-2">
              {blocks.map((b) => (
                <BlockTile
                  key={b.type}
                  type={b.type}
                  label={b.label}
                  icon={b.icon}
                />
              ))}
            </div>

            <div className="px-3 pb-5 text-[11px] text-slate-400">
              Drag a tile into a column on the canvas.
            </div>
          </>
        )}

        {tab === "body" && (
          <PlaceholderPanel
            title="Body styles"
            body="Background, content width, alignment, border, and radius live in the right panel under Email settings."
          />
        )}
        {tab === "images" && (
          <PlaceholderPanel
            title="Image library"
            body="The media library is part of Phase 5. Drop hosted image URLs into the Image block for now."
          />
        )}
        {tab === "uploads" && (
          <PlaceholderPanel
            title="Uploads"
            body={
              <>
                CV and file uploads are managed at{" "}
                <a
                  href="/cvs"
                  className="text-indigo-600 hover:underline"
                >
                  /cvs
                </a>
                .
              </>
            }
          />
        )}
        {tab === "audit" && (
          <PlaceholderPanel
            title="Audit"
            body={
              <>
                Send logs and delivery stats live on the{" "}
                <a
                  href="/reports"
                  className="text-indigo-600 hover:underline"
                >
                  Reports
                </a>{" "}
                page.
              </>
            }
          />
        )}
      </div>
    </aside>
  );
}

/* ------------------------------------------------------------------------- */
/*  Sub-components                                                           */
/* ------------------------------------------------------------------------- */

function SectionStrip({ onAdd }: { onAdd: (l: ColumnLayout) => void }) {
  return (
    <div className="px-3 pt-3 pb-1">
      <SectionHeader>Sections</SectionHeader>
      <div className="grid grid-cols-3 gap-2 mt-2">
        {LAYOUTS.map((l) => (
          <button
            key={l.v}
            onClick={() => onAdd(l.v)}
            className="group flex flex-col items-center gap-1 bg-white border border-dashed border-slate-300 rounded-lg px-1 py-2 hover:border-indigo-400 hover:bg-indigo-50/40 transition"
          >
            <span className="font-mono text-[10px] text-slate-400 group-hover:text-indigo-500">
              {l.preview}
            </span>
            <span className="text-[11px] text-slate-600 font-medium">
              {l.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function BlockTile({
  type,
  label,
  icon,
}: {
  type: BlockType;
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
      className={
        "flex flex-col items-center justify-center gap-1.5 aspect-square bg-white border border-slate-200 rounded-lg cursor-grab select-none transition hover:border-indigo-300 hover:shadow-sm " +
        (isDragging ? "opacity-50" : "")
      }
      style={{ touchAction: "none" }}
    >
      <span className="h-6 w-6 flex items-center justify-center text-base text-slate-600">
        {icon}
      </span>
      <span className="text-[11px] font-medium text-slate-700">
        {label}
      </span>
    </div>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-semibold tracking-wider text-slate-500 uppercase">
      {children}
    </div>
  );
}

function PlaceholderPanel({
  title,
  body,
}: {
  title: string;
  body: React.ReactNode;
}) {
  return (
    <div className="p-4">
      <div className="text-sm font-semibold text-slate-700 mb-1">{title}</div>
      <div className="text-xs text-slate-500 leading-relaxed">{body}</div>
    </div>
  );
}

/* ------------------------------------------------------------------------- */
/*  Inline SVG icons (kept tiny — 16x16 strokes)                              */
/* ------------------------------------------------------------------------- */

function IconContent() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="4" width="16" height="6" rx="1.5" />
      <rect x="4" y="13" width="7" height="7" rx="1.5" />
      <rect x="13" y="13" width="7" height="7" rx="1.5" />
    </svg>
  );
}
function IconBlocks() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}
function IconBody() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 9h18" />
    </svg>
  );
}
function IconImages() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="9" cy="10" r="1.5" />
      <path d="M21 16l-5-5-9 9" />
    </svg>
  );
}
function IconUpload() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v12" />
      <path d="M7 8l5-5 5 5" />
      <path d="M5 21h14" />
    </svg>
  );
}
function IconAudit() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="6" y="4" width="12" height="16" rx="2" />
      <path d="M9 4v2h6V4" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}
