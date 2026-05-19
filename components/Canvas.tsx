"use client";
// =============================================================================
// Canvas — renders sections / columns / blocks, all droppable / sortable.
//
// NOTE: The <DndContext> lives one level up in BuilderDndProvider so that
// LeftPanel's palette draggables share the same context as the canvas
// droppables. Do NOT add a DndContext here — it would create a nested
// context and break palette → column drops.
// =============================================================================
import { useRef } from "react";
import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useBuilder } from "@/lib/store";
import type { Block, Column, Section, ColumnLayout } from "@/lib/types";
import { paddingToCss, borderToCss, columnCountFor } from "@/lib/types";
import TextBlockView from "./blocks/TextBlock";
import ImageBlockView from "./blocks/ImageBlock";
import ButtonBlockView from "./blocks/ButtonBlock";
import SpacerBlockView from "./blocks/SpacerBlock";
import DividerBlockView from "./blocks/DividerBlock";

// -----------------------------------------------------------------------------
// Block visual — whole block is draggable; click selects; hover surfaces tools
// -----------------------------------------------------------------------------

function renderBlockView(b: Block) {
  switch (b.type) {
    case "text":
      return <TextBlockView block={b} />;
    case "image":
      return <ImageBlockView block={b} />;
    case "button":
      return <ButtonBlockView block={b} />;
    case "spacer":
      return <SpacerBlockView block={b} />;
    case "divider":
      return <DividerBlockView block={b} />;
  }
}

function SortableBlock({
  block,
  sectionId,
  columnIndex,
}: {
  block: Block;
  sectionId: string;
  columnIndex: number;
}) {
  const { select, blockId, removeBlock, duplicateBlock } = useBuilder();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: block.id,
    data: { type: "block", sectionId, columnIndex, blockId: block.id },
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    cursor: "grab",
    touchAction: "none",
  };
  const selected = blockId === block.id;
  const stopBubble = (e: React.PointerEvent) => e.stopPropagation();

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`relative group ${
        selected
          ? "outline outline-2 outline-blue-500"
          : "hover:outline hover:outline-1 hover:outline-blue-300"
      }`}
      onClick={(e) => {
        e.stopPropagation();
        select({ sectionId, columnIndex, blockId: block.id });
      }}
    >
      {renderBlockView(block)}

      <div
        className={`absolute top-1 left-1 text-[10px] px-1 py-0.5 rounded bg-blue-500 text-white pointer-events-none ${
          selected ? "opacity-100" : "opacity-0 group-hover:opacity-90"
        }`}
      >
        ⇅ {block.type}
      </div>

      <div
        className={`absolute top-0 right-0 flex gap-px bg-blue-500 text-white text-xs ${
          selected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        }`}
        onPointerDown={stopBubble}
      >
        <button
          className="px-2 py-0.5 hover:bg-blue-600"
          title="Duplicate this block"
          onClick={(e) => {
            e.stopPropagation();
            duplicateBlock(sectionId, columnIndex, block.id);
          }}
        >
          ⧉
        </button>
        <button
          className="px-2 py-0.5 hover:bg-blue-600"
          title="Delete block"
          onClick={(e) => {
            e.stopPropagation();
            removeBlock(sectionId, columnIndex, block.id);
          }}
        >
          ✕
        </button>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Column drop target (palette items + cross-column drops)
// -----------------------------------------------------------------------------

