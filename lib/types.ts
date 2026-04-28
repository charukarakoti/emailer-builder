// =============================================================================
// JSON SCHEMA v3
// =============================================================================
// New in v3:
//   - meta.alignment ("center" | "left") — controls outer-wrapper td align
//   - meta.border / section.style.border   — { width, style, color }
//   - meta.borderRadius / section.style.borderRadius (safe 0–8px)
//   - TextBlock content may contain <ul>/<ol>/<li> in addition to <strong>/<a>
//   - section.style.paddingMode (UI-only hint: "unified" | "trbl")
// =============================================================================

export type BlockType = "text" | "image" | "button" | "spacer" | "divider";
export type ColumnLayout =
  | "1"
  | "50-50"
  | "60-40"
  | "33-33-33"
  | "25-25-25-25";
export type Alignment = "center" | "left" | "right";
export type PaddingMode = "unified" | "trbl";

/** How many physical columns a given layout uses. */
export const columnCountFor = (l: ColumnLayout): number =>
  l === "1" ? 1 : l === "33-33-33" ? 3 : l === "25-25-25-25" ? 4 : 2;

export interface Padding {
  top: string;
  right: string;
  bottom: string;
  left: string;
}

export const p = (t: string, r = t, b = t, l = r): Padding => ({
  top: t,
  right: r,
  bottom: b,
  left: l,
});

export const paddingToCss = (p: Padding): string =>
  `${p.top} ${p.right} ${p.bottom} ${p.left}`;

export interface Border {
  width: string; // e.g. "1px" or "0"
  style: "none" | "solid" | "dashed" | "dotted";
  color: string;
}

export const noBorder = (): Border => ({ width: "0", style: "none", color: "#000000" });

export const borderToCss = (b: Border): string | undefined =>
  b.style === "none" || !b.width || b.width === "0"
    ? undefined
    : `${b.width} ${b.style} ${b.color}`;

// =============================================================================
// Blocks
// =============================================================================

export interface TextBlock {
  id: string;
  type: "text";
  /**
   * SANITIZED RICH HTML — only:
   *   <strong>, <b>(→<strong>), <a href="…">, <br/>
   *   <ul>, <ol>, <li>
   */
  content: string;
  style: {
    fontSize: string;
    color: string;
    lineHeight: string;
    fontWeight: "400" | "700";
    textAlign: "left" | "center" | "right";
    fontFamily:
      | "Arial, Helvetica, sans-serif"
      | "'Helvetica Neue', Helvetica, Arial, sans-serif"
      | "Georgia, serif"
      | "'Times New Roman', Times, serif"
      | "Verdana, Geneva, sans-serif"
      | "'Courier New', Courier, monospace";
    padding: Padding;
    linkColor: string;
  };
}

export interface ImageBlock {
  id: string;
  type: "image";
  src: string;
  alt: string;
  href?: string;
  style: { width: string; align: "left" | "center" | "right"; padding: Padding };
}

export interface ButtonBlock {
  id: string;
  type: "button";
  content: string;
  href: string;
  style: {
    backgroundColor: string;
    color: string;
    fontSize: string;
    fontWeight: "400" | "700";
    paddingY: string;
    paddingX: string;
    borderRadius: string;
    align: "left" | "center" | "right";
    containerPadding: Padding;
  };
}

export interface SpacerBlock {
  id: string;
  type: "spacer";
  style: { height: string; backgroundColor?: string };
}

export interface DividerBlock {
  id: string;
  type: "divider";
  style: {
    /** Line thickness in px (e.g. "1px"). */
    thickness: string;
    /** Line color. */
    color: string;
    /** "100%" or a fixed px width like "320px". */
    width: string;
    /** Center the line if width < 100%. */
    align: "left" | "center" | "right";
    padding: Padding;
  };
}

export type Block = TextBlock | ImageBlock | ButtonBlock | SpacerBlock | DividerBlock;

// =============================================================================
// Sections + columns
// =============================================================================

export interface Column { blocks: Block[] }

export interface Section {
  id: string;
  style: {
    backgroundColor: string;
    padding: Padding;
    paddingMode: PaddingMode;       // UI-only
    columnLayout: ColumnLayout;
    stackOnMobile: boolean;
    gutter: string;
    border: Border;                 // section-level border
    borderRadius: string;           // 0–8px safe
  };
  columns: Column[];
}

export interface EmailDocument {
  meta: {
    subject: string;
    preheader: string;
    backgroundColor: string;
    contentBackground: string;
    contentWidth: number;
    alignment: Alignment;           // wrapper alignment center | left
    border: Border;                 // template-level border around 600px container
    borderRadius: string;           // template-level radius
  };
  sections: Section[];
}

// =============================================================================
// Factories
// =============================================================================

let _uid = 0;
export const uid = (prefix = "id") =>
  `${prefix}_${Date.now().toString(36)}_${(_uid++).toString(36)}`;

