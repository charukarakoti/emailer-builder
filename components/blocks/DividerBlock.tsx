"use client";
import { DividerBlock } from "@/lib/types";
import { paddingToCss } from "@/lib/types";

export default function DividerBlockView({ block }: { block: DividerBlock }) {
  const s = block.style;
  return (
    <div
      style={{
        padding: paddingToCss(s.padding),
        textAlign: s.align,
        fontSize: 0,
        lineHeight: 0,
      }}
    >
      <hr
        style={{
          display: "inline-block",
          width: s.width,
          maxWidth: "100%",
          margin: 0,
          padding: 0,
          border: 0,
          borderTop: `${s.thickness} solid ${s.color}`,
          height: 0,
        }}
      />
    </div>
  );
}