function ColumnView({
  sectionId,
  columnIndex,
  col,
  width,
  verticalAlign = "top",
}: {
  sectionId: string;
  columnIndex: number;
  col: Column;
  width: string;
  verticalAlign?: "top" | "middle" | "bottom";
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `col-drop-${sectionId}-${columnIndex}`,
    data: { type: "col-drop", sectionId, columnIndex },
  });
  return (
    <div
      ref={setNodeRef}
      // `box-sizing: border-box` ensures any borders / paddings applied on
      // the column don't push the total past the canvas width — that's
      // what made multi-column sections look "broken" when extra padding
      // was applied to one column but not another.
      style={{
        width,
        verticalAlign,
        boxSizing: "border-box",
        fontSize: "14px", // restore — parent has fontSize:0 to kill gaps
      }}
      className={`inline-block relative align-top transition-colors ${
        isOver
          ? "bg-blue-100 outline-dashed outline-[3px] outline-blue-500 ring-2 ring-blue-200"
          : ""
      }`}
    >
      {/* On-hover banner so the user can see "I'm dropping into col 2 of section 1". */}
      {isOver && (
        <div className="absolute top-1 right-1 z-10 text-[10px] uppercase tracking-wide font-semibold bg-blue-600 text-white px-1.5 py-0.5 rounded shadow pointer-events-none">
          Drop in col {columnIndex + 1}
        </div>
      )}

      <SortableContext
        items={col.blocks.map((b) => b.id)}
        strategy={verticalListSortingStrategy}
      >
        {col.blocks.map((b) => (
          <SortableBlock
            key={b.id}
            block={b}
            sectionId={sectionId}
            columnIndex={columnIndex}
          />
        ))}
        {col.blocks.length === 0 && (
          <div
            className={`text-center text-xs py-6 m-2 border-dashed border-2 transition-colors ${
              isOver
                ? "border-blue-500 text-blue-700 bg-blue-50 font-semibold"
                : "border-slate-200 text-slate-400"
            }`}
          >
            {isOver ? "Release to drop here" : "Drop blocks here"}
          </div>
        )}
      </SortableContext>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Column resize handle
// -----------------------------------------------------------------------------
//
// A 4px-wide vertical grab bar that sits between two adjacent columns. On
// pointer-down we capture the pointer and the starting widths; on move we
// compute the new split based on the pixel delta vs the section's pixel
// width; on pointer-up we commit the new widths to the store. A 5% floor
// per column prevents either side from being dragged to nothing.

function ColumnResizeHandle({
  sectionId,
  leftIndex,
  widthsPct,
  offsetPct,
  currentLayout,
}: {
  sectionId: string;
  leftIndex: number;
  widthsPct: string[];
  offsetPct: number;
  currentLayout: ColumnLayout;
  currentWidths?: number[];
}) {
  const setColumnWidths = useBuilder((st) => st.setColumnWidths);
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{
    startX: number;
    parentWidth: number;
    widths: number[];
  } | null>(null);

  function pctsAsNumbers(): number[] {
    return widthsPct.map((p) => parseFloat(p));
  }

  function onPointerDown(e: React.PointerEvent) {
    e.preventDefault();
    e.stopPropagation();
    const parent = ref.current?.parentElement;
    if (!parent) return;
    drag.current = {
      startX: e.clientX,
      parentWidth: parent.getBoundingClientRect().width,
      widths: pctsAsNumbers(),
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d) return;
    const deltaPx = e.clientX - d.startX;
    const deltaPct = (deltaPx / d.parentWidth) * 100;
    const left = d.widths[leftIndex];
    const right = d.widths[leftIndex + 1];
    // 5% floor per column.
    const maxIncrease = right - 5;
    const maxDecrease = -(left - 5);
    const clamped = Math.min(maxIncrease, Math.max(maxDecrease, deltaPct));
    const next = d.widths.slice();
    next[leftIndex] = +(left + clamped).toFixed(4);
    next[leftIndex + 1] = +(right - clamped).toFixed(4);
    setColumnWidths(sectionId, next);
  }

  function onPointerUp(e: React.PointerEvent) {
    drag.current = null;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  }

  if (columnCountFor(currentLayout) < 2) return null;

  return (
    <div
      ref={ref}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onClick={(e) => e.stopPropagation()}
      title="Drag to resize columns"
      className="group"
      style={{
        position: "absolute",
        top: 0,
        bottom: 0,
        left: `${offsetPct}%`,
        // Center the hit area on the column boundary.
        width: "10px",
        transform: "translateX(-50%)",
        cursor: "col-resize",
        userSelect: "none",
        touchAction: "none",
        zIndex: 5,
      }}
    >
      <div
        className="absolute inset-y-0 left-1/2 w-[2px] -translate-x-1/2 bg-transparent group-hover:bg-indigo-400 transition-colors"
      />
    </div>
  );
}

// -----------------------------------------------------------------------------
// Section
// -----------------------------------------------------------------------------

/**
 * Computed widths for each column in the section, as CSS percentage
 * strings. Honours any manually-set Section.style.columnWidths first;
 * falls back to the defaults baked into the layout type.
 *
 * The function also normalises the values so they sum to exactly 100 even
 * if rounding has drifted them — sub-pixel gaps were the cause of the
 * "sections look broken after adding" visual bug.
 */
function columnWidthsPct(
  layout: ColumnLayout,
  custom?: number[] | undefined
): string[] {
  const n = columnCountFor(layout);
  const base = (() => {
    if (custom && custom.length === n) return custom.slice();
    if (layout === "1") return [100];
    if (layout === "50-50") return [50, 50];
    if (layout === "60-40") return [60, 40];
    return Array.from({ length: n }, () => 100 / n);
  })();
  // Normalise — guarantee total = 100, avoid sub-pixel rounding gaps.
  const sum = base.reduce((a, b) => a + b, 0);
  return base.map((w) => `${((w / sum) * 100).toFixed(4)}%`);
}

function SortableSection({
  section,
  index,
}: {
  section: Section;
  index: number;
}) {
  const { select, sectionId, blockId, removeSection, duplicateSection } =
    useBuilder();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `section-${section.id}`,
    data: { type: "section", sectionId: section.id },
  });
  const selected = sectionId === section.id && !blockId;
  const s = section.style;
  const widths = columnWidthsPct(s.columnLayout, s.columnWidths);

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    backgroundColor: s.backgroundColor,
    padding: paddingToCss(s.padding),
    border: borderToCss(s.border),
    borderRadius:
      parseInt(s.borderRadius || "0", 10) > 0
        ? `${Math.min(8, parseInt(s.borderRadius, 10))}px`
        : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      onClick={(e) => {
        e.stopPropagation();
        select({ sectionId: section.id, columnIndex: null, blockId: null });
      }}
      className={`relative ${
        selected ? "outline outline-2 outline-blue-500" : ""
      }`}
      style={style}
    >
      {/* Section drag handle — only this element drags the section. */}
      <div
        {...attributes}
        {...listeners}
        title="Drag to reorder section"
        className="absolute -left-10 top-0 text-[11px] text-slate-600 font-mono px-1 py-0.5 bg-white border rounded cursor-grab select-none shadow-sm"
        style={{ touchAction: "none" }}
        onClick={(e) => e.stopPropagation()}
      >
        §{index + 1} ⇅
      </div>

      {/* fontSize: 0 removes inline-block whitespace gaps. The container
          uses position:relative so the absolute-positioned resize handles
          float between adjacent columns without stealing width. */}
      <div style={{ fontSize: 0, position: "relative" }}>
        {section.columns.map((col, ci) => (
          <ColumnView
            key={ci}
            sectionId={section.id}
            columnIndex={ci}
            col={col}
            width={widths[ci]}
            verticalAlign={s.verticalAlign || "top"}
          />
        ))}
        {/* Resize handles — N-1 of them, each anchored to the cumulative
            right edge of the column at `leftIndex`. */}
        {section.columns.length > 1 &&
          section.columns.slice(0, -1).map((_, ci) => {
            const cumulative = widths
              .slice(0, ci + 1)
              .reduce((acc, p) => acc + parseFloat(p), 0);
            return (
              <ColumnResizeHandle
                key={`resize-${ci}`}
                sectionId={section.id}
                leftIndex={ci}
                widthsPct={widths}
                offsetPct={cumulative}
                currentLayout={s.columnLayout}
                currentWidths={s.columnWidths}
              />
            );
          })}
      </div>

      {selected && (
        <div className="absolute -top-3 right-2 flex gap-1 text-xs z-10">
          <button
            onClick={(e) => {
              e.stopPropagation();
              duplicateSection(section.id);
            }}
            className="bg-slate-700 text-white px-2 py-0.5 rounded shadow"
            title="Duplicate section below"
          >
            ⧉ Duplicate
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              removeSection(section.id);
            }}
            className="bg-red-500 text-white px-2 py-0.5 rounded shadow"
          >
            ✕ Delete
          </button>
        </div>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Canvas — outer frame, add-section buttons, DnD wiring
