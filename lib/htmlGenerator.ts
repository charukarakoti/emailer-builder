// =============================================================================
// HTML GENERATOR v3 — JSON → email-safe HTML
// -----------------------------------------------------------------------------
// Rules (unchanged):
//   - Table-based layout only (role="presentation", border=0, cellpadding=0, cellspacing=0)
//   - Inline CSS only, no classes, no <style>
//   - No margin / flex / grid
//   - Padding-only spacing
//   - Images: width + display:block + border:0 + alt
// -----------------------------------------------------------------------------
// New in v3:
//   - meta.alignment: wrapper <td align="center"|"left">
//   - meta.border / section.border: inline border on outer/section tables
//   - meta.borderRadius / section.borderRadius: clamped to 0–8px
//   - Text: <ul>/<ol>/<li> rendered with inline styles (padding-left for indent)
//     Note: border-radius is honored by Gmail but ignored by older Outlook.
// =============================================================================

import type {
  EmailDocument,
  Section,
  Column,
  Block,
  TextBlock,
  ImageBlock,
  ButtonBlock,
  SpacerBlock,
  DividerBlock,
  Border,
} from "./types";
import { sanitizeRichText, paddingToCss, borderToCss } from "./types";

// --- helpers ----------------------------------------------------------------
const escHtml = (s: string) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const escAttr = (s: string) => escHtml(s);
const toCss = (k: string) => k.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase());
const inline = (o: Record<string, string | number | undefined>) =>
  Object.entries(o)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${toCss(k)}:${v}`)
    .join(";");

const safeRadius = (r: string) => {
  const n = parseInt(r, 10);
  if (isNaN(n)) return "0px";
  return `${Math.max(0, Math.min(8, n))}px`;
};
const parsePx = (v: string) => {
  const n = parseInt(v, 10);
  return isNaN(n) ? 0 : n;
};

/**
 * For every <a> in rich text: strip any pre-existing style, add inline
 * color + underline, inject target="_blank" if missing.
 */
function injectLinkStyle(html: string, color: string): string {
  const style = `color:${color};text-decoration:underline;`;
  let out = html.replace(
    /<a\b([^>]*?)\sstyle\s*=\s*"[^"]*"([^>]*)>/gi,
    "<a$1$2>"
  );
  out = out.replace(/<a\b([^>]*)>/gi, (_m, attrs) => {
    const a = String(attrs).trim();
    const target = /target\s*=/i.test(a) ? "" : ' target="_blank"';
    return `<a${a ? " " + a : ""}${target} style="${style}">`;
  });
  return out;
}

/**
 * Apply inline styles to <ul>/<ol>/<li> so lists render consistently in
 * Gmail and Outlook without relying on external CSS.
 *   - padding-left for indent (bullet room)
 *   - padding:0 top/bottom on <ul>/<ol>
 *   - li inline font inherits from parent <td>; we nudge with small padding-bottom
 */
function styleLists(html: string): string {
  const ulStyle = "padding:0 0 0 20px;";
  const olStyle = "padding:0 0 0 22px;";
  const liStyle = "padding:0 0 4px 0;";
  return html
    .replace(/<ul>/gi, `<ul style="${ulStyle}">`)
    .replace(/<ol>/gi, `<ol style="${olStyle}">`)
    .replace(/<li>/gi, `<li style="${liStyle}">`);
}

// =============================================================================
// Block renderers
// =============================================================================

function renderText(b: TextBlock): string {
  const s = b.style;
  // mso-line-height-rule:exactly forces Outlook to honor lineHeight instead
  // of falling back to "single" — fixes weird vertical spacing on Windows.
  const tdStyle = inline({
    padding: paddingToCss(s.padding),
    fontFamily: s.fontFamily,
    fontSize: s.fontSize,
    lineHeight: s.lineHeight,
    color: s.color,
    fontWeight: s.fontWeight,
    textAlign: s.textAlign,
    msoLineHeightRule: "exactly",
  });
  let content = sanitizeRichText(b.content);
  content = injectLinkStyle(content, s.linkColor);
  content = styleLists(content);
  return `<tr><td align="${s.textAlign}" valign="top" style="${tdStyle}">${content}</td></tr>`;
}

function renderImage(b: ImageBlock): string {
  const s = b.style;
  const imgStyle = inline({
    display: "block",
    border: borderToCss(s.border) || "0",
    outline: "none",
    textDecoration: "none",
    maxWidth: "100%",
    height: "auto",
    borderRadius: s.borderRadius || undefined,
  });
  const img = `<img src="${escAttr(b.src)}" alt="${escAttr(b.alt)}" width="${escAttr(
    s.width
  )}" style="${imgStyle}" />`;
  const wrapped = b.href
    ? `<a href="${escAttr(b.href)}" target="_blank" style="text-decoration:none;">${img}</a>`
    : img;
  return `<tr><td align="${s.align}" style="${inline({
    padding: paddingToCss(s.padding),
    fontSize: "0",
    lineHeight: "0",
  })}">${wrapped}</td></tr>`;
}

