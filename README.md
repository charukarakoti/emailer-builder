# Email Builder — v3.3

Drag-and-drop email builder that outputs clean, **table-based, inline-CSS** HTML compatible with Gmail and Outlook. v3.3 introduces the **📨 Outlook draft (.eml)** export — Outlook opens it as a fully-formatted compose window with no paste required — and fixes "Save as template" so it never silently overwrites an earlier template.

## What's new in v3.3

- **📨 Outlook draft (.eml) export** — toolbar button generates an RFC 822 `.eml` with `X-Unsent: 1`. Double-click in Windows / Mac and Outlook opens a fresh compose window with your designed email pre-formatted in the body. **No paste, no "Keep Source Formatting" menu, no Outlook editor mangling.** Implemented as `buildEml(subject, html)` in `components/TopBar.tsx`. Round-trips UTF-8 cleanly via base64 with 76-char line wrapping.
- **Save-as-template no longer overwrites** — `saveUserTemplate()` now always creates a new entry; if the name collides it appends ` (2)`, ` (3)`, etc. The earlier "I made a new template but the old one shows up" bug came from the prompt suggesting the loaded template's `meta.subject` as the default name, then silently overwriting the previous save in place.
- **Inline Save dialog with canvas summary** — replaces the native `window.prompt`. Shows the current canvas's subject, section count, block count, and alignment so you can see exactly what's being saved before committing.
- **Drag visibility** — `BuilderDndProvider` now renders a `<DragOverlay>` that follows the cursor with a labeled chip (`Add: Text — drop into a column`, `§2 ⇅ Moving section`). Column drop targets light up with a 3px dashed outline, ring, and "Drop in col N" badge.
- **Outlook hardening on the generator side** — `bgcolor=` attributes alongside CSS background colors, `valign="top"` on every section / column / block TD, `mso-line-height-rule:exactly` on text TDs, and a **VML `roundrect`** for buttons inside `<!--[if mso]>…<![endif]-->` so Outlook on Windows draws a real rectangle instead of an underlined blue link.

## What's new in v3.2

- **Cross-column / cross-section block drag** — pick up any block, drop it into a different column, into a different section, or onto an empty column drop zone. The store gets a new `moveBlockCross(srcSec, srcCol, blockId, dstSec, dstCol, dstIndex)` action that detaches the block from the source and inserts it at the destination index. Drops onto another block insert *at* that block's position; drops onto an empty column drop zone append.
- **Section drag-to-reorder** — every section now exposes a `§N ⇅` handle in the gutter. Drag the handle to reorder sections; the rest of the section continues to behave as before (clicks select, blocks inside still drag independently). The handle's `pointerdown` is stopped on the click handler so dragging never accidentally deselects.
- **Block registry — `lib/blockRegistry.ts`** — a single map keyed by `BlockType` that owns the palette label, icon, sort order, and factory for every block. `LeftPanel` reads its palette from `blockPalette()`, `store.newBlockOf(type)` dispatches via the registry, and the registry is the documented place to add new block types. The `Block` discriminated union still lives in `lib/types.ts` for type narrowing.
- **Divider block** (new) — thin line, configurable thickness, color, width (`100%` or fixed px), alignment, and padding. The HTML renderer emits a single-cell table with `border-top` (bulletproof in Gmail and Outlook).
- **"Save current as template…"** — the Templates dropdown now has an "✨ Actions" optgroup with a save action (also available as a 💾 button next to the dropdown). User templates persist to `localStorage:email-builder:user-templates:v3` and are listed under "My templates"; a "Delete saved" optgroup lets you remove them. Built-in templates are unchanged.

## What v3.1 / v3 introduced (still here)

