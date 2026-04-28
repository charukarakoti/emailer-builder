"use client";
import { TextBlock } from "@/lib/types";
import { paddingToCss, sanitizeRichText } from "@/lib/types";

/**
 * Editor-view renderer. Uses dangerouslySetInnerHTML because the content is
 * always round-tripped through sanitizeRichText — only <strong>, <a>, <br/>,
 * <ul>, <ol>, <li> survive.
 */
export default function TextBlockView({ block }: { block: TextBlock }) {
  const s = block.style;
  const html = sanitizeRichText(block.content);
  return (
    <div
      style={{
        padding: paddingToCss(s.padding),
        fontFamily: s.fontFamily,
        fontSize: s.fontSize,
        lineHeight: s.lineHeight,
        color: s.color,
        fontWeight: s.fontWeight,
        textAlign: s.textAlign,
      }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
