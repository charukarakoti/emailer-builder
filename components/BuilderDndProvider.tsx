"use client";
// =============================================================================
// BuilderDndProvider — single DndContext for the whole dashboard.
//
// Putting the DndContext at the Builder level (above LeftPanel + Canvas) is
// what allows the palette draggables in LeftPanel to talk to the column
// droppables and block sortables in Canvas. Without this lift, palette items
// have no DndContext ancestor and silently do nothing.
//
// We also render a <DragOverlay> so users see a clear preview of what is
// being dragged — regardless of which scroll container it started in or
// whether the source element gets clipped by overflow.
// =============================================================================
import { ReactNode, useState } from "react";
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { useBuilder } from "@/lib/store";
import { blockRegistry } from "@/lib/blockRegistry";
import type { BlockType } from "@/lib/types";

type ActiveDrag =
  | { kind: "palette"; blockType: BlockType }
  | { kind: "block"; blockType: BlockType }
  | { kind: "section"; index: number }
  | null;

export default function BuilderDndProvider({ children }: { children: ReactNode }) {
  const { doc, moveBlock, moveBlockCross, moveSection, addBlock } = useBuilder();
  const [active, setActive] = useState<ActiveDrag>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const handleDragStart = (e: DragStartEvent) => {
    const a = e.active.data.current;
    if (!a) return;
    if (a.source === "palette") {
      setActive({ kind: "palette", blockType: a.blockType as BlockType });
      return;
    }
    if (a.type === "block") {
      const sec = doc.sections.find((s) => s.id === a.sectionId);
      const blk = sec?.columns[a.columnIndex]?.blocks.find(
        (b) => b.id === a.blockId
      );
      setActive({
        kind: "block",
        blockType: (blk?.type ?? "text") as BlockType,
      });
      return;
    }
    if (a.type === "section") {
      const idx = doc.sections.findIndex((s) => s.id === a.sectionId);
      setActive({ kind: "section", index: idx });
    }
  };

  const handleDragEnd = (e: DragEndEvent) => {
    setActive(null);
    const { active: dragActive, over } = e;
    if (!over) return;
    const a = dragActive.data.current;
    const o = over.data.current;
    if (!a) return;

    // ---------- Palette → column ----------
    if (a.source === "palette") {
      const type = a.blockType;
      let sId: string | null = null;
      let cIdx: number | null = null;
      if (o?.type === "col-drop") {
        sId = o.sectionId;
        cIdx = o.columnIndex;
      } else if (o?.type === "block") {
        sId = o.sectionId;
        cIdx = o.columnIndex;
      }
      if (sId && cIdx !== null) addBlock(sId, cIdx, type);
      return;
    }

    // ---------- Section reorder ----------
    if (a.type === "section" && o?.type === "section") {
      const fromId = a.sectionId;
      const toId = o.sectionId;
      const from = doc.sections.findIndex((s) => s.id === fromId);
      const to = doc.sections.findIndex((s) => s.id === toId);
      if (from >= 0 && to >= 0 && from !== to) moveSection(from, to);
      return;
    }

    // ---------- Block drag (within / across columns / across sections) ----------
    if (a.type === "block") {
      const srcSec = a.sectionId as string;
      const srcCol = a.columnIndex as number;
      const blockId = a.blockId as string;

      if (o?.type === "block") {
        const dstSec = o.sectionId as string;
        const dstCol = o.columnIndex as number;
        const dstBlockId = o.blockId as string;

        if (srcSec === dstSec && srcCol === dstCol) {
          const sec = doc.sections.find((s) => s.id === srcSec);
          if (!sec) return;
          const col = sec.columns[srcCol];
          const oldIndex = col.blocks.findIndex((b) => b.id === blockId);
          const newIndex = col.blocks.findIndex((b) => b.id === dstBlockId);
          if (oldIndex >= 0 && newIndex >= 0 && oldIndex !== newIndex) {
            moveBlock(srcSec, srcCol, oldIndex, newIndex);
          }
        } else {
          const dstSection = doc.sections.find((s) => s.id === dstSec);
          if (!dstSection) return;
          const dstIdx = dstSection.columns[dstCol].blocks.findIndex(
            (b) => b.id === dstBlockId
          );
          moveBlockCross(
            srcSec,
            srcCol,
            blockId,
            dstSec,
            dstCol,
            Math.max(0, dstIdx)
          );
        }
        return;
      }

      if (o?.type === "col-drop") {
        const dstSec = o.sectionId as string;
        const dstCol = o.columnIndex as number;
        if (srcSec === dstSec && srcCol === dstCol) return;
        const dstSection = doc.sections.find((s) => s.id === dstSec);
        if (!dstSection) return;
        moveBlockCross(
          srcSec,
          srcCol,
          blockId,
          dstSec,
          dstCol,
          dstSection.columns[dstCol].blocks.length
        );
      }
    }
  };

  // -------------------------------------------------------------- preview ----
  const renderPreview = () => {
    if (!active) return null;

    if (active.kind === "section") {
      return (
        <div
          className="px-3 py-2 rounded shadow-xl bg-white border-2 border-blue-500 text-sm font-mono text-blue-700"
          style={{ pointerEvents: "none" }}
        >
          §{active.index + 1} ⇅ Moving section
        </div>
      );
    }

    const meta = blockRegistry[active.blockType];
    const label = meta?.label ?? active.blockType;
    const icon = meta?.icon ?? "▦";
    const verb = active.kind === "palette" ? "Add" : "Move";
    return (
      <div
        className="flex items-center gap-2 px-3 py-2 rounded shadow-xl bg-white border-2 border-blue-500 text-sm"
        style={{ pointerEvents: "none" }}
      >
        <span className="w-6 h-6 flex items-center justify-center bg-blue-50 rounded text-sm">
          {icon}
        </span>
        <span className="font-semibold text-blue-700">
          {verb}: {label}
        </span>
        <span className="text-[11px] text-slate-500 ml-1">drop into a column</span>
      </div>
    );
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActive(null)}
    >
      {children}
      <DragOverlay dropAnimation={null}>{renderPreview()}</DragOverlay>
    </DndContext>
  );
}
