"use client";
import { useBuilder } from "@/lib/store";
import type {
  Block,
  Border,
  Padding,
  PaddingMode,
  ColumnLayout,
  Alignment,
} from "@/lib/types";
import { p as mkPadding } from "@/lib/types";

// -----------------------------------------------------------------------------
// Tiny primitives
// -----------------------------------------------------------------------------

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block mb-3">
      <div className="text-xs text-slate-500 mb-1">{label}</div>
      {children}
    </label>
  );
}

function Section({ title }: { title: string }) {
  return (
    <div className="text-xs font-semibold uppercase text-slate-400 tracking-wide mt-4 mb-2">
      {title}
    </div>
  );
}

const input = "w-full text-sm border rounded px-2 py-1";

// -----------------------------------------------------------------------------
// Padding control — toggle between unified & TRBL
// -----------------------------------------------------------------------------

function PaddingControl({
  value,
  mode,
  onChange,
  onModeChange,
}: {
  value: Padding;
  mode: PaddingMode;
  onChange: (p: Padding) => void;
  onModeChange?: (m: PaddingMode) => void;
}) {
  const set = (k: keyof Padding, v: string) =>
    onChange({ ...value, [k]: v || "0" });
  return (
    <div className="mb-3">
      <div className="flex items-center justify-between mb-1">
        <div className="text-xs text-slate-500">Padding</div>
        {onModeChange && (
          <div className="flex gap-0 text-xs border rounded overflow-hidden">
            <button
              onClick={() => {
                onModeChange("unified");
                onChange(mkPadding(value.top)); // collapse to unified using current top
              }}
              className={`px-2 py-0.5 ${
                mode === "unified" ? "bg-slate-800 text-white" : ""
              }`}
            >
              Unified
            </button>
            <button
              onClick={() => onModeChange("trbl")}
              className={`px-2 py-0.5 ${
                mode === "trbl" ? "bg-slate-800 text-white" : ""
              }`}
            >
              TRBL
            </button>
          </div>
        )}
      </div>
      {mode === "unified" ? (
        <input
          className={input}
          placeholder="e.g. 20px"
          value={value.top}
          onChange={(e) => onChange(mkPadding(e.target.value || "0"))}
        />
      ) : (
        <div className="grid grid-cols-4 gap-1">
          {(["top", "right", "bottom", "left"] as const).map((k) => (
            <input
              key={k}
              className={input}
              title={k}
              placeholder={k[0].toUpperCase()}
              value={value[k]}
              onChange={(e) => set(k, e.target.value)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Border control — width / style / color
// -----------------------------------------------------------------------------

function BorderControl({
  value,
  onChange,
}: {
  value: Border;
  onChange: (b: Border) => void;
}) {
  return (
    <div className="mb-3">
      <div className="text-xs text-slate-500 mb-1">Border</div>
      <div className="grid grid-cols-3 gap-1">
        <input
          className={input}
          placeholder="Width"
          value={value.width}
          onChange={(e) =>
            onChange({ ...value, width: e.target.value || "0" })
          }
        />
        <select
          className={input}
          value={value.style}
          onChange={(e) =>
            onChange({ ...value, style: e.target.value as Border["style"] })
          }
        >
          <option value="none">None</option>
          <option value="solid">Solid</option>
          <option value="dashed">Dashed</option>
          <option value="dotted">Dotted</option>
        </select>
        <input
          type="color"
          className="w-full h-8"
          value={value.color}
          onChange={(e) => onChange({ ...value, color: e.target.value })}
        />
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Rich-text toolbar — wraps selection with <strong>/<a>/lists
// -----------------------------------------------------------------------------

function RichTextToolbar({
  textareaId,
  onChange,
  getValue,
}: {
  textareaId: string;
  onChange: (v: string) => void;
  getValue: () => string;
}) {
  const wrap = (pre: string, post: string, fallback = "text") => {
    const ta = document.getElementById(textareaId) as HTMLTextAreaElement | null;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const v = getValue();
    const sel = v.slice(start, end) || fallback;
    const next = v.slice(0, start) + pre + sel + post + v.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(
        start + pre.length,
        start + pre.length + sel.length
      );
    });
  };
  const insertList = (tag: "ul" | "ol") => {
    const items = "<li>Item one</li><li>Item two</li>";
    wrap(`<${tag}>`, `${items}</${tag}>`, "");
  };
  const addLink = () => {
    const url = prompt("Link URL", "https://example.com") || "";
    if (!url) return;
    wrap(`<a href="${url}">`, "</a>", "link text");
  };
  const btn =
    "text-xs px-2 py-0.5 border rounded bg-white hover:bg-slate-50";
  return (
    <div className="flex flex-wrap gap-1 mb-1">
      <button className={btn} onClick={() => wrap("<strong>", "</strong>")}>
        <b>B</b>
      </button>
      <button className={btn} onClick={addLink}>
        🔗 Link
      </button>
      <button className={btn} onClick={() => insertList("ul")}>
        • List
      </button>
      <button className={btn} onClick={() => insertList("ol")}>
        1. List
      </button>
      <button className={btn} onClick={() => wrap("<br/>", "", "")}>
        ↵ BR
      </button>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Panel root
// -----------------------------------------------------------------------------

export default function RightPanel() {
  const {
    doc,
    sectionId,
    columnIndex,
    blockId,
    updateBlock,
    updateSectionStyle,
    updateMeta,
    duplicateSection,
    duplicateBlock,
    removeBlock,
    removeSection,
    changeColumnLayout,
  } = useBuilder();

  const section = doc.sections.find((s) => s.id === sectionId) || null;
  let block: Block | undefined;
  if (section && columnIndex !== null && blockId) {
    block = section.columns[columnIndex]?.blocks.find((b) => b.id === blockId);
  }

  // ==========================================================================
  // EMAIL-LEVEL
  // ==========================================================================
  if (!section) {
    return (
      <aside className="w-80 border-l bg-white overflow-y-auto p-4">
        <div className="text-sm font-semibold mb-3">Email settings</div>

        <Field label="Subject">
          <input
            className={input}
            value={doc.meta.subject}
            onChange={(e) => updateMeta({ subject: e.target.value })}
          />
        </Field>
        <Field label="Preheader">
          <input
            className={input}
            value={doc.meta.preheader}
            onChange={(e) => updateMeta({ preheader: e.target.value })}
          />
        </Field>

        <Section title="Layout" />
        <Field label="Content width (px)">
          <input
            className={input}
            type="number"
            value={doc.meta.contentWidth}
            onChange={(e) =>
              updateMeta({ contentWidth: parseInt(e.target.value || "600", 10) })
            }
          />
        </Field>
        <Field label="Page alignment (export)">
          <div className="flex gap-1">
            {(["left", "center", "right"] as Alignment[]).map((a) => (
              <button
                key={a}
                onClick={() => updateMeta({ alignment: a })}
                className={`flex-1 text-xs border rounded py-1 capitalize ${
                  doc.meta.alignment === a ? "bg-blue-500 text-white" : ""
                }`}
              >
                {a}
              </button>
            ))}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Sets the wrapper <code>&lt;td align="…"&gt;</code> in the exported
            HTML.
          </div>
        </Field>

        <Section title="Colors" />
        <div className="grid grid-cols-2 gap-2">
          <Field label="Wrapper bg">
            <input
              type="color"
              className="w-full h-8"
              value={doc.meta.backgroundColor}
              onChange={(e) => updateMeta({ backgroundColor: e.target.value })}
            />
          </Field>
          <Field label="Content bg">
            <input
              type="color"
              className="w-full h-8"
              value={doc.meta.contentBackground}
              onChange={(e) =>
                updateMeta({ contentBackground: e.target.value })
              }
            />
          </Field>
        </div>

        <Section title="Frame" />
        <BorderControl
          value={doc.meta.border}
          onChange={(b) => updateMeta({ border: b })}
        />
        <Field label="Border radius (0–8px, Outlook may ignore)">
          <input
            className={input}
            value={doc.meta.borderRadius}
            onChange={(e) => updateMeta({ borderRadius: e.target.value })}
          />
        </Field>
      </aside>
    );
  }

  // ==========================================================================
  // BLOCK EDITORS
  // ==========================================================================
  if (block && columnIndex !== null) {
    const sId = section.id;
    const cIdx = columnIndex;
    const bId = block.id;
    const setStyle = (patch: any) =>
      updateBlock(sId, cIdx, bId, { style: patch });

    return (
      <aside className="w-80 border-l bg-white overflow-y-auto p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-semibold capitalize">
            {block.type} block
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => duplicateBlock(sId, cIdx, bId)}
              className="text-xs px-2 py-0.5 border rounded"
              title="Duplicate this block"
            >
              ⧉ Duplicate
            </button>
            <button
              onClick={() => removeBlock(sId, cIdx, bId)}
              className="text-xs px-2 py-0.5 border rounded text-red-600"
              title="Delete this block"
            >
              ✕ Delete
            </button>
          </div>
        </div>

        {/* TEXT */}
        {block.type === "text" && (
          <>
            <Field label="Content (rich: bold, link, ul/ol/li)">
              <>
                <RichTextToolbar
                  textareaId={`txt-${bId}`}
                  getValue={() => (block as any).content}
                  onChange={(v) => updateBlock(sId, cIdx, bId, { content: v })}
                />
                <textarea
                  id={`txt-${bId}`}
                  className={input}
                  rows={6}
                  value={block.content}
                  onChange={(e) =>
                    updateBlock(sId, cIdx, bId, { content: e.target.value })
                  }
                />
              </>
            </Field>

            <div className="grid grid-cols-2 gap-2">
              <Field label="Font size">
                <input
                  className={input}
                  value={block.style.fontSize}
                  onChange={(e) => setStyle({ fontSize: e.target.value })}
                />
              </Field>
              <Field label="Line height">
                <input
                  className={input}
                  value={block.style.lineHeight}
                  onChange={(e) => setStyle({ lineHeight: e.target.value })}
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Field label="Color">
                <input
                  type="color"
                  className="w-full h-8"
                  value={block.style.color}
                  onChange={(e) => setStyle({ color: e.target.value })}
                />
              </Field>
              <Field label="Link color">
                <input
                  type="color"
                  className="w-full h-8"
                  value={block.style.linkColor}
                  onChange={(e) => setStyle({ linkColor: e.target.value })}
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Field label="Weight">
                <select
                  className={input}
                  value={block.style.fontWeight}
                  onChange={(e) => setStyle({ fontWeight: e.target.value })}
                >
                  <option value="400">Normal</option>
                  <option value="700">Bold</option>
                </select>
              </Field>
              <Field label="Font family">
                <select
                  className={input}
                  value={block.style.fontFamily}
                  onChange={(e) => setStyle({ fontFamily: e.target.value })}
                >
                  <option value="Arial, Helvetica, sans-serif">Arial</option>
                  <option value="'Helvetica Neue', Helvetica, Arial, sans-serif">
                    Helvetica
                  </option>
                  <option value="Georgia, serif">Georgia</option>
                  <option value="'Times New Roman', Times, serif">
                    Times
                  </option>
                  <option value="'Courier New', Courier, monospace">
                    Courier
                  </option>
                  <option value="Verdana, Geneva, sans-serif">Verdana</option>
                </select>
              </Field>
            </div>

            <Field label="Text alignment">
              <div className="flex gap-1">
                {(["left", "center", "right"] as const).map((a) => (
                  <button
                    key={a}
                    onClick={() => setStyle({ textAlign: a })}
                    className={`flex-1 text-xs border rounded py-1 capitalize ${
                      block!.style.textAlign === a
                        ? "bg-blue-500 text-white"
                        : ""
                    }`}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </Field>

            <PaddingControl
              value={block.style.padding}
              mode="trbl"
              onChange={(p) => setStyle({ padding: p })}
            />
          </>
        )}

        {/* IMAGE */}
        {block.type === "image" && (
          <>
            <Field label="Image URL">
              <input
                className={input}
                value={block.src}
                onChange={(e) =>
                  updateBlock(sId, cIdx, bId, { src: e.target.value })
                }
              />
            </Field>
            <Field label="Alt text">
              <input
                className={input}
                value={block.alt}
                onChange={(e) =>
                  updateBlock(sId, cIdx, bId, { alt: e.target.value })
                }
              />
            </Field>
            <Field label="Link (optional)">
              <input
                className={input}
                value={block.href || ""}
                onChange={(e) =>
                  updateBlock(sId, cIdx, bId, { href: e.target.value })
                }
              />
            </Field>
            <Field label="Width (px, no unit)">
              <input
                className={input}
                value={block.style.width}
                onChange={(e) => setStyle({ width: e.target.value })}
              />
            </Field>
            <Field label="Alignment">
              <div className="flex gap-1">
                {(["left", "center", "right"] as const).map((a) => (
                  <button
                    key={a}
                    onClick={() => setStyle({ align: a })}
                    className={`flex-1 text-xs border rounded py-1 capitalize ${
                      block!.style.align === a
                        ? "bg-blue-500 text-white"
                        : ""
                    }`}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </Field>
            <PaddingControl
              value={block.style.padding}
              mode="trbl"
              onChange={(p) => setStyle({ padding: p })}
            />
          </>
        )}

        {/* BUTTON */}
        {block.type === "button" && (
          <>
            <Field label="Label">
              <input
                className={input}
                value={block.content}
                onChange={(e) =>
                  updateBlock(sId, cIdx, bId, { content: e.target.value })
                }
              />
            </Field>
            <Field label="URL">
              <input
                className={input}
                value={block.href}
                onChange={(e) =>
                  updateBlock(sId, cIdx, bId, { href: e.target.value })
                }
              />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Bg color">
                <input
                  type="color"
                  className="w-full h-8"
                  value={block.style.backgroundColor}
                  onChange={(e) => setStyle({ backgroundColor: e.target.value })}
                />
              </Field>
              <Field label="Text color">
                <input
                  type="color"
                  className="w-full h-8"
                  value={block.style.color}
                  onChange={(e) => setStyle({ color: e.target.value })}
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Padding Y">
                <input
                  className={input}
                  value={block.style.paddingY}
                  onChange={(e) => setStyle({ paddingY: e.target.value })}
                />
              </Field>
              <Field label="Padding X">
                <input
                  className={input}
                  value={block.style.paddingX}
                  onChange={(e) => setStyle({ paddingX: e.target.value })}
                />
              </Field>
            </div>
            <Field label="Radius (0–8px safe)">
              <input
                className={input}
                value={block.style.borderRadius}
                onChange={(e) => setStyle({ borderRadius: e.target.value })}
              />
            </Field>
            <Field label="Alignment">
              <div className="flex gap-1">
                {(["left", "center", "right"] as const).map((a) => (
                  <button
                    key={a}
                    onClick={() => setStyle({ align: a })}
                    className={`flex-1 text-xs border rounded py-1 capitalize ${
                      block!.style.align === a
                        ? "bg-blue-500 text-white"
                        : ""
                    }`}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </Field>
            <PaddingControl
              value={block.style.containerPadding}
              mode="trbl"
              onChange={(p) => setStyle({ containerPadding: p })}
            />
          </>
        )}

        {/* SPACER */}
        {block.type === "spacer" && (
          <>
            <Field label="Height">
              <input
                className={input}
                value={block.style.height}
                onChange={(e) => setStyle({ height: e.target.value })}
              />
            </Field>
            <Field label="Bg color (optional)">
              <input
                type="color"
                className="w-full h-8"
                value={block.style.backgroundColor || "#ffffff"}
                onChange={(e) =>
                  setStyle({ backgroundColor: e.target.value })
                }
              />
            </Field>
          </>
        )}

        {/* DIVIDER */}
        {block.type === "divider" && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Thickness">
                <input
                  className={input}
                  value={block.style.thickness}
                  onChange={(e) => setStyle({ thickness: e.target.value })}
                />
              </Field>
              <Field label="Color">
                <input
                  type="color"
                  className="w-full h-8"
                  value={block.style.color}
                  onChange={(e) => setStyle({ color: e.target.value })}
                />
              </Field>
            </div>
            <Field label="Width (e.g. 100% or 320px)">
              <input
                className={input}
                value={block.style.width}
                onChange={(e) => setStyle({ width: e.target.value })}
              />
            </Field>
            <Field label="Alignment">
              <div className="flex gap-1">
                {(["left", "center", "right"] as const).map((a) => (
                  <button
                    key={a}
                    onClick={() => setStyle({ align: a })}
                    className={`flex-1 text-xs border rounded py-1 capitalize ${
                      block!.style.align === a
                        ? "bg-blue-500 text-white"
                        : ""
                    }`}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </Field>
            <PaddingControl
              value={block.style.padding}
              mode="trbl"
              onChange={(p) => setStyle({ padding: p })}
            />
          </>
        )}
      </aside>
    );
  }

  // ==========================================================================
  // SECTION EDITOR
  // ==========================================================================
  const st = section.style;
  const setS = (patch: any) => updateSectionStyle(section.id, patch);

  return (
    <aside className="w-80 border-l bg-white overflow-y-auto p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-semibold">Section</div>
        <div className="flex gap-1">
          <button
            onClick={() => duplicateSection(section.id)}
            className="text-xs px-2 py-0.5 border rounded"
            title="Clone this section below"
          >
            ⧉ Duplicate
          </button>
          <button
            onClick={() => removeSection(section.id)}
            className="text-xs px-2 py-0.5 border rounded text-red-600"
          >
            ✕ Delete
          </button>
        </div>
      </div>

      <Section title="Layout" />
      <Field label="Columns">
        <div className="grid grid-cols-5 gap-1">
          {(
            ["1", "50-50", "60-40", "33-33-33", "25-25-25-25"] as ColumnLayout[]
          ).map((l) => (
            <button
              key={l}
              onClick={() => changeColumnLayout(section.id, l)}
              className={`text-[11px] border rounded py-1 ${
                st.columnLayout === l ? "bg-blue-500 text-white" : ""
              }`}
              title={l}
            >
              {l === "1"
                ? "1"
                : l === "50-50"
                ? "50/50"
                : l === "60-40"
                ? "60/40"
                : l === "33-33-33"
                ? "3"
                : "4"}
            </button>
          ))}
        </div>
      </Field>

      {st.columnLayout !== "1" && (
        <Field label="Gutter">
          <input
            className={input}
            value={st.gutter}
            onChange={(e) => setS({ gutter: e.target.value })}
          />
        </Field>
      )}

      <Section title="Appearance" />
      <Field label="Background">
        <input
          type="color"
          className="w-full h-8"
          value={st.backgroundColor}
          onChange={(e) => setS({ backgroundColor: e.target.value })}
        />
      </Field>

      <PaddingControl
        value={st.padding}
        mode={st.paddingMode}
        onChange={(p) => setS({ padding: p })}
        onModeChange={(m) => setS({ paddingMode: m })}
      />

      <BorderControl value={st.border} onChange={(b) => setS({ border: b })} />
      <Field label="Border radius (0–8px)">
        <input
          className={input}
          value={st.borderRadius}
          onChange={(e) => setS({ borderRadius: e.target.value })}
        />
      </Field>
    </aside>
  );
}
