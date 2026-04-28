// =============================================================================
// blockRegistry.ts — single source of truth for "what block types exist"
// -----------------------------------------------------------------------------
// Adding a new block:
//   1. Add an interface + factory + add to the Block union in lib/types.ts
//   2. Add an entry below — { type, label, icon, factory }
//   3. Add a view component to components/blocks/<Name>.tsx and wire it
//      in Canvas.tsx renderBlockView
//   4. Add a renderer to lib/htmlGenerator.ts for export
//   5. Optionally add an editor section to components/RightPanel.tsx
// =============================================================================

import {
  Block,
  BlockType,
  newTextBlock,
  newImageBlock,
  newButtonBlock,
  newSpacerBlock,
  newDividerBlock,
} from "./types";

export interface BlockMeta {
  type: BlockType;
  label: string;
  icon: string;
  /** Sort order in the palette. */
  order: number;
  factory: () => Block;
}

export const blockRegistry: Record<BlockType, BlockMeta> = {
  text: { type: "text", label: "Text", icon: "T", order: 1, factory: newTextBlock },
  image: { type: "image", label: "Image", icon: "🖼", order: 2, factory: newImageBlock },
  button: { type: "button", label: "Button", icon: "▭", order: 3, factory: newButtonBlock },
  divider: {
    type: "divider",
    label: "Divider",
    icon: "—",
    order: 4,
    factory: newDividerBlock,
  },
  spacer: { type: "spacer", label: "Spacer", icon: "↕", order: 5, factory: newSpacerBlock },
};

/** Palette list, sorted. */
export const blockPalette = (): BlockMeta[] =>
  Object.values(blockRegistry).sort((a, b) => a.order - b.order);

/** Construct a fresh block of any registered type. */
export const newBlockOf = (type: BlockType): Block => blockRegistry[type].factory();
