"use client";
import { ButtonBlock } from "@/lib/types";
import { paddingToCss } from "@/lib/types";

export default function ButtonBlockView({ block }: { block: ButtonBlock }) {
  const s = block.style;
  const r = Math.min(8, parseInt(s.borderRadius || "0", 10));
  return (
    <div
      style={{
        padding: paddingToCss(s.containerPadding),
        textAlign: s.align,
      }}
    >
      <span
        style={{
          display: "inline-block",
          backgroundColor: s.backgroundColor,
          color: s.color,
          fontSize: s.fontSize,
          fontWeight: s.fontWeight,
          padding: `${s.paddingY} ${s.paddingX}`,
          borderRadius: `${r}px`,
          fontFamily: "Arial, Helvetica, sans-serif",
          lineHeight: 1.2,
        }}
      >
        {block.content}
      </span>
    </div>
  );
}