- Whole block is draggable with `cursor: grab` + `touch-action: none`; PointerSensor 5px activation distance separates clicks from drags.
- Persistent undo / redo (capped at 50 history entries) — full state restored across reloads.
- 5 column layouts: 1, 50/50, 60/40, 3, 4. N-column MSO scaffolding.
- 3-way alignment (`left | center | right`) honored on export.
- Block + section duplication.
- iframe preview modal (Desktop / Mobile) and "↗ New tab" Blob preview.
- Sanitized rich text — only `<strong>`, `<a href>`, `<br/>`, `<ul>`, `<ol>`, `<li>` survive.
- Template- and section-level borders + safe (0–8px) border-radius.
- Padding-mode toggle (unified vs TRBL).

## v3.1 changelog (legacy)

- **Block drag fixed** — the whole block body is now the drag handle (with `cursor: grab`, `touch-action: none`). PointerSensor uses a 5px activation distance, so single clicks still select but pointer-down + drag now actually moves the block. Hover toolbar buttons (⧉ duplicate, ✕ delete) stop pointer-down bubbling so they never start a drag.
- **Persistent history** — auto-save now serializes `{ doc, history, future }` to `localStorage:email-builder:state:v3` every 4 s (capped at 50 history entries). On mount, `Builder.tsx` calls `restoreState(loadState())` so undo/redo survives page reloads.
- **3 & 4 column layouts** — `ColumnLayout` adds `"33-33-33"` and `"25-25-25-25"`. The store, Canvas, palette and RightPanel switcher all expose them. The HTML generator handles N columns through an iterative MSO scaffold (open table+tr+first td → for each col, non-MSO `<table align=left>` + MSO close-current-td/open-next-td → close all on the last col).
- **Right alignment** — `meta.alignment` is now `"left" | "center" | "right"`. The Canvas always centers the editor frame for usability and surfaces a small "applied on export" hint; the generator passes the chosen value to the wrapper `<td align=…>` and the inner `<table align=…>` so the downloaded HTML opens in the browser with the alignment you chose.
- **Block duplication** — `duplicateBlock(sectionId, columnIndex, blockId)` deep-clones a block (new id) and inserts it directly after the original. Surfaced from both the Canvas hover toolbar and the RightPanel block editor header.
- **N-column safe transitions** — `changeColumnLayout` now upsizes/downsizes between any of the five layouts without losing content. Going from 4 → 1 merges every column's blocks into the first; going from 4 → 2 keeps the first two columns and overflows the rest into column 2.

## Adding a new block type

`lib/blockRegistry.ts` is the source of truth for "what blocks exist". To add a new block:

1. **Define the shape in `lib/types.ts`** — add an interface (e.g. `interface VideoBlock { id, type: "video", … }`), add it to the `Block` union, add `"video"` to the `BlockType` union, and write a factory `newVideoBlock()`.
2. **Register it in `lib/blockRegistry.ts`** — one line:

   ```ts
   video: { type: "video", label: "Video", icon: "▶", order: 4, factory: newVideoBlock },
   ```

   The palette and `newBlockOf("video")` automatically pick it up.
3. **Add a view component** — `components/blocks/VideoBlock.tsx`. Render whatever the editor canvas should show (it doesn't have to be email-safe — only the export does).
4. **Wire the view into Canvas** — add the case to `renderBlockView` in `components/Canvas.tsx`.
5. **Add an HTML renderer** — `lib/htmlGenerator.ts` adds `renderVideo(b: VideoBlock)` and a case in `renderBlock`. Keep the rendered HTML email-safe (table-based, inline CSS, no JS, no flex/grid). For media that's hard in email (real `<video>` tags don't play in most clients), render a poster image with a play-button overlay and link.
6. *(Optional)* **Add an editor section** — `components/RightPanel.tsx` adds a `{block.type === "video" && (…)}` block.

The exhaustive switches in `renderBlockView` and `renderBlock` mean TypeScript will fail loudly at any spot you forgot to wire — there's no silent fallthrough.

## What v3 introduced (still here)

