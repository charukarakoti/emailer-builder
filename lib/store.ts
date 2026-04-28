"use client";
import { create } from "zustand";
import {
  EmailDocument,
  Section,
  Block,
  BlockType,
  ColumnLayout,
  newDocument,
  newSection,
  cloneSection,
  cloneBlock,
  columnCountFor,
} from "./types";
import { newBlockOf } from "./blockRegistry";

interface Selection {
  sectionId: string | null;
  columnIndex: number | null;
  blockId: string | null;
}

interface BuilderState extends Selection {
  doc: EmailDocument;
  history: EmailDocument[];
  future: EmailDocument[];

  select: (s: Partial<Selection>) => void;

  addSection: (layout?: ColumnLayout) => void;
  removeSection: (id: string) => void;
  duplicateSection: (id: string) => void;
  updateSectionStyle: (id: string, patch: Partial<Section["style"]>) => void;
  moveSection: (from: number, to: number) => void;
  changeColumnLayout: (id: string, layout: ColumnLayout) => void;

  addBlock: (sectionId: string, columnIndex: number, type: BlockType) => void;
  removeBlock: (sectionId: string, columnIndex: number, blockId: string) => void;
  updateBlock: (
    sectionId: string,
    columnIndex: number,
    blockId: string,
    patch: any
  ) => void;
  moveBlock: (
    sectionId: string,
    columnIndex: number,
    from: number,
    to: number
  ) => void;
  /**
   * Move a block from (srcSectionId, srcColumnIndex) to (dstSectionId,
   * dstColumnIndex) at index `dstIndex`. Used for cross-column / cross-
   * section drag.
   */
  moveBlockCross: (
    srcSectionId: string,
    srcColumnIndex: number,
    blockId: string,
    dstSectionId: string,
    dstColumnIndex: number,
    dstIndex: number
  ) => void;
  /** Insert a copy of the block immediately after the original. */
  duplicateBlock: (
    sectionId: string,
    columnIndex: number,
    blockId: string
  ) => void;

  updateMeta: (patch: Partial<EmailDocument["meta"]>) => void;
  setDoc: (doc: EmailDocument) => void;

  undo: () => void;
  redo: () => void;

  /**
   * Atomically rehydrate doc + history + future from persisted storage.
   * Does NOT push to history (it IS the history).
   */
  restoreState: (s: {
    doc: EmailDocument;
    history: EmailDocument[];
    future: EmailDocument[];
  }) => void;
}

const pushHistory = (state: BuilderState) => ({
  history: [...state.history, state.doc],
  future: [],
});