function renderButton(b: ButtonBlock): string {
  const s = b.style;
  const radiusPx = safeRadius(s.borderRadius);
  const radiusInt = parseInt(radiusPx, 10) || 0;
  // Approximate width for VML so Outlook draws a real rectangle.
  // (Outlook on Windows ignores CSS padding inside <a>, which is why the
  //  button degraded to a blue underlined link before.)
  const padX = parsePx(s.paddingX);
  const padY = parsePx(s.paddingY);
  const fontSize = parsePx(s.fontSize) || 14;
  const approxTextW = Math.round(fontSize * 0.6 * b.content.length);
  const vmlW = approxTextW + padX * 2;
  const vmlH = fontSize + padY * 2;

  const linkStyle = inline({
    display: "inline-block",
    fontFamily: "Arial, Helvetica, sans-serif",
    fontSize: s.fontSize,
    fontWeight: s.fontWeight,
    color: s.color,
    backgroundColor: s.backgroundColor,
    textDecoration: "none",
    padding: `${s.paddingY} ${s.paddingX}`,
    borderRadius: radiusPx,
    msoPaddingAlt: "0",
    lineHeight: "1.2",
  });

  // VML rect shows in Outlook 2007–2019 desktop. The <a> still serves as the
  // click target, but Outlook fills the rect using fillcolor + arcsize.
  const arcsize = Math.min(50, Math.round((radiusInt / vmlH) * 100));
  const vml =
    `<!--[if mso]>` +
    `<v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${escAttr(
      b.href
    )}" style="height:${vmlH}px;v-text-anchor:middle;width:${vmlW}px;" arcsize="${arcsize}%" stroke="f" fillcolor="${escAttr(
      s.backgroundColor
    )}">` +
    `<w:anchorlock/>` +
    `<center style="color:${escAttr(s.color)};font-family:Arial,Helvetica,sans-serif;font-size:${escAttr(
      s.fontSize
    )};font-weight:${escAttr(s.fontWeight)};">${escHtml(b.content)}</center>` +
    `</v:roundrect>` +
    `<![endif]-->`;

  // Non-Outlook (Gmail/Apple/web/iOS): real CSS button with rounded corners.
  const fallback =
    `<!--[if !mso]><!-->` +
    `<a href="${escAttr(b.href)}" target="_blank" style="${linkStyle}">${escHtml(b.content)}</a>` +
    `<!--<![endif]-->`;

  const btn =
    `<table role="presentation" border="0" cellpadding="0" cellspacing="0" style="border-collapse:separate;">` +
    `<tr><td align="center" bgcolor="${escAttr(s.backgroundColor)}" style="${inline({
      borderRadius: radiusPx,
      backgroundColor: s.backgroundColor,
    })}">` +
    vml +
    fallback +
    `</td></tr></table>`;
  return `<tr><td align="${s.align}" valign="top" style="${inline({
    padding: paddingToCss(s.containerPadding),
  })}">${btn}</td></tr>`;
}

