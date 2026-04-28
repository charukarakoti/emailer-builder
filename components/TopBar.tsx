"use client";
import { useEffect, useMemo, useState } from "react";
import { useBuilder } from "@/lib/store";
import { generateEmailHtml } from "@/lib/htmlGenerator";
import { templates } from "@/lib/templates";
import {
  loadUserTemplates,
  saveUserTemplate,
  deleteUserTemplate,
  type UserTemplate,
} from "@/lib/userTemplates";
import type { EmailDocument } from "@/lib/types";

const NEW_TEMPLATE_VALUE = "__new_template__";
const DELETE_PREFIX = "__delete__:";

// ---------------------------------------------------------------------------
// .eml builder — RFC 822 message that Outlook opens as a NEW compose window
// (because of X-Unsent: 1), with the HTML body fully rendered. No paste, no
// "Keep Source Formatting" menu, no surprises.
// ---------------------------------------------------------------------------
function buildEml(subject: string, html: string): string {
  // base64-encode UTF-8 safely in the browser
  const b64 = btoa(unescape(encodeURIComponent(html)));
  // Outlook's MIME parser is happiest with 76-char lines.
  const wrapped = b64.match(/.{1,76}/g)?.join("\r\n") ?? b64;
  const date = new Date().toUTCString();
  const safeSubject = subject.replace(/[\r\n]/g, " ").trim() || "(no subject)";
  return [
    "MIME-Version: 1.0",
    `Date: ${date}`,
    `Subject: ${safeSubject}`,
    "X-Unsent: 1",
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    wrapped,
    "",
  ].join("\r\n");
}

