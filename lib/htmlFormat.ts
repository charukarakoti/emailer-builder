// =============================================================================
// lib/htmlFormat.ts — tiny built-in HTML pretty-printer.
//
// Goals:
//   • No external dependencies (Prettier would balloon the bundle).
//   • Stable, predictable output: each opening tag on its own line, with
//     indented children, void/inline tags kept on the same line as their
//     parent when they have only text content.
//   • Preserves <pre>, <script>, <style> content verbatim (so the email
//     HTML — which often contains hand-tuned inline styles — survives a
//     round trip without losing whitespace).
//
// The formatter is intentionally tolerant — it does NOT enforce valid
// HTML. It re-indents what you give it. Use it as a comfort layer, not a
// validator.
// =============================================================================

const VOID_TAGS = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);

// Tags whose inner whitespace must be preserved exactly.
const RAW_TAGS = new Set(["pre", "script", "style", "textarea"]);

interface Token {
  kind: "open" | "close" | "self" | "text" | "comment" | "doctype" | "cdata";
  raw: string;
  /** Lowercased tag name for open/close/self. */
  tag?: string;
}

function tokenise(src: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  while (i < src.length) {
    if (src.startsWith("<!--", i)) {
      const end = src.indexOf("-->", i + 4);
      const stop = end === -1 ? src.length : end + 3;
      out.push({ kind: "comment", raw: src.slice(i, stop) });
      i = stop;
      continue;
    }
    if (src.startsWith("<!", i) || src.startsWith("<?", i)) {
      const end = src.indexOf(">", i);
      const stop = end === -1 ? src.length : end + 1;
      out.push({ kind: "doctype", raw: src.slice(i, stop) });
      i = stop;
      continue;
    }
    if (src[i] === "<") {
      const end = src.indexOf(">", i);
      const stop = end === -1 ? src.length : end + 1;
      const raw = src.slice(i, stop);
      const closing = raw.startsWith("</");
      const inner = raw.slice(closing ? 2 : 1, raw.endsWith("/>") ? -2 : -1);
      const tag = (inner.match(/^([a-zA-Z][\w-]*)/)?.[1] || "").toLowerCase();
      const selfClose = raw.endsWith("/>") || VOID_TAGS.has(tag);
      out.push({
        kind: closing ? "close" : selfClose ? "self" : "open",
        raw,
        tag,
      });
      i = stop;

      // Raw-content elements: capture everything verbatim up to the close.
      if (!closing && !selfClose && RAW_TAGS.has(tag)) {
        const closeIdx = src.toLowerCase().indexOf(`</${tag}`, i);
        const textEnd = closeIdx === -1 ? src.length : closeIdx;
        const text = src.slice(i, textEnd);
        if (text) out.push({ kind: "text", raw: text });
        i = textEnd;
      }
      continue;
    }
    // Text run until the next tag.
    const next = src.indexOf("<", i);
    const stop = next === -1 ? src.length : next;
    const text = src.slice(i, stop);
    if (text.trim() || text.includes("\n")) {
      out.push({ kind: "text", raw: text });
    }
    i = stop;
  }
  return out;
}

const INDENT = "  ";

export function formatHtml(input: string): string {
  if (!input || !input.trim()) return input;
  const tokens = tokenise(input);
  const out: string[] = [];
  let depth = 0;
  let inRaw = false;

  const pad = (n: number) => INDENT.repeat(Math.max(0, n));

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];

    if (inRaw) {
      if (t.kind === "close" && RAW_TAGS.has(t.tag || "")) {
        out.push(t.raw);
        inRaw = false;
        depth = Math.max(0, depth - 1);
      } else {
        out[out.length - 1] = (out[out.length - 1] || "") + t.raw;
      }
      continue;
    }

    if (t.kind === "doctype" || t.kind === "comment") {
      out.push(pad(depth) + t.raw);
      continue;
    }

    if (t.kind === "self") {
      out.push(pad(depth) + t.raw);
      continue;
    }

    if (t.kind === "open") {
      // If this open tag is immediately followed by a text run and then a
      // matching close tag (i.e. element with only text content), collapse
      // onto one line: <p>hello</p>
      const next = tokens[i + 1];
      const after = tokens[i + 2];
      if (
        next?.kind === "text" &&
        after?.kind === "close" &&
        after.tag === t.tag &&
        !next.raw.includes("\n")
      ) {
        out.push(pad(depth) + t.raw + next.raw.trim() + after.raw);
        i += 2;
        continue;
      }
      out.push(pad(depth) + t.raw);
      if (RAW_TAGS.has(t.tag || "")) {
        // Push a placeholder line that subsequent raw text appends to.
        out.push(pad(depth + 1));
        inRaw = true;
      }
      depth++;
      continue;
    }

    if (t.kind === "close") {
      depth = Math.max(0, depth - 1);
      out.push(pad(depth) + t.raw);
      continue;
    }

    if (t.kind === "text") {
      const text = t.raw.trim();
      if (text) out.push(pad(depth) + text);
      continue;
    }
  }

  return out.join("\n");
}