- Undo / redo through a zustand history stack with keyboard shortcuts (Cmd/Ctrl+Z, Cmd/Ctrl+Shift+Z, Cmd/Ctrl+Y).
- iframe preview modal (Desktop 720px / Mobile 375px) plus "↗ New tab" that ships the generated HTML to a `Blob` URL.
- Sanitized rich text — only `<strong>`, `<a href>`, `<br/>`, `<ul>`, `<ol>`, `<li>` survive.
- Section duplication (`duplicateSection`).
- Template- and section-level borders with safe (0–8px clamped) border-radius.
- Padding-mode toggle (unified vs TRBL) producing a canonical `Padding` object.

## Run

```bash
npm install
cp .env.example .env             # fill in DATABASE_URL
npx prisma migrate dev --name init
npm run dev
```

Open http://localhost:3000. You'll land on `/login` — click "Create one" to sign up. A personal workspace is created for you on first signup.

### Sharing templates across users (team workspaces)

Templates are stored in Postgres, scoped to a **team workspace**. Anyone in the same workspace can see and clone every template; only the original author can edit or delete the templates they created.

To share with a teammate:

1. Visit `/team` and click **Create invite**. Copy the generated link.
2. Send the link to your teammate. When they sign up (or sign in and paste the invite code), they're added to your workspace.
3. Templates everyone saves now show up in the **Saved Templates** dropdown for everyone in the team.

Owners can create invites; members can join existing teams or create their own. Each user can belong to multiple teams and switch between them on the `/team` page.

### Database setup

The project uses **Postgres** via Prisma. Quick paths:

- **Local Postgres** — install Postgres, create a database, set `DATABASE_URL` to the local connection string. Run `npx prisma migrate dev`.
- **Hosted (Neon, Railway, Supabase, RDS, etc.)** — create a database, copy its connection string into `DATABASE_URL`, and run `npx prisma migrate deploy` in production.

Useful scripts:

```bash
npm run prisma:generate    # regenerate the Prisma client after schema changes
npm run prisma:migrate     # create a new migration in dev
npm run prisma:deploy      # apply migrations in production
npm run prisma:studio      # open the Prisma Studio UI
```

### Auth model

Email + password sign-in. Sessions live in the `Session` table; the cookie carries an opaque token, and only its SHA-256 hash is stored at rest. Middleware (`middleware.ts`) bounces anonymous visitors to `/login` for everything except `/login`, `/signup`, and `/api/auth/*`.

Open http://localhost:3000.

## Project structure

```
email-builder/
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   └── globals.css
├── components/
│   ├── Builder.tsx         # Shell + keyboard shortcuts + state hydrate + auto-save
│   ├── TopBar.tsx          # Templates, Undo/Redo, Preview (modal / new tab), Export
│   ├── LeftPanel.tsx       # Palette + 5 "Add section" layouts (1, 50/50, 60/40, 3, 4)
│   ├── Canvas.tsx          # Sections > columns > blocks; whole block is draggable
│   ├── RightPanel.tsx      # Email | Section | Block editor — duplicate/delete inline
│   ├── PreviewModal.tsx    # Sandboxed iframe preview
│   └── blocks/             # Visual components for the canvas only
├── lib/
│   ├── types.ts            # v3.2 schema, sanitizeRichText, paddingToCss, borderToCss, columnCountFor
│   ├── blockRegistry.ts    # Single registry of all block types — extend HERE
│   ├── htmlGenerator.ts    # JSON → email-safe HTML; N-column MSO scaffold
│   ├── store.ts            # zustand — moveBlockCross, moveSection, duplicateBlock, layout transitions
│   ├── autosave.ts         # useAutoSave / loadState — persists doc + history + future
│   ├── templates.ts        # Built-in starter templates
│   └── userTemplates.ts    # Persists user-saved templates to localStorage
└── scripts/
    └── render-sample.mjs   # Renders sample-email-output.html via esbuild bundle
```

## JSON schema (v3.1)

