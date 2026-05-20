// =============================================================================
// lib/signatureHtml.ts — render a SignatureDoc into Outlook-compatible HTML.
//
// All output is table-based with inline CSS. No <div>, no flex / grid, no
// background-image, no shorthand `font` — these are the things Outlook on
// Windows reliably mishandles. Buttons use a VML <v:roundrect> fallback
// inside an `<!--[if mso]>` block so they render as real rectangles.
//
// The schema is intentionally narrow: every block produces exactly one
// outer <tr> in the signature table so reordering blocks just moves rows.
// =============================================================================

export interface SignatureTheme {
  accent: string;        // e.g. "#2563eb"
  text: string;          // e.g. "#0f172a"
  muted: string;         // e.g. "#475569"
  fontFamily: string;    // e.g. 'Arial, Helvetica, sans-serif'
  fontSize: number;      // base px
  maxWidth: number;      // px — Outlook-safe upper bound (recommended 600)
}

/**
 * Leaf blocks — anything that isn't a container. These are the blocks that
 * can live directly in the doc.blocks list OR inside a column of a Row.
 */
export type SignatureLeafBlock =
  | { id: string; type: "avatar"; url: string; size: number; shape: "circle" | "square" | "rounded" }
  // Typography blocks share the same set of optional styling props so the
  // properties panel can render one shared control group for any of them.
  | {
      id: string;
      type: "name";
      text: string;
      bold: boolean;
      size?: number;
      color?: string;
      italic?: boolean;
      /** CSS font-weight (100–900). When set, overrides `bold`. */
      weight?: number;
      /** Multiplier (1.0–2.5). Translated to inline `line-height: N`. */
      lineHeight?: number;
    }
  | {
      id: string;
      type: "title";
      text: string;
      size?: number;
      color?: string;
      bold?: boolean;
      italic?: boolean;
      weight?: number;
      lineHeight?: number;
    }
  | {
      id: string;
      type: "company";
      text: string;
      size?: number;
      color?: string;
      bold?: boolean;
      italic?: boolean;
      weight?: number;
      lineHeight?: number;
    }
  | {
      id: string;
      type: "contact";
      items: { kind: "email" | "phone" | "address" | "website"; label?: string; value: string }[];
    }
  | {
      id: string;
      type: "social";
      networks: {
        kind:
          | "linkedin"
          | "twitter"
          | "instagram"
          | "facebook"
          | "github"
          | "youtube"
          | "whatsapp"
          | "telegram"
          | "tiktok"
          | "dribbble"
          | "behance"
          | "medium"
          | "pinterest"
          | "snapchat"
          | "custom";
        url: string;
        label?: string;           // Custom label for custom icons
        iconUrl?: string;         // Custom icon image URL
        brandColor?: string;      // Custom brand color for outline style
      }[];
      /** Visual treatment for the icon chips. */
      style?: "filled" | "circle" | "outline";
      /** Icon pixel size (square). Default 24. */
      size?: number;
    }
  | {
      id: string;
      type: "banner";
      url: string;
      link?: string;
      alt?: string;
      /** Fixed width in pixels. Defaults to theme.maxWidth when unset. */
      width?: number;
      /** Fixed height in pixels. When unset, the image preserves its
       *  aspect ratio (height:auto). */
      height?: number;
    }
  | { id: string; type: "divider"; color?: string; thickness?: number }
  | { id: string; type: "spacer"; height: number }
  | { id: string; type: "custom"; html: string };

/** A column inside a Row block. `width` is a percentage (sums to 100). */
export interface SignatureColumn {
  width: number;
  blocks: SignatureLeafBlock[];
  /**
   * Optional per-column override for the gap (in px) between this column
   * and the next one. When set, takes precedence over the Row's `gutter`.
   * Ignored on the last column. 0 closes the gap entirely.
   */
  gapAfter?: number;
}