function renderSpacer(b: SpacerBlock): string {
  const s = b.style;
  return `<tr><td style="${inline({
    fontSize: "0",
    lineHeight: s.height,
    height: s.height,
    backgroundColor: s.backgroundColor,
  })}" height="${parsePx(s.height)}">&nbsp;</td></tr>`;
}

function renderDivider(b: DividerBlock): string {
  const s = b.style;
  // Use a single-cell table so width / align behave bulletproof in Outlook.
  // The cell's bottom-border draws the line at exactly `thickness`.
  const widthAttr = s.width.endsWith("%")
    ? `width="${escAttr(s.width)}"`
    : `width="${escAttr(parsePx(s.width).toString())}"`;
  const inner =
    `<table role="presentation" border="0" cellpadding="0" cellspacing="0" ${widthAttr} align="${s.align}" style="${inline(
      {
        width: s.width,
        borderCollapse: "collapse",
      }
    )}">` +
    `<tr><td style="${inline({
      fontSize: "0",
      lineHeight: "0",
      borderTop: `${s.thickness} solid ${s.color}`,
      height: s.thickness,
    })}" height="${parsePx(s.thickness)}">&nbsp;</td></tr>` +
    `</table>`;
  return `<tr><td align="${s.align}" style="${inline({
    padding: paddingToCss(s.padding),
    fontSize: "0",
    lineHeight: "0",
  })}">${inner}</td></tr>`;
}

function renderBlock(b: Block): string {
  switch (b.type) {
    case "text":
      return renderText(b);
    case "image":
      return renderImage(b);
    case "button":
      return renderButton(b);
    case "spacer":
      return renderSpacer(b);
    case "divider":
      return renderDivider(b);
  }
}

function renderColumnInner(col: Column): string {
  return (
    `<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">` +
    (col?.blocks || []).map(renderBlock).join("") +
    `</table>`
  );
}

// =============================================================================
// Section renderer (with border + radius support)
// =============================================================================

/**
 * Pixel widths per column for any v3 layout. Always returns N integers
 * that sum to ≤ inner (rounding remainder absorbed by the last column).
 */
function columnWidths(
  layout: Section["style"]["columnLayout"],
  inner: number
): number[] {
  if (layout === "1") return [inner];
  if (layout === "50-50")
    return [Math.floor(inner / 2), Math.ceil(inner / 2)];
  if (layout === "60-40")
    return [Math.round(inner * 0.6), Math.round(inner * 0.4)];
  if (layout === "33-33-33") {
    const t = Math.floor(inner / 3);
    return [t, t, inner - 2 * t];
  }
  if (layout === "25-25-25-25") {
    const q = Math.floor(inner / 4);
    return [q, q, q, inner - 3 * q];
  }
  return [inner];
}

/** Per-column padding shorthand for column i in an N-column section. */
function colPad(i: number, n: number, gutter: number) {
  const half = Math.floor(gutter / 2);
  const left = i === 0 ? 0 : half;
  const right = i === n - 1 ? 0 : Math.ceil(gutter / 2);
  return `0 ${right}px 0 ${left}px`;
}

