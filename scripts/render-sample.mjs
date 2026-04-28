// =============================================================================
// render-sample.mjs — v3.1
// -----------------------------------------------------------------------------
// Bundles lib/types.ts + lib/htmlGenerator.ts via esbuild, builds a sample
// EmailDocument that exercises the new v3.1 features (right alignment,
// 4-column layout, section borders, rich text + lists, button) and writes
// the resulting email-safe HTML to /sessions/peaceful-friendly-sagan/mnt/outputs/sample-email-output.html
// =============================================================================
import { build } from "esbuild";
import { writeFileSync, mkdtempSync, readFileSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { pathToFileURL } from "url";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const OUT_HTML = "/sessions/peaceful-friendly-sagan/mnt/outputs/sample-email-output.html";

// 1. Bundle TS to a temporary ESM module we can import directly.
const tmp = mkdtempSync(path.join(tmpdir(), "email-builder-render-"));
await build({
  entryPoints: [path.join(ROOT, "lib/htmlGenerator.ts")],
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node18",
  outdir: tmp,
  write: true,
  logLevel: "warning",
});
const builtPath = path.join(tmp, "htmlGenerator.js");
// esbuild may emit `import "./types"` which Node won't resolve — rewrite.
let built = readFileSync(builtPath, "utf8");
built = built.replace(/from\s+["']\.\/types["']/g, 'from "./types.js"');
writeFileSync(builtPath, built);

const { generateEmailHtml } = await import(pathToFileURL(builtPath).href);

// 2. Import factories from types.ts the same way.
await build({
  entryPoints: [path.join(ROOT, "lib/types.ts")],
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node18",
  outdir: tmp,
  write: true,
  logLevel: "warning",
});
const types = await import(pathToFileURL(path.join(tmp, "types.js")).href);
const {
  newDocument,
  newSection,
  newTextBlock,
  newImageBlock,
  newButtonBlock,
  newSpacerBlock,
  newDividerBlock,
  p,
} = types;

// 3. Build a v3.1 sample doc.
const doc = newDocument();

// META — right alignment + template border + light radius
doc.meta.subject = "v3.1 demo — right-aligned, 4-col, persistent history";
doc.meta.preheader = "v3.1 ships persistent history, 3/4-col, right alignment.";
doc.meta.alignment = "right";
doc.meta.backgroundColor = "#0f172a";
doc.meta.contentBackground = "#ffffff";
doc.meta.border = { width: "1px", style: "solid", color: "#1e293b" };
doc.meta.borderRadius = "8";

// --- Header (1 col) ----------------------------------------------------------
const header = newSection("1");
header.style.backgroundColor = "#0f172a";
header.style.padding = p("28px", "24px");
header.columns[0].blocks = [
  {
    ...newTextBlock(),
    content:
      "<strong>Email Builder v3.1</strong><br/>Now with persistent undo, 3 &amp; 4-col layouts, and three-way alignment.",
    style: {
      ...newTextBlock().style,
      color: "#ffffff",
      fontSize: "22px",
      textAlign: "center",
      fontWeight: "700",
      lineHeight: "1.3",
      padding: p("0"),
    },
  },
];

// --- 4-column feature row (the big new layout) -------------------------------
const four = newSection("25-25-25-25");
four.style.padding = p("24px", "20px");
four.style.gutter = "12px";
four.style.border = { width: "1px", style: "dashed", color: "#cbd5e1" };
four.style.borderRadius = "6";

const featureCol = (icon, title, body) => ({
  blocks: [
    {
      ...newTextBlock(),
      content: `<strong>${icon} ${title}</strong><br/>${body}`,
      style: {
        ...newTextBlock().style,
        fontSize: "13px",
        lineHeight: "1.4",
        textAlign: "left",
        padding: p("4px", "6px"),
        color: "#0f172a",
      },
    },
  ],
});

four.columns = [
  featureCol("⌘Z", "Persistent undo", "History survives reloads, capped at 50 steps."),
  featureCol("⇆", "3 &amp; 4 col", "New layouts wired into UI, store, &amp; export."),
  featureCol("⫷⫸", "Alignment", "Left, center, or right — applied on export."),
  featureCol("⧉", "Duplicate", "One-click block + section duplication."),
];

// --- Divider (new in v3.2) ---------------------------------------------------
const dividerSec = newSection("1");
dividerSec.style.padding = p("0", "20px");
dividerSec.style.backgroundColor = "#ffffff";
dividerSec.columns[0].blocks = [
  {
    ...newDividerBlock(),
    style: {
      ...newDividerBlock().style,
      thickness: "2px",
      color: "#cbd5e1",
      width: "60%",
      align: "center",
      padding: p("8px", "0"),
    },
  },
];

// --- 3-column rich-text + list row (shows rich text rules) -------------------
const three = newSection("33-33-33");
three.style.padding = p("8px", "20px");
three.columns[0].blocks = [
  {
    ...newTextBlock(),
    content:
      "<strong>Rich text</strong><ul><li>Bold &amp; <a href='https://anthropic.com'>links</a></li><li>Bulleted lists</li><li>Numbered lists</li></ul>",
    style: { ...newTextBlock().style, fontSize: "13px", padding: p("8px") },
  },
];
three.columns[1].blocks = [
  {
    ...newTextBlock(),
    content:
      "<strong>Steps</strong><ol><li>Edit text</li><li>Drag a block</li><li>Hit ⌘Z to undo</li></ol>",
    style: { ...newTextBlock().style, fontSize: "13px", padding: p("8px") },
  },
];
three.columns[2].blocks = [
  {
    ...newTextBlock(),
    content:
      "<strong>Try it</strong><br/>Drag any block, then reload the page. Your edit history survives.",
    style: { ...newTextBlock().style, fontSize: "13px", padding: p("8px") },
  },
];

// --- 50/50 with image + CTA --------------------------------------------------
const split = newSection("50-50");
split.style.padding = p("16px", "20px");
split.style.gutter = "16px";
split.columns[0].blocks = [
  {
    ...newImageBlock(),
    src: "https://via.placeholder.com/280x180?text=v3.1",
    alt: "Email Builder v3.1 hero",
    style: { width: "280", align: "center", padding: p("0") },
  },
];
split.columns[1].blocks = [
  {
    ...newTextBlock(),
    content:
      "<strong>Bulletproof export</strong><br/>HTML opens in your browser with the chosen page alignment honored — center, left, or right.",
    style: { ...newTextBlock().style, fontSize: "14px", padding: p("4px", "0") },
  },
  {
    ...newButtonBlock(),
    content: "Download HTML",
    href: "https://example.com/download",
    style: {
      ...newButtonBlock().style,
      backgroundColor: "#2563eb",
      color: "#ffffff",
      align: "left",
      paddingY: "10px",
      paddingX: "20px",
      borderRadius: "6px",
      containerPadding: p("8px", "0"),
    },
  },
];

// --- Footer spacer + small print --------------------------------------------
const footer = newSection("1");
footer.style.backgroundColor = "#f1f5f9";
footer.style.padding = p("16px", "20px");
footer.columns[0].blocks = [
  { ...newSpacerBlock(), style: { height: "8px" } },
  {
    ...newTextBlock(),
    content:
      "Sent from the v3.1 builder. <a href='https://example.com/unsub'>Unsubscribe</a>.",
    style: {
      ...newTextBlock().style,
      fontSize: "11px",
      textAlign: "center",
      color: "#64748b",
      padding: p("0"),
      linkColor: "#2563eb",
    },
  },
];

doc.sections = [header, four, dividerSec, three, split, footer];

// 4. Render and write.
const html = generateEmailHtml(doc);
writeFileSync(OUT_HTML, html, "utf8");
console.log("Wrote", OUT_HTML, `(${html.length} bytes)`);