/**
 * A Row block is a horizontal container with 1–4 columns. Renders to a
 * single <table> row with one <td> per column, Outlook-safe. Rows are
 * intentionally NOT nestable (no Row inside a Row) to keep the markup
 * shallow and the DnD model tractable.
 */
export type SignatureRowBlock = {
  id: string;
  type: "row";
  columns: SignatureColumn[];
  gutter?: number; // px between columns
  verticalAlign?: "top" | "middle" | "bottom";
};

export type SignatureBlock = SignatureLeafBlock | SignatureRowBlock;

export interface SignatureDoc {
  theme: SignatureTheme;
  blocks: SignatureBlock[];
}

// Tight size limits — signatures bigger than this are problematic in Outlook
// and Gmail (Gmail clips at ~102 KB and bigger images can be flagged as
// suspicious). Surfaced to the editor so it can warn the user.
export const SIGNATURE_LIMITS = {
  maxWidthPx: 700,
  minWidthPx: 280,
  maxHtmlBytes: 20 * 1024, // 20 KB target — well under Gmail's 102 KB clip
  maxImagePx: 600,
};

// Sensible defaults used by `newSignatureDoc()`.
export const DEFAULT_THEME: SignatureTheme = {
  accent: "#2563eb",
  text: "#0f172a",
  muted: "#475569",
  fontFamily: 'Arial, Helvetica, sans-serif',
  fontSize: 13,
  maxWidth: 520,
};

// Available font families for signature themes
/**
 * Email-safe font stacks. Each entry's `value` is what gets baked into
 * the generated HTML — always a multi-step fallback so the signature
 * still reads sensibly if the named face isn't installed on the
 * recipient's machine. Web-only faces (Google Fonts, etc.) are
 * intentionally NOT here: they don't render in Outlook desktop without
 * embedded CSS, and the email renderer can't ship @import safely.
 */
export const AVAILABLE_FONTS = [
  // Sans-serif (the most reliable category for email).
  { label: "Arial", value: 'Arial, Helvetica, sans-serif' },
  { label: "Helvetica", value: 'Helvetica, Arial, sans-serif' },
  { label: "Trebuchet MS", value: '"Trebuchet MS", Arial, sans-serif' },
  { label: "Verdana", value: 'Verdana, Geneva, sans-serif' },
  { label: "Tahoma", value: 'Tahoma, Geneva, sans-serif' },
  { label: "Segoe UI", value: '"Segoe UI", Arial, sans-serif' },
  { label: "Lucida Sans", value: '"Lucida Sans Unicode", "Lucida Grande", sans-serif' },
  { label: "Geneva", value: 'Geneva, Verdana, sans-serif' },
  { label: "Calibri", value: 'Calibri, Arial, sans-serif' },
  // Serif.
  { label: "Georgia", value: 'Georgia, "Times New Roman", serif' },
  { label: "Times New Roman", value: '"Times New Roman", Times, serif' },
  { label: "Palatino", value: '"Palatino Linotype", Palatino, serif' },
  { label: "Book Antiqua", value: '"Book Antiqua", Palatino, serif' },
  { label: "Garamond", value: 'Garamond, "Times New Roman", serif' },
  { label: "Cambria", value: 'Cambria, Georgia, serif' },
  // Display.
  { label: "Arial Black", value: '"Arial Black", Gadget, sans-serif' },
  { label: "Impact", value: "Impact, Charcoal, sans-serif" },
  { label: "Comic Sans", value: '"Comic Sans MS", "Comic Sans", cursive' },
  // Monospace.
  { label: "Courier New", value: '"Courier New", Courier, monospace' },
  { label: "Lucida Console", value: '"Lucida Console", Monaco, monospace' },
  { label: "Consolas", value: 'Consolas, "Courier New", monospace' },
];