export const useBuilder = create<BuilderState>((set) => ({
  doc: newDocument(),
  sectionId: null,
  columnIndex: null,
  blockId: null,
  history: [],
  future: [],

  select: (s) =>
    set((st) => ({
      sectionId: s.sectionId ?? st.sectionId,
      columnIndex: s.columnIndex ?? st.columnIndex,
      blockId: s.blockId ?? st.blockId,
      ...(s.sectionId === null ? { sectionId: null } : {}),
      ...(s.columnIndex === null ? { columnIndex: null } : {}),
      ...(s.blockId === null ? { blockId: null } : {}),
    })),

  addSection: (layout = "1") =>
    set((st) => ({
      ...pushHistory(st),
      doc: { ...st.doc, sections: [...st.doc.sections, newSection(layout)] },
    })),

  removeSection: (id) =>
    set((st) => ({
      ...pushHistory(st),
      sectionId: null,
      blockId: null,
      columnIndex: null,
      doc: { ...st.doc, sections: st.doc.sections.filter((s) => s.id !== id) },
    })),

  duplicateSection: (id) =>
    set((st) => {
      const idx = st.doc.sections.findIndex((s) => s.id === id);
      if (idx < 0) return st;
      const copy = cloneSection(st.doc.sections[idx]);
      const sections = [
        ...st.doc.sections.slice(0, idx + 1),
        copy,
        ...st.doc.sections.slice(idx + 1),
      ];
      return { ...pushHistory(st), doc: { ...st.doc, sections } };
    }),

  updateSectionStyle: (id, patch) =>
    set((st) => ({
      ...pushHistory(st),
      doc: {
        ...st.doc,
        sections: st.doc.sections.map((s) =>
          s.id === id ? { ...s, style: { ...s.style, ...patch } } : s
        ),
      },
    })),

  moveSection: (from, to) =>
    set((st) => {
      const arr = [...st.doc.sections];
      const [m] = arr.splice(from, 1);
      arr.splice(to, 0, m);
      return { ...pushHistory(st), doc: { ...st.doc, sections: arr } };
    }),

  changeColumnLayout: (id, layout) =>
    set((st) => ({
      ...pushHistory(st),
      doc: {
        ...st.doc,
        sections: st.doc.sections.map((s) => {
          if (s.id !== id) return s;
          const target = columnCountFor(layout);

          // Collapse-to-1: merge every column's blocks into the first.
          if (target === 1) {
            const merged = s.columns.flatMap((c) => c?.blocks || []);
            return {
              ...s,
              style: { ...s.style, columnLayout: layout },
              columns: [{ blocks: merged }],
            };
          }

          // Going to N>=2 cols. Keep existing columns where possible, pad
          // with empty columns, and overflow extras into the last column so
          // user content is never lost.
          const existing = s.columns.slice(0, target);
          while (existing.length < target) existing.push({ blocks: [] });
          if (s.columns.length > target) {
            const overflow = s.columns
              .slice(target)
              .flatMap((c) => c?.blocks || []);
            existing[target - 1] = {
              blocks: [...existing[target - 1].blocks, ...overflow],
            };
          }
          return {
            ...s,
            style: { ...s.style, columnLayout: layout },
            columns: existing,
          };
        }),
      },
    })),

  addBlock: (sectionId, columnIndex, type) =>
    set((st) => ({
      ...pushHistory(st),
      doc: {
        ...st.doc,
        sections: st.doc.sections.map((s) => {
          if (s.id !== sectionId) return s;
          const cols = s.columns.map((c, i) =>
            i === columnIndex ? { blocks: [...c.blocks, newBlockOf(type)] } : c
          );
          return { ...s, columns: cols };
        }),
      },
    })),

  removeBlock: (sectionId, columnIndex, blockId) =>
    set((st) => ({
      ...pushHistory(st),
      blockId: null,
      doc: {
        ...st.doc,
        sections: st.doc.sections.map((s) => {
          if (s.id !== sectionId) return s;
          const cols = s.columns.map((c, i) =>
            i === columnIndex
              ? { blocks: c.blocks.filter((b) => b.id !== blockId) }
              : c
          );
          return { ...s, columns: cols };
        }),
      },
    })),

  updateBlock: (sectionId, columnIndex, blockId, patch) =>
    set((st) => ({
      ...pushHistory(st),
      doc: {
        ...st.doc,
        sections: st.doc.sections.map((s) => {
          if (s.id !== sectionId) return s;
          const cols = s.columns.map((c, i) => {
            if (i !== columnIndex) return c;
            return {
              blocks: c.blocks.map((b) =>
                b.id === blockId
                  ? ({
                      ...b,
                      ...patch,
                      style: { ...(b as any).style, ...(patch.style || {}) },
                    } as Block)
                  : b
              ),
            };
          });
          return { ...s, columns: cols };
        }),
      },
    })),

  moveBlock: (sectionId, columnIndex, from, to) =>
    set((st) => ({
      ...pushHistory(st),
      doc: {
        ...st.doc,
        sections: st.doc.sections.map((s) => {
          if (s.id !== sectionId) return s;
          const cols = s.columns.map((c, i) => {
            if (i !== columnIndex) return c;
            const arr = [...c.blocks];
            const [m] = arr.splice(from, 1);
            arr.splice(to, 0, m);
            return { blocks: arr };
          });
          return { ...s, columns: cols };
        }),
      },
    })),

  duplicateBlock: (sectionId, columnIndex, blockId) =>
    set((st) => ({
      ...pushHistory(st),
      doc: {
        ...st.doc,
        sections: st.doc.sections.map((s) => {
          if (s.id !== sectionId) return s;
          const cols = s.columns.map((c, i) => {
            if (i !== columnIndex) return c;
            const idx = c.blocks.findIndex((b) => b.id === blockId);
            if (idx < 0) return c;
            const copy = cloneBlock(c.blocks[idx]);
            return {
              blocks: [
                ...c.blocks.slice(0, idx + 1),
                copy,
                ...c.blocks.slice(idx + 1),
              ],
            };
          });
          return { ...s, columns: cols };
        }),
      },
    })),

  moveBlockCross: (
    srcSectionId,
    srcColumnIndex,
    blockId,
    dstSectionId,
    dstColumnIndex,
    dstIndex
  ) =>
    set((st) => {
      // Find and detach the moving block from its source.
      let moving: Block | null = null;
      const detachedSections = st.doc.sections.map((s) => {
        if (s.id !== srcSectionId) return s;
        const cols = s.columns.map((c, i) => {
          if (i !== srcColumnIndex) return c;
          const idx = c.blocks.findIndex((b) => b.id === blockId);
          if (idx < 0) return c;
          moving = c.blocks[idx];
          return { blocks: c.blocks.filter((_, j) => j !== idx) };
        });
        return { ...s, columns: cols };
      });
      if (!moving) return st;

      // If moving within the same column, dstIndex needs no adjustment for
      // the splice we already did (because the slice happened first).
      const sameColumn =
        srcSectionId === dstSectionId && srcColumnIndex === dstColumnIndex;

      const sections = detachedSections.map((s) => {
        if (s.id !== dstSectionId) return s;
        const cols = s.columns.map((c, i) => {
          if (i !== dstColumnIndex) return c;
          const arr = [...c.blocks];
          const insertAt = Math.max(0, Math.min(dstIndex, arr.length));
          arr.splice(insertAt, 0, moving as Block);
          return { blocks: arr };
        });
        return { ...s, columns: cols };
      });

      void sameColumn;
      return { ...pushHistory(st), doc: { ...st.doc, sections } };
    }),

  updateMeta: (patch) =>
    set((st) => ({
      ...pushHistory(st),
      doc: { ...st.doc, meta: { ...st.doc.meta, ...patch } },
    })),

  setDoc: (doc) => set((st) => ({ ...pushHistory(st), doc })),

  undo: () =>
    set((st) => {
      if (!st.history.length) return st;
      const prev = st.history[st.history.length - 1];
      return {
        history: st.history.slice(0, -1),
        future: [st.doc, ...st.future],
        doc: prev,
      };
    }),

  redo: () =>
    set((st) => {
      if (!st.future.length) return st;
      const [next, ...rest] = st.future;
      return {
        history: [...st.history, st.doc],
        future: rest,
        doc: next,
      };
    }),

  restoreState: ({ doc, history, future }) =>
    set(() => ({ doc, history, future })),
}));