// -----------------------------------------------------------------------------

const ADD_LAYOUTS: { v: ColumnLayout; label: string }[] = [
  { v: "1", label: "1 col" },
  { v: "50-50", label: "50 / 50" },
  { v: "60-40", label: "60 / 40" },
  { v: "33-33-33", label: "3 cols" },
  { v: "25-25-25-25", label: "4 cols" },
];

export default function Canvas() {
  const { doc, addSection, select } = useBuilder();

  return (
    <main
      className="flex-1 overflow-y-auto py-8 px-10"
      style={{ backgroundColor: doc.meta.backgroundColor }}
      onClick={() =>
        select({ sectionId: null, columnIndex: null, blockId: null })
      }
    >
      {/* The "Email alignment: …" debug hint that lived here was removed in
          the SaaS redesign — the same toggle is available in the right
          panel under Layout → Page alignment. */}
      <div
        className="canvas-frame bg-white"
        style={{
          width: doc.meta.contentWidth,
          maxWidth: "100%",
          backgroundColor: doc.meta.contentBackground,
          marginLeft: "auto",
          marginRight: "auto",
          border: borderToCss(doc.meta.border),
          borderRadius:
            parseInt(doc.meta.borderRadius || "0", 10) > 0
              ? `${Math.min(8, parseInt(doc.meta.borderRadius, 10))}px`
              : undefined,
        }}
      >
        <SortableContext
          items={doc.sections.map((s) => `section-${s.id}`)}
          strategy={verticalListSortingStrategy}
        >
          {doc.sections.map((s, i) => (
            <SortableSection key={s.id} section={s} index={i} />
          ))}
        </SortableContext>
      </div>

      {/* Section quick-add row — constrained to the canvas width and
          centered so it visually belongs to the email column rather than
          sprawling across the entire canvas area. */}
      <div
        style={{
          width: doc.meta.contentWidth,
          maxWidth: "100%",
          marginLeft: "auto",
          marginRight: "auto",
        }}
        className="mt-4 flex gap-2 justify-center flex-wrap"
      >
        {ADD_LAYOUTS.map((l) => (
          <button
            key={l.v}
            onClick={(e) => {
              e.stopPropagation();
              addSection(l.v);
            }}
            className="text-xs px-3 py-1.5 bg-white border-dashed border-2 border-slate-300 rounded hover:border-blue-400"
          >
            + Section ({l.label})
          </button>
        ))}
      </div>
    </main>
  );
}