function renderSection(sec: Section, contentWidth: number): string {
  const s = sec.style;
  const borderCss = borderToCss(s.border);
  const radius = safeRadius(s.borderRadius);

  const tdStyle = inline({
    padding: paddingToCss(s.padding),
    backgroundColor: s.backgroundColor,
    border: borderCss,
    borderRadius: radius !== "0px" ? radius : undefined,
  });

  // bgcolor attribute on the section TD — many Outlook builds drop the CSS
  // background-color but honor the legacy attribute, which avoids the
  // "section turned white" symptom users hit when pasting into Outlook.
  const bgAttr = s.backgroundColor ? ` bgcolor="${escAttr(s.backgroundColor)}"` : "";

  const innerWidth =
    contentWidth - parsePx(s.padding.left) - parsePx(s.padding.right);
  const sectionVAlign = s.verticalAlign || "top";

  let inner: string;
  if (s.columnLayout === "1") {
    inner =
      `<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">` +
      `<tr><td valign="${sectionVAlign}" style="padding:0;">${renderColumnInner(
        sec.columns[0] || { blocks: [] }
      )}</td></tr></table>`;
  } else {
    const widths = columnWidths(s.columnLayout, innerWidth);
    const n = widths.length;
    const g = parsePx(s.gutter);
    const tdInner = (i: number) =>
      inline({ padding: colPad(i, n, g), verticalAlign: sectionVAlign });

    const parts: string[] = [];
    // Outlook scaffold: open outer table, <tr>, and the FIRST <td>.
    parts.push(
      `<!--[if mso | IE]><table role="presentation" border="0" cellpadding="0" cellspacing="0" width="${innerWidth}"><tr><td width="${widths[0]}" valign="${sectionVAlign}" style="${tdInner(
        0
      )}"><![endif]-->`
    );

    for (let i = 0; i < n; i++) {
      const col = sec.columns[i] || { blocks: [] };
      // Non-Outlook: align="left" pixel-width table per column
      parts.push(
        `<table role="presentation" border="0" cellpadding="0" cellspacing="0" align="left" width="${widths[i]}" style="width:${widths[i]}px;max-width:100%;border-collapse:collapse;"><tr><td valign="${sectionVAlign}" style="${tdInner(
          i
        )}">${renderColumnInner(col)}</td></tr></table>`
      );
      // Outlook: close current td + open next td, or close the whole table.
      if (i < n - 1) {
        parts.push(
          `<!--[if mso | IE]></td><td width="${widths[i + 1]}" valign="${sectionVAlign}" style="${tdInner(
            i + 1
          )}"><![endif]-->`
        );
      } else {
        parts.push(`<!--[if mso | IE]></td></tr></table><![endif]-->`);
      }
    }

    inner = parts.join("");
  }

  return `<tr><td align="center" valign="top"${bgAttr} style="${tdStyle}">${inner}</td></tr>`;
}

// =============================================================================
// Document renderer (with alignment + template border + radius)
// =============================================================================

export function generateEmailHtml(doc: EmailDocument): string {
  const { meta, sections } = doc;
  const width = meta.contentWidth || 600;
  const sectionsHtml = sections.map((s) => renderSection(s, width)).join("");

  const preheader = meta.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#ffffff;">${escHtml(
        meta.preheader
      )}</div>`
    : "";

  const wrapperAlign: "left" | "center" | "right" =
    meta.alignment === "left" || meta.alignment === "right"
      ? meta.alignment
      : "center";
  const innerBorder = borderToCss(meta.border);
  const innerRadius = safeRadius(meta.borderRadius);
  const innerStyle = inline({
    width: `${width}px`,
    maxWidth: "100%",
    backgroundColor: meta.contentBackground,
    borderCollapse: "collapse",
    border: innerBorder,
    borderRadius: innerRadius !== "0px" ? innerRadius : undefined,
  });

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office" lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta http-equiv="X-UA-Compatible" content="IE=edge"/>
<meta name="x-apple-disable-message-reformatting"/>
<title>${escHtml(meta.subject || "")}</title>
<!--[if mso]>
<xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch><o:AllowPNG/></o:OfficeDocumentSettings></xml>
<![endif]-->
</head>
<body bgcolor="${escAttr(meta.backgroundColor)}" style="margin:0;padding:0;background-color:${escAttr(meta.backgroundColor)};">
${preheader}
<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" bgcolor="${escAttr(
    meta.backgroundColor
  )}" style="background-color:${escAttr(
    meta.backgroundColor
  )};border-collapse:collapse;">
<tr><td align="${wrapperAlign}" valign="top" style="padding:0;">
<!--[if mso]><table role="presentation" border="0" cellpadding="0" cellspacing="0" width="${width}" align="${wrapperAlign}"><tr><td><![endif]-->
<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="${width}" align="${wrapperAlign}" bgcolor="${escAttr(
    meta.contentBackground
  )}" style="${innerStyle}">
${sectionsHtml}
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr>
</table>
</body>
</html>`;
}