export function newSignatureDoc(): SignatureDoc {
  return {
    theme: DEFAULT_THEME,
    blocks: [
      {
        id: rid(),
        type: "name",
        text: "Jane Doe",
        bold: true,
        size: 16,
      },
      {
        id: rid(),
        type: "title",
        text: "Marketing Lead",
      },
      {
        id: rid(),
        type: "company",
        text: "Acme Inc.",
      },
      { id: rid(), type: "spacer", height: 6 },
      {
        id: rid(),
        type: "contact",
        items: [
          { kind: "email", value: "jane@acme.com" },
          { kind: "phone", value: "+1 (555) 010-0000" },
          { kind: "website", value: "https://acme.com" },
        ],
      },
      {
        id: rid(),
        type: "social",
        networks: [
          { kind: "linkedin", url: "https://linkedin.com/in/jane" },
          { kind: "twitter", url: "https://twitter.com/jane" },
        ],
      },
    ],
  };
}

function rid() {
  return `b_${Math.random().toString(36).slice(2, 8)}`;
}

// ---------------------------------------------------------------------------
//  Render
// ---------------------------------------------------------------------------

function esc(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function rowOpen(theme: SignatureTheme): string {
  return `<tr><td style="padding:0;font-family:${theme.fontFamily};font-size:${theme.fontSize}px;color:${theme.text};line-height:1.45;mso-line-height-rule:exactly;">`;
}
const rowClose = "</td></tr>";

function renderAvatar(b: Extract<SignatureBlock, { type: "avatar" }>, t: SignatureTheme): string {
  const radius =
    b.shape === "circle"
      ? `${Math.round(b.size / 2)}px`
      : b.shape === "rounded"
      ? "8px"
      : "0";
  return (
    rowOpen(t) +
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding:0 0 8px 0;">` +
    `<img src="${esc(b.url)}" alt="" width="${b.size}" height="${b.size}" style="display:block;width:${b.size}px;height:${b.size}px;border:0;outline:none;text-decoration:none;border-radius:${radius};object-fit:cover;" />` +
    `</td></tr></table>` +
    rowClose
  );
}

/**
 * Build the shared CSS string for a typography block (name/title/company).
 * Reads the optional `bold`/`weight`/`italic`/`lineHeight` props and
 * emits inline CSS that holds in Outlook (which ignores shorthand `font`
 * but honours individual props like `font-weight` and `line-height`).
 */
function typographyCss(
  b: {
    size?: number;
    color?: string;
    bold?: boolean;
    italic?: boolean;
    weight?: number;
    lineHeight?: number;
  },
  defaults: { size: number; color: string; weight: number }
): string {
  const size = b.size ?? defaults.size;
  const color = b.color ?? defaults.color;
  // Explicit weight wins over the legacy bold boolean.
  const weight =
    typeof b.weight === "number"
      ? b.weight
      : b.bold === true
      ? 700
      : b.bold === false
      ? 400
      : defaults.weight;
  const lh =
    typeof b.lineHeight === "number" && b.lineHeight > 0
      ? `line-height:${b.lineHeight};`
      : "";
  const italic = b.italic ? "font-style:italic;" : "";
  return `font-size:${size}px;color:${color};font-weight:${weight};${italic}${lh}`;
}

function renderName(
  b: Extract<SignatureBlock, { type: "name" }>,
  t: SignatureTheme
): string {
  const css = typographyCss(b, {
    size: t.fontSize + 3,
    color: t.text,
    weight: b.bold ? 700 : 400,
  });
  return rowOpen(t) + `<span style="${css}">${esc(b.text)}</span>` + rowClose;
}

function renderTitle(
  b: Extract<SignatureBlock, { type: "title" }>,
  t: SignatureTheme
): string {
  const css = typographyCss(b, {
    size: t.fontSize,
    color: t.muted,
    weight: 400,
  });
  return rowOpen(t) + `<span style="${css}">${esc(b.text)}</span>` + rowClose;
}

function renderCompany(
  b: Extract<SignatureBlock, { type: "company" }>,
  t: SignatureTheme
): string {
  const css = typographyCss(b, {
    size: t.fontSize,
    color: t.text,
    weight: 600,
  });
  return rowOpen(t) + `<span style="${css}">${esc(b.text)}</span>` + rowClose;
}

function renderContact(b: Extract<SignatureBlock, { type: "contact" }>, t: SignatureTheme): string {
  const labelFor = (kind: string) => {
    switch (kind) {
      case "email":
        return "✉";
      case "phone":
        return "☎";
      case "website":
        return "🌐";
      case "address":
        return "📍";
      default:
        return "•";
    }
  };
  const linkFor = (kind: string, value: string) => {
    if (kind === "email") return `mailto:${value}`;
    if (kind === "phone") return `tel:${value.replace(/\s+/g, "")}`;
    if (kind === "website")
      return value.startsWith("http") ? value : `https://${value}`;
    return null;
  };
  const lines = b.items.map((it) => {
    const link = linkFor(it.kind, it.value);
    const inner = link
      ? `<a href="${esc(link)}" style="color:${t.accent};text-decoration:none;">${esc(it.value)}</a>`
      : esc(it.value);
    return `<tr><td style="padding:1px 0;font-family:${t.fontFamily};font-size:${t.fontSize}px;color:${t.muted};line-height:1.45;mso-line-height-rule:exactly;"><span style="display:inline-block;width:18px;text-align:left;">${labelFor(it.kind)}</span> ${inner}</td></tr>`;
  });
  return (
    rowOpen(t) +
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0">${lines.join("")}</table>` +
    rowClose
  );
}

// Each social network's official brand colour. Used as the chip
// background in the "filled" style (and as the icon colour in the
// "outline" style). Verified against each brand's public brand guide.
export const BRAND_COLOURS: Record<string, string> = {
  linkedin: "#0a66c2",
  twitter: "#000000",
  instagram: "#e4405f",
  facebook: "#1877f2",
  github: "#181717",
  youtube: "#ff0000",
  whatsapp: "#25d366",
  telegram: "#26a5e4",
  tiktok: "#000000",
  dribbble: "#ea4c89",
  behance: "#1769ff",
  medium: "#000000",
  pinterest: "#e60023",
  snapchat: "#fffc00",
};

// icons8.com slug per network. The "ios-filled" family is a clean
// monochrome glyph set — perfect for both filled chips (white glyph on
// brand colour) and outline chips (brand glyph on white).
const ICONS8_SLUG: Record<string, string> = {
  linkedin: "linkedin",
  twitter: "twitterx", // icons8 routes "twitter" to old bird; "twitterx" = X
  instagram: "instagram-new",
  facebook: "facebook-new",
  github: "github",
  youtube: "youtube-play",
  whatsapp: "whatsapp",
  telegram: "telegram-app",
  tiktok: "tiktok",
  dribbble: "dribbble",
  behance: "behance",
  medium: "medium-monogram",
  pinterest: "pinterest",
  snapchat: "snapchat",
};

/**
 * Render a single social-icon chip. Uses an icons8 PNG so Outlook on
 * Windows renders it reliably (SVG-in-img is unreliable in Outlook desk-
 * top). The icon size is exact; the wrapper td enforces the chip shape.
 * Supports custom icons with custom iconUrl and brandColor.
 */
function socialIcon(
  kind: string,
  size: number,
  style: "filled" | "circle" | "outline",
  themeAccent: string,
  customIconUrl?: string,
  customBrandColor?: string
): string {
  // Use custom brand color if provided, otherwise fall back to predefined or theme accent
  const brand = customBrandColor || BRAND_COLOURS[kind] || themeAccent;
  
  // Use custom icon URL if provided, otherwise use icons8
  let iconUrl: string;
  if (customIconUrl) {
    iconUrl = customIconUrl;
  } else {
    const slug = ICONS8_SLUG[kind] || "globe";
    const isOutline = style === "outline";
    const glyphColour = isOutline ? brand.replace("#", "") : "ffffff";
    iconUrl = `https://img.icons8.com/ios-filled/${size * 2}/${glyphColour}/${slug}.png`;
  }

  // For "filled"/"circle", the icon glyph is white on a brand-coloured chip.
  // For "outline", the chip has a transparent fill + brand-coloured border
  // and the glyph is rendered in the brand colour.
  const isOutline = style === "outline";
  const radius = style === "circle" ? Math.round(size / 2) : 4;
  const bgcolor = isOutline ? "#ffffff" : brand;
  const borderStyle = isOutline ? `1px solid ${brand}` : "0";
  const iconInner = Math.max(12, Math.round(size * 0.65));

  return (
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0">` +
    `<tr><td align="center" valign="middle" width="${size}" height="${size}" ` +
    `bgcolor="${bgcolor}" ` +
    `style="background:${bgcolor};border:${borderStyle};border-radius:${radius}px;line-height:${size}px;mso-line-height-rule:exactly;">` +
    `<img src="${iconUrl}" width="${iconInner}" height="${iconInner}" alt="${kind}" ` +
    `style="display:block;width:${iconInner}px;height:${iconInner}px;border:0;outline:none;text-decoration:none;" />` +
    `</td></tr></table>`
  );
}

function renderSocial(
  b: Extract<SignatureBlock, { type: "social" }>,
  t: SignatureTheme
): string {
  if (b.networks.length === 0) return "";
  const size = b.size ?? 24;
  const style = b.style ?? "filled";
  const cells = b.networks
    .map(
      (n) =>
        `<td style="padding-right:6px;"><a href="${esc(n.url)}" style="text-decoration:none;color:${t.accent};">${socialIcon(n.kind, size, style, t.accent, n.iconUrl, n.brandColor)}</a></td>`
    )
    .join("");
  return (
    rowOpen(t) +
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:4px;"><tr>${cells}</tr></table>` +
    rowClose
  );
}

function renderBanner(
  b: Extract<SignatureBlock, { type: "banner" }>,
  t: SignatureTheme
): string {
  // Honour explicit width/height when set; otherwise fall back to 100%
  // fluid + auto-height (preserves the image's natural aspect ratio).
  // Both the HTML width/height attributes AND inline CSS are emitted —
  // Outlook on Windows reads the attributes, Gmail / Apple Mail read the
  // CSS. This is the standard bulletproof-image recipe.
  const fixedWidth = !!(b.width && b.width > 0);
  const fixedHeight = !!(b.height && b.height > 0);

  const widthAttr = fixedWidth ? `width="${b.width}"` : `width="100%"`;
  const heightAttr = fixedHeight ? ` height="${b.height}"` : "";
  const widthCss = fixedWidth
    ? `width:${b.width}px;max-width:100%;`
    : `width:100%;max-width:100%;`;
  const heightCss = fixedHeight ? `height:${b.height}px;` : `height:auto;`;

  const img = `<img src="${esc(b.url)}" alt="${esc(b.alt || "")}" ${widthAttr}${heightAttr} style="display:block;${widthCss}${heightCss}border:0;outline:none;text-decoration:none;" />`;
  const inner = b.link
    ? `<a href="${esc(b.link)}" style="display:block;text-decoration:none;line-height:0;">${img}</a>`
    : img;
  return (
    rowOpen(t) +
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td style="padding:8px 0;">${inner}</td></tr></table>` +
    rowClose
  );
}

function renderDivider(b: Extract<SignatureBlock, { type: "divider" }>, t: SignatureTheme): string {
  const color = b.color || "#e2e8f0";
  const thickness = b.thickness || 1;
  return (
    rowOpen(t) +
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td style="padding:6px 0;border-top:${thickness}px solid ${color};font-size:0;line-height:0;mso-line-height-rule:exactly;">&nbsp;</td></tr></table>` +
    rowClose
  );
}

function renderSpacer(b: Extract<SignatureBlock, { type: "spacer" }>, t: SignatureTheme): string {
  return (
    rowOpen(t) +
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td height="${b.height}" style="height:${b.height}px;font-size:0;line-height:0;mso-line-height-rule:exactly;">&nbsp;</td></tr></table>` +
    rowClose
  );
}

function renderCustom(b: Extract<SignatureBlock, { type: "custom" }>, t: SignatureTheme): string {
  return rowOpen(t) + b.html + rowClose;
}

/** Render a leaf block — produces a single <tr> for the outer table. */
function renderLeaf(b: SignatureLeafBlock, t: SignatureTheme): string {
  switch (b.type) {
    case "avatar":
      return renderAvatar(b, t);
    case "name":
      return renderName(b, t);
    case "title":
      return renderTitle(b, t);
    case "company":
      return renderCompany(b, t);
    case "contact":
      return renderContact(b, t);
    case "social":
      return renderSocial(b, t);
    case "banner":
      return renderBanner(b, t);
    case "divider":
      return renderDivider(b, t);
    case "spacer":
      return renderSpacer(b, t);
    case "custom":
      return renderCustom(b, t);
  }
}

/**
 * Render a Row block — produces one <tr> in the outer table; the cell
 * contains a nested <table> with one <td> per column. Each column hosts
 * its child blocks via their own nested <table>, so column-local rows
 * stack as expected. Outlook-safe: every cell has an explicit `width`
 * attribute + inline `width` CSS, and `valign="top"` is on every <td>.
 */
function renderRow(b: SignatureRowBlock, t: SignatureTheme): string {
  const widths = normaliseWidths(b.columns.map((c) => c.width));
  const gutter = b.gutter ?? 12;
  const valign = b.verticalAlign ?? "top";
  const cells = b.columns
    .map((col, i) => {
      const inner = col.blocks.length
        ? col.blocks.map((c) => renderLeaf(c, t)).join("")
        : `<tr><td style="font-size:0;line-height:0;mso-line-height-rule:exactly;">&nbsp;</td></tr>`;
      // Per-column override wins over the row-wide gutter. Last column
      // always closes flush. Floor at 0 so negatives don't sneak through.
      const padRight =
        i < b.columns.length - 1
          ? Math.max(0, col.gapAfter ?? gutter)
          : 0;
      const w = widths[i];
      return `<td width="${w.toFixed(2)}%" valign="${valign}" style="vertical-align:${valign};width:${w.toFixed(2)}%;padding-right:${padRight}px;word-break:break-word;overflow-wrap:break-word;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;table-layout:fixed;">${inner}</table>
      </td>`;
    })
    .join("");
  return (
    rowOpen(t) +
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;"><tr>${cells}</tr></table>` +
    rowClose
  );
}

function normaliseWidths(input: number[]): number[] {
  const safe = input.map((w) => Math.max(5, w));
  const sum = safe.reduce((a, b) => a + b, 0) || 1;
  return safe.map((w) => (w / sum) * 100);
}

export function renderSignatureHtml(doc: SignatureDoc): string {
  const t = doc.theme;
  const rows = doc.blocks
    .map((b) => (b.type === "row" ? renderRow(b, t) : renderLeaf(b, t)))
    .join("");
  return [
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;width:100%;max-width:${t.maxWidth}px;font-family:${t.fontFamily};color:${t.text};">`,
    rows,
    `</table>`,
  ].join("");
}

/**
 * Wrap the signature block in a complete HTML document — used by the
 * preview iframe + the Copy / Download paths.
 */
export function renderSignatureDocument(doc: SignatureDoc): string {
  return `<!doctype html>
<html><body style="margin:0;padding:16px;background:#ffffff;">${renderSignatureHtml(doc)}</body></html>`;
}
