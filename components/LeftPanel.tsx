"use client";
import { useBuilder } from "@/lib/store";
import { BlockType, ColumnLayout } from "@/lib/types";
import { blockPalette } from "@/lib/blockRegistry";
import { useDraggable } from "@dnd-kit/core";

const LAYOUTS: { v: ColumnLayout; label: string }[] = [
  { v: "1", label: "1 column" },
  { v: "50-50", label: "2 cols (50 / 50)" },
  { v: "60-40", label: "2 cols (60 / 40)" },
  { v: "33-33-33", label: "3 columns" },
  { v: "25-25-25-25", label: "4 columns" },
];

function BlockItem({
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
      className={`flex items-center gap-2 px-3 py-2 border rounded bg-white cursor-grab hover:border-blue-400 hover:bg-blue-50 select-none ${
        isDragging ? "opacity-50" : ""
      }`}
      style={{ touchAction: "none" }}
    >
      <span className="w-6 h-6 flex items-center justify-center bg-slate-100 rounded text-sm">
        {icon}
      </span>
      <span className="text-sm">{label}</span>
    </div>
  );
}

export default function LeftPanel() {
  const { addSection } = useBuilder();
  const blocks = blockPalette();

  return (
    <aside className="w-64 border-r bg-slate-50 overflow-y-auto">
      <div className="p-4">
        <div className="text-xs font-semibold text-slate-500 mb-2 uppercase">
          New section
        </div>
        <div className="space-y-1">
          {LAYOUTS.map((l) => (
            <button
              key={l.v}
              onClick={() => addSection(l.v)}
              className="w-full text-sm text-left px-3 py-2 border-dashed border-2 border-slate-300 rounded hover:border-blue-400 hover:bg-blue-50"
            >
              + {l.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pb-4">
        <div className="text-xs font-semibold text-slate-500 mb-2 uppercase">
          Blocks (drag into a column)
        </div>
        <div className="space-y-2">
          {blocks.map((b) => (
            <BlockItem
              key={b.type}
              type={b.type}
              label={b.label}
              icon={b.icon}
            />
          ))}
        </div>
        <div className="text-[11px] text-slate-400 mt-3 leading-relaxed">
          Add a block type by editing{" "}
          <code className="bg-slate-100 px-1 rounded">lib/blockRegistry.ts</code>
          .
        </div>
      </div>

      <div className="px-4 pb-6 text-xs text-slate-500 leading-relaxed">
        <div className="font-semibold text-slate-600 mb-1">Tips</div>
        Click any block to edit it. Hover a block to <em>duplicate</em> or{" "}
        <em>delete</em>. Drag a block by its body to reorder — you can drop it
        into a different column or section. Drag the section's <em>§N</em>{" "}
        handle (top-left) to reorder sections. Cmd/Ctrl+Z = undo. Your full
        history is auto-saved every 4 seconds.
      </div>
    </aside>
  );
}