// ---------------------------------------------------------------------------
// SaveTemplateDialog — inline modal so the user can SEE what's being saved
// before committing. Replaces window.prompt(), which gave no preview and
// suggested the loaded template's subject as default name (the bug behind
// "I made a new template but the old one shows up").
// ---------------------------------------------------------------------------
function SaveTemplateDialog({
  doc,
  onCancel,
  onSave,
}: {
  doc: EmailDocument;
  onCancel: () => void;
  onSave: (name: string) => void;
}) {
  const defaultName = `${doc.meta.subject || "Template"} — ${new Date().toLocaleString(
    [],
    { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }
  )}`;
  const [name, setName] = useState(defaultName);

  const stats = useMemo(() => {
    const sectionCount = doc.sections.length;
    let blockCount = 0;
    for (const s of doc.sections)
      for (const c of s.columns) blockCount += c.blocks.length;
    return { sectionCount, blockCount };
  }, [doc]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-lg shadow-xl p-5 w-[420px] max-w-[92vw]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="font-semibold text-base mb-1">Save as new template</div>
        <div className="text-xs text-slate-500 mb-3">
          Saves a snapshot of the <strong>current canvas</strong> under a new
          name. Existing templates are never overwritten — if the name
          collides we'll add "(2)".
        </div>

        <div className="bg-slate-50 border rounded p-3 mb-3 text-xs">
          <div className="flex justify-between">
            <span className="text-slate-500">Subject</span>
            <span className="font-medium truncate ml-3">
              {doc.meta.subject || <em className="text-slate-400">(none)</em>}
            </span>
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-slate-500">Sections / Blocks</span>
            <span className="font-medium">
              {stats.sectionCount} / {stats.blockCount}
            </span>
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-slate-500">Alignment</span>
            <span className="font-medium">{doc.meta.alignment}</span>
          </div>
        </div>

        <label className="block text-xs font-semibold text-slate-600 mb-1">
          Template name
        </label>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSave(name);
            else if (e.key === "Escape") onCancel();
          }}
          className="w-full text-sm border rounded px-2 py-1.5 mb-3"
        />

        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="text-sm px-3 py-1.5 border rounded hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(name)}
            className="text-sm px-3 py-1.5 rounded bg-emerald-600 text-white hover:bg-emerald-700 font-semibold"
          >
            Save as new template
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TopBar
// ---------------------------------------------------------------------------
export default function TopBar({
  onPreview,
}: {
  onPreview: (m: "desktop" | "mobile") => void;
}) {
  const { doc, undo, redo, setDoc, history, future } = useBuilder();
  const [userTemplates, setUserTemplates] = useState<UserTemplate[]>([]);
  const [refresh, setRefresh] = useState(0);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);

  useEffect(() => {
    setUserTemplates(loadUserTemplates());
  }, [refresh]);

  const buildHtml = () => generateEmailHtml(doc);

  const handleExport = () => {
    const html = buildHtml();
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(doc.meta.subject || "email").replace(/\s+/g, "-")}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Download as Outlook .eml — opens as a new draft in Outlook with the
  // formatted HTML body intact. No paste, no "Keep Source Formatting" menu.
  const handleExportEml = () => {
    const html = buildHtml();
    const eml = buildEml(doc.meta.subject || "Email", html);
    const blob = new Blob([eml], { type: "message/rfc822" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(doc.meta.subject || "email").replace(/\s+/g, "-")}.eml`;
    a.click();
    URL.revokeObjectURL(url);
    setTimeout(() => {
      alert(
        "Outlook draft (.eml) downloaded.\n\n" +
          "Just double-click it — Outlook opens a new compose window\n" +
          "with your email already formatted in the body. No paste, no\n" +
          "“Keep Source Formatting” popup, no surprises.\n\n" +
          "(If your machine opens .eml in another app: right-click →\n" +
          " Open with → Outlook, and check “Always use this app”.)"
      );
    }, 100);
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(buildHtml());
    alert(
      "Source HTML copied.\n\n" +
        "For Outlook, the .eml download (📨 Outlook draft) is more\n" +
        "reliable — it skips paste entirely."
    );
  };

  const handleCopyForOutlook = async () => {
    const html = buildHtml();
    try {
      const blob = new Blob([html], { type: "text/html" });
      const plain = new Blob([html], { type: "text/plain" });
      await navigator.clipboard.write([
        new ClipboardItem({ "text/html": blob, "text/plain": plain }),
      ]);
      alert(
        "Outlook-ready HTML copied!\n\n" +
          "Now in Outlook:\n" +
          "  1. New email → click in the body → Ctrl+V\n" +
          "  2. If Outlook shows the small “Ctrl” paste-options menu,\n" +
          "     pick “Keep Source Formatting”.\n\n" +
          "Want to skip that menu entirely? Use 📨 Outlook draft (.eml)\n" +
          "instead — Outlook opens it pre-formatted, no paste needed."
      );
    } catch {
      await navigator.clipboard.writeText(html);
      alert(
        "Copied as plain HTML (your browser doesn't support rich\n" +
          "clipboard write). Use 📨 Outlook draft (.eml) instead for\n" +
          "the cleanest result."
      );
    }
  };

  const handleOutlookHelp = () => {
    alert(
      "How to get this email into Outlook — pick one\n\n" +
        "■ EASIEST (recommended) — 📨 Outlook draft (.eml)\n" +
        "  • Click the button → an .eml file downloads.\n" +
        "  • Double-click it. Outlook opens a NEW compose window with\n" +
        "    your email body already formatted, exactly as designed.\n" +
        "  • No paste. No “Keep Source Formatting” menu. No surprises.\n\n" +
        "■ Copy-paste — 📋 Copy for Outlook\n" +
        "  • New email in Outlook → click body → Ctrl+V.\n" +
        "  • Outlook will show the small “Ctrl” paste-options badge —\n" +
        "    that's hard-coded Windows behavior, can't be hidden.\n" +
        "    If you must paste, pick “Keep Source Formatting”.\n\n" +
        "■ For sending via Mailchimp / Brevo / SendGrid / etc.\n" +
        "  • Click ⬇ Export HTML and upload the .html file into your\n" +
        "    tool's “Paste your own HTML” option.\n\n" +
        "Why is the paste menu always there? Outlook's compose window\n" +
        "always shows it for ANY pasted formatted content. You can't\n" +
        "remove it via HTML. The .eml route avoids paste entirely."
    );
  };

  const handleOpenInTab = () => {
    const html = buildHtml();
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener,noreferrer");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  const handleSaveAsTemplate = () => setSaveDialogOpen(true);

  const handleSaveConfirm = (name: string) => {
    const t = saveUserTemplate(name, doc);
    setSaveDialogOpen(false);
    setRefresh((n) => n + 1);
    // If the name collided, saveUserTemplate appended " (2)" — show it.
    setTimeout(
      () =>
        alert(
          `Saved “${t.name}” — pick it from the Templates dropdown to load.`
        ),
      50
    );
  };

  const handleSelectTemplate = (value: string) => {
    if (!value) return;
    if (value === NEW_TEMPLATE_VALUE) {
      handleSaveAsTemplate();
      return;
    }
    if (value.startsWith(DELETE_PREFIX)) {
      const id = value.slice(DELETE_PREFIX.length);
      const t = userTemplates.find((x) => x.id === id);
      if (!t) return;
      if (window.confirm(`Delete saved template "${t.name}"?`)) {
        deleteUserTemplate(id);
        setRefresh((n) => n + 1);
      }
      return;
    }
    const ut = userTemplates.find((t) => t.id === value);
    if (ut) {
      setDoc(JSON.parse(JSON.stringify(ut.doc)));
      return;
    }
    const built = templates.find((t) => t.name === value);
    if (built) setDoc(JSON.parse(JSON.stringify(built.doc)));
  };

  return (
    <>
      <div className="h-14 border-b bg-white flex items-center px-4 gap-3 flex-wrap">
        <div className="font-semibold">📧 Email Builder v3.3</div>

        <div className="ml-6 flex gap-2">
          <select
            className="text-sm border rounded px-2 py-1"
            onChange={(e) => {
              handleSelectTemplate(e.target.value);
              e.target.value = "";
            }}
            defaultValue=""
          >
            <option value="" disabled>
              Templates…
            </option>

            <optgroup label="✨ Actions">
              <option value={NEW_TEMPLATE_VALUE}>
                💾 Save current as template…
              </option>
            </optgroup>

            <optgroup label="Built-in">
              {templates.map((t) => (
                <option key={t.name} value={t.name}>
                  {t.name}
                </option>
              ))}
            </optgroup>

            {userTemplates.length > 0 && (
              <optgroup label="My templates">
                {userTemplates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </optgroup>
            )}

            {userTemplates.length > 0 && (
              <optgroup label="Delete saved">
                {userTemplates.map((t) => (
                  <option
                    key={`del-${t.id}`}
                    value={`${DELETE_PREFIX}${t.id}`}
                  >
                    ✕ Delete "{t.name}"
                  </option>
                ))}
              </optgroup>
            )}
          </select>

          <button
            onClick={handleSaveAsTemplate}
            className="text-sm font-semibold px-3 py-1 rounded bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm"
            title="Save the current canvas as a NEW reusable template (never overwrites existing ones)"
          >
            + New template
          </button>

          <button
            onClick={undo}
            disabled={!history.length}
            className="text-sm px-2 py-1 border rounded disabled:opacity-40"
            title="Ctrl/Cmd+Z"
          >
            ↶ Undo
          </button>
          <button
            onClick={redo}
            disabled={!future.length}
            className="text-sm px-2 py-1 border rounded disabled:opacity-40"
            title="Ctrl/Cmd+Shift+Z"
          >
            ↷ Redo
          </button>
        </div>

        <div className="ml-auto flex flex-wrap gap-2">
          <button
            onClick={() => onPreview("desktop")}
            className="text-sm px-3 py-1.5 border rounded"
          >
            🖥 Desktop
          </button>
          <button
            onClick={() => onPreview("mobile")}
            className="text-sm px-3 py-1.5 border rounded"
          >
            📱 Mobile
          </button>
          <button
            onClick={handleOpenInTab}
            className="text-sm px-3 py-1.5 border rounded"
            title="Open the rendered HTML in a new tab"
          >
            ↗ New tab
          </button>
          <button
            onClick={handleOutlookHelp}
            className="text-sm px-3 py-1.5 border rounded bg-amber-50 hover:bg-amber-100 border-amber-300 text-amber-800"
            title="How to get this email into Outlook — recommended workflows"
          >
            ? Outlook
          </button>
          <button
            onClick={handleExportEml}
            className="text-sm font-semibold px-3 py-1.5 rounded bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm"
            title="Download an .eml file — double-click to open in Outlook as a new draft, fully formatted (no paste, no Keep Source Formatting menu)"
          >
            📨 Outlook draft (.eml)
          </button>
          <button
            onClick={handleCopyForOutlook}
            className="text-sm px-3 py-1.5 border rounded"
            title="Copies as text/html so Outlook pastes a rendered email (still triggers the Ctrl paste-options menu)"
          >
            📋 Copy for Outlook
          </button>
          <button
            onClick={handleCopy}
            className="text-sm px-3 py-1.5 border rounded"
            title="Copy raw HTML source (for code editors / ESPs that take pasted HTML)"
          >
            Copy source
          </button>
          <button
            onClick={handleExport}
            className="text-sm px-3 py-1.5 bg-blue-600 text-white rounded"
          >
            ⬇ Export HTML
          </button>
        </div>
      </div>

      {saveDialogOpen && (
        <SaveTemplateDialog
          doc={doc}
          onCancel={() => setSaveDialogOpen(false)}
          onSave={handleSaveConfirm}
        />
      )}
    </>
  );
}