```jsonc
{
  "meta": {
    "subject": "Welcome",
    "preheader": "Thanks!",
    "backgroundColor": "#f3f4f6",
    "contentBackground": "#ffffff",
    "contentWidth": 600,
    "alignment": "right",                                  // "left" | "center" | "right"
    "border":  { "width": "1px", "style": "solid", "color": "#1e293b" },
    "borderRadius": "8"                                    // clamped 0–8px
  },
  "sections": [
    {
      "id": "sec_…",
      "style": {
        "backgroundColor": "#ffffff",
        "padding": { "top": "20px", "right": "20px", "bottom": "20px", "left": "20px" },
        "paddingMode": "unified",                          // UI-only hint
        "columnLayout": "25-25-25-25",                     // "1" | "50-50" | "60-40" | "33-33-33" | "25-25-25-25"
        "stackOnMobile": true,
        "gutter": "12px",
        "border": { "width": "1px", "style": "dashed", "color": "#cbd5e1" },
        "borderRadius": "6"
      },
      "columns": [
        { "blocks": [ /* col 1 */ ] },
        { "blocks": [ /* col 2 */ ] },
        { "blocks": [ /* col 3 */ ] },
        { "blocks": [ /* col 4 */ ] }
      ]
    }
  ]
}
```

`columns.length` always matches `columnCountFor(columnLayout)`. Text-block `content` is sanitized rich HTML — only `<strong>`, `<a href>`, `<br/>`, `<ul>`, `<ol>`, `<li>` survive.

## HTML generator — how it works

`lib/htmlGenerator.ts` → `generateEmailHtml(doc)`:

1. Emits DOCTYPE + an MSO head conditional (`PixelsPerInch`, `AllowPNG`).
2. Wraps the whole email in a 100%-width outer table. The outer `<td align="…">` and the inner `<table align="…">` are both driven by `meta.alignment` — `left | center | right`, so the chosen alignment renders in any browser when the downloaded HTML is opened directly.
3. Places a fixed-width (default 600px) inner container, with optional `border` and clamped `border-radius`.
4. For each section: `<tr><td>` carries section background, TRBL padding (via `paddingToCss`), inline border and radius.
5. For `columnLayout === "1"`, a single inner table of block rows.
6. For 2 / 3 / 4 columns, a generalized bulletproof N-column pattern — Outlook-only conditional with explicit `<td width>`, non-Outlook `align="left"` tables with fixed pixel widths. Gutter is split between cells via `colPad(i, n, gutter)`.
7. Rich text: `sanitizeRichText` filters tags, `injectLinkStyle` strips pre-existing link styles and injects inline `color: linkColor; text-decoration: underline;` plus `target="_blank"`, `styleLists` inlines `padding-left` on `<ul>/<ol>` and tightens spacing on `<li>`.
8. Buttons: bulletproof inner table + `bgcolor` on the td + inline-styled anchor (no external CSS).

### Column widths

```
innerWidth = contentWidth - padding.left - padding.right

widths = {
  "1":            [innerWidth],
  "50-50":        [floor(innerWidth/2), ceil(innerWidth/2)],
  "60-40":        [round(innerWidth*0.6), round(innerWidth*0.4)],
  "33-33-33":     [t, t, innerWidth - 2t]   where t = floor(innerWidth/3),
  "25-25-25-25":  [q, q, q, innerWidth - 3q] where q = floor(innerWidth/4),
}[layout]
```

The rounding remainder is always absorbed by the **last** column so the row sums to exactly `innerWidth`.

### N-column MSO scaffold

```html
<!--[if mso | IE]><table …><tr><td width="W0" valign="top" style="…"><![endif]-->

<!-- col 0: non-MSO bulletproof table -->
<table align="left" width="W0" …> … </table>
<!--[if mso | IE]></td><td width="W1" valign="top" style="…"><![endif]-->

<!-- col 1 -->
<table align="left" width="W1" …> … </table>
<!--[if mso | IE]></td><td width="W2" …><![endif]-->

<!-- … -->

<!-- last col -->
<table align="left" width="Wn-1" …> … </table>
<!--[if mso | IE]></td></tr></table><![endif]-->
```

