"use client";
import { ImageBlock } from "@/lib/types";
import { paddingToCss } from "@/lib/types";

export default function ImageBlockView({ block }: { block: ImageBlock }) {
  const s = block.style;
  return (
    <div
      style={{
        padding: paddingToCss(s.padding),
        textAlign: s.align,
        fontSize: 0,
      }}
    >
      <img
        src={block.src}
        alt={block.alt}
        width={s.width}
        style={{ display: "inline-block", maxWidth: "100%", border: 0 }}
      />
    </div>
  );
}