export const newTextBlock = (): TextBlock => ({
  id: uid("txt"),
  type: "text",
  content:
    "Write your message. Use <strong>bold</strong>, a <a href='https://example.com'>link</a>, or a list:<ul><li>Point one</li><li>Point two</li></ul>",
  style: {
    fontSize: "16px",
    color: "#111111",
    lineHeight: "1.5",
    fontWeight: "400",
    textAlign: "left",
    fontFamily: "Arial, Helvetica, sans-serif",
    padding: p("12px", "24px"),
    linkColor: "#007BFF",
  },
});

export const newImageBlock = (): ImageBlock => ({
  id: uid("img"),
  type: "image",
  src: "https://via.placeholder.com/600x240?text=Your+Image",
  alt: "Image",
  style: { width: "600", align: "center", padding: p("0") },
});

export const newButtonBlock = (): ButtonBlock => ({
  id: uid("btn"),
  type: "button",
  content: "Click me",
  href: "https://example.com",
  style: {
    backgroundColor: "#2563eb",
    color: "#ffffff",
    fontSize: "16px",
    fontWeight: "700",
    paddingY: "12px",
    paddingX: "24px",
    borderRadius: "4px",
    align: "center",
    containerPadding: p("16px", "24px"),
  },
});

export const newSpacerBlock = (): SpacerBlock => ({
  id: uid("spc"),
  type: "spacer",
  style: { height: "20px" },
});

export const newDividerBlock = (): DividerBlock => ({
  id: uid("div"),
  type: "divider",
  style: {
    thickness: "1px",
    color: "#e5e7eb",
    width: "100%",
    align: "center",
    padding: p("12px", "20px"),
  },
});

export const newSection = (layout: ColumnLayout = "1"): Section => {
  const n = columnCountFor(layout);
  return {
    id: uid("sec"),
    style: {
      backgroundColor: "#ffffff",
      padding: p("20px"),
      paddingMode: "unified",
      columnLayout: layout,
      stackOnMobile: true,
      gutter: "10px",
      border: noBorder(),
      borderRadius: "0",
    },
    columns: Array.from({ length: n }, () => ({ blocks: [newTextBlock()] })),
  };
};

/** Deep clone any block and re-assign its id. */
export function cloneBlock<T extends Block>(b: T): T {
  return { ...(b as any), id: uid(b.type.slice(0, 3)) } as T;
}

export const newDocument = (): EmailDocument => ({
  meta: {
    subject: "Untitled Email",
    preheader: "",
    backgroundColor: "#f3f4f6",
    contentBackground: "#ffffff",
    contentWidth: 600,
    alignment: "center",
    border: noBorder(),
    borderRadius: "0",
  },
  sections: [newSection("1")],
});

/**
 * Deep clone a section and re-assign all IDs so it can live in the doc.
 */
export function cloneSection(sec: Section): Section {
  return {
    ...sec,
    id: uid("sec"),
    columns: sec.columns.map((c) => ({
      blocks: c.blocks.map((b) => ({ ...(b as any), id: uid(b.type.slice(0, 3)) })),
    })),
  };
}

// =============================================================================
// Rich-text sanitizer — <strong>, <a href>, <br/>, <ul>, <ol>, <li>
// =============================================================================

export function sanitizeRichText(input: string): string {
  if (!input) return "";

  // strip <script>/<style> including contents
  let s = input.replace(/<\/?(script|style)[\s\S]*?>/gi, "");

  // normalize bold tags
  s = s.replace(/<\s*b\s*>/gi, "<strong>").replace(/<\s*\/\s*b\s*>/gi, "</strong>");
  s = s.replace(/<\s*br\s*\/?\s*>/gi, "<br/>");

  // allowlist pass
  s = s.replace(/<([^>]+)>/g, (_m, raw) => {
    const tag = String(raw).trim();
    if (/^strong$/i.test(tag)) return "<strong>";
    if (/^\/strong$/i.test(tag)) return "</strong>";
    if (/^br\s*\/?$/i.test(tag)) return "<br/>";
    if (/^\/a$/i.test(tag)) return "</a>";

    if (/^ul$/i.test(tag)) return "<ul>";
    if (/^\/ul$/i.test(tag)) return "</ul>";
    if (/^ol$/i.test(tag)) return "<ol>";
    if (/^\/ol$/i.test(tag)) return "</ol>";
    if (/^li$/i.test(tag)) return "<li>";
    if (/^\/li$/i.test(tag)) return "</li>";

    const aOpen = tag.match(/^a\b[\s\S]*?href\s*=\s*["']([^"']+)["']/i);
    if (aOpen) {
      if (/^(javascript|data):/i.test(aOpen[1])) return "";
      const href = aOpen[1]
        .replace(/"/g, "&quot;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      return `<a href="${href}">`;
    }
    return "";
  });

  s = s.replace(/&(?!(amp|lt|gt|quot|#\d+|#x[0-9a-f]+);)/gi, "&amp;");
  return s;
}