This is the same recipe as v3's 50/50 / 60/40 generalized to any N — Outlook sees a single `<table><tr><td><td>…</td></tr></table>`, every other client sees N inline-block tables that wrap on narrow widths.

### Border-radius caveat

Radius is clamped to 0–8px. Gmail, Apple Mail, iOS Mail and modern Outlook (Mac, web, Windows 2019+) honor it. Older desktop Outlook (2007/2010/2013/2016 MSO word-engine) renders square corners — that degradation is intentional and safe.

## Persistent history

`lib/autosave.ts`:

```ts
interface PersistedState {
  doc: EmailDocument;
  history: EmailDocument[];
  future: EmailDocument[];
}

const STATE_KEY = "email-builder:state:v3";
const MAX_HISTORY = 50;
```

Every 4 s (and on `beforeunload`), `useAutoSave(doc, history, future)` writes the trimmed state to `localStorage`. On mount, `Builder.tsx`:

```ts
const saved = loadState();
if (saved) restoreState(saved);
```

`restoreState` is a single set call that replaces all three slices atomically without pushing onto history (it **is** the history). Re-opening the page restores both the document AND the undo stack.

## Block drag — what changed

In v3, drag listeners were attached to a small grip handle that only appeared on selection. v3.1 attaches them to the whole block wrapper:

```tsx
<div
  ref={setNodeRef}
  style={{ ...transform, cursor: "grab", touchAction: "none" }}
  {...attributes}
  {...listeners}
  onClick={(e) => { e.stopPropagation(); select(...); }}
>
  {renderBlockView(block)}
  {/* hover toolbar — ⧉ ✕ — stops pointer-down so buttons never trigger drag */}
</div>
```

`PointerSensor`'s 5px `activationConstraint.distance` separates clicks from drags. Hover toolbar buttons call `e.stopPropagation()` and `onPointerDown={e => e.stopPropagation()}` so click and drag stay independent.

## Preview

- **Modal** — `PreviewModal` renders the full generator output inside a sandboxed `<iframe srcDoc="…">`.
- **New tab** — `TopBar` builds the HTML, wraps it in a `text/html` Blob, creates a blob URL, and `window.open`s it. The URL is revoked after 60s.

## Drag visibility

A single `BuilderDndProvider` wraps the whole shell (LeftPanel + Canvas + RightPanel). It exposes:

- A `<DragOverlay>` that follows the cursor with a labeled chip (`Add: Text — drop into a column`, or `§2 ⇅ Moving section`) so you always see what you're dragging, even if the source element gets clipped by overflow.
- Strong visual feedback on the target column: blue background tint, dashed `outline` 3px, ring, and a corner badge "Drop in col 2".
- The empty-column placeholder switches to "Release to drop here" while hovered.

If the drag preview ever stops working after you add a new block type, the most common cause is a missing entry in `blockRegistry` — the overlay reads `label` and `icon` from the registry.

## Outlook compatibility & paste workflow

### TL;DR — use the .eml download

Click **📨 Outlook draft (.eml)** in the toolbar. An `.eml` file downloads. Double-click it: Outlook opens a **new compose window** with your email body already formatted, exactly as designed. No paste, no "Keep Source Formatting" popup, no Outlook editor mangling.

That's it. This is the only Outlook workflow that's both copy-paste-free *and* visually identical to the canvas.

### How the .eml works

The toolbar generates a tiny RFC 822 message:

```
MIME-Version: 1.0
Date: <now>
Subject: <doc.meta.subject>
X-Unsent: 1
Content-Type: text/html; charset="UTF-8"
Content-Transfer-Encoding: base64

<base64-encoded HTML, 76-char-wrapped>
```

The magic is `X-Unsent: 1` — Outlook (Windows desktop, Mac, and the new mobile app) interprets this as a draft and opens a fresh compose window populated with the HTML body, ready to send. Implemented in `components/TopBar.tsx → buildEml()`. UTF-8 is encoded via `btoa(unescape(encodeURIComponent(html)))` for full Unicode safety.

A round-trip-tested sample lives at `outputs/sample-email-output.eml`.

### Why pasting from Chrome looks different

Outlook's design editor mangles raw HTML source on paste — it strips most CSS, breaks tables, re-flows layout. The small "Ctrl" paste-options badge ("Keep Source Formatting / Merge Formatting / Paste as Text") is hard-coded Windows behavior on **any** paste of formatted content. There's no way to suppress it from the HTML side. The .eml route avoids paste entirely and is the only way to skip that menu.

### Other toolbar options (when .eml isn't an option)

- **📋 Copy for Outlook** — writes `ClipboardItem({ "text/html": ... })`. Better than the raw `Copy source` for paste, but Outlook will still show the "Ctrl" paste-options menu — pick "Keep Source Formatting".
- **↗ New tab** — opens the rendered HTML in a fresh tab. `Ctrl+A` → `Ctrl+C` from that tab and paste into Outlook is a viable fallback.
- **Copy source** — raw HTML for code editors or ESPs (Mailchimp / Brevo / SendGrid / Klaviyo) with a "Paste your own HTML" import.
- **⬇ Export HTML** — downloads the `.html` file. Upload it directly in your ESP.
- **? Outlook** — in-app help dialog summarizing all of the above.

### Outlook hardening already applied by the generator

Even with the right paste workflow, the generator emits extra defenses for Outlook desktop's Word rendering engine:

- `bgcolor=` attribute on `<body>`, the outer wrapper table, the inner content table, and every section TD — Outlook drops `style="background-color"` on paste in some builds but honors the legacy attribute.
- `valign="top"` on every section TD, every column TD, and every block TD — without it, content can be vertically centered in unexpected ways.
- `mso-line-height-rule:exactly` on every text TD — forces Outlook to use the specified `line-height` instead of falling back to "single".
- **VML `roundrect`** for buttons inside `<!--[if mso]>…<![endif]-->`, with the CSS button as fallback for everyone else. This is what makes Outlook Windows render a real branded rectangle instead of an underlined blue link.
- VML namespaces (`xmlns:v`, `xmlns:o`) declared on the `<html>` tag.

## Example generated HTML

`scripts/render-sample.mjs` bundles `lib/types.ts` + `lib/htmlGenerator.ts` via esbuild and emits `outputs/sample-email-output.html`. The current sample exercises:

- `meta.alignment: "right"` — the wrapper `<td align="right">` and inner `<table align="right">` both honor it. Open the file in a browser; the 600 px container hugs the right side of the viewport.
- `meta.border: "1px solid #1e293b"`, `meta.borderRadius: 8`
- A **4-column** feature grid (`25-25-25-25`) with section border + radius
- A **3-column** rich-text row showing `<ul>` + `<ol>` rendering
- A 50/50 hero with image left, text + bulletproof button right
- Light footer section with link honoring `linkColor`

Regenerate any time:

```bash
node scripts/render-sample.mjs
```

## Guarantees (validated by grep against the sample)

The generated HTML always has:

- `<table role="presentation">` for all layout — no div-based layout
- `cellpadding="0" cellspacing="0" border="0"` on every layout table
- Inline `style="…"` only — no `<style>`, no `<link>`, no `class=`
- No `margin:*` anywhere except the body reset (`margin:0`)
- No `display:flex`, no `display:grid`
- Every `<img>` has `width=`, `display:block`, `border:0`, `alt`
- Every `<a>` inside text has inline `color: <linkColor>; text-decoration: underline;` and `target="_blank"`
- Bulletproof button (inner table + inline-styled anchor + `bgcolor` on td)
- MSO conditional blocks wrap every multi-column section (2/3/4 cols)
- Wrapper `<td align>` and inner `<table align>` reflect `meta.alignment` so the downloaded HTML opens with your chosen alignment in the browser
