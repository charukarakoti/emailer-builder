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

/* -------------------------- .eml builder -------------------------- */
function buildEml(subject: string, html: string): string {
  const b64 = btoa(unescape(encodeURIComponent(html)));
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

/* ---------------------- Save Template Dialog ---------------------- */
function SaveTemplateDialog({
  doc,
  onCancel,
  onSave,
}: {
  doc: EmailDocument;
  onCancel: () => void;
  onSave: (name: string) => void;
}) {
  const defaultName = `${doc.meta.subject || "Template"} — ${new Date().toLocaleString()}`;
  const [name, setName] = useState(defaultName);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center" onClick={onCancel}>
      <div className="bg-white rounded-lg shadow-xl p-5 w-[420px]" onClick={(e) => e.stopPropagation()}>
        <div className="font-semibold mb-3">Save as new template</div>

        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full border px-2 py-1 mb-3"
        />

        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="border px-3 py-1 rounded">Cancel</button>
          <button onClick={() => onSave(name)} className="bg-green-600 text-white px-3 py-1 rounded">
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ TopBar ----------------------------- */
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
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(buildHtml());
    alert("HTML copied");
  };

  const handleCopyForOutlook = async () => {
    const html = buildHtml();
    try {
      const blob = new Blob([html], { type: "text/html" });
      const plain = new Blob([html], { type: "text/plain" });
      await navigator.clipboard.write([
        new ClipboardItem({ "text/html": blob, "text/plain": plain }),
      ]);
    } catch {
      await navigator.clipboard.writeText(html);
    }
  };

  const handleOpenInTab = () => {
    const html = buildHtml();
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
  };

  const handleSaveAsTemplate = () => setSaveDialogOpen(true);

  const handleSaveConfirm = (name: string) => {
    saveUserTemplate(name, doc);
    setRefresh((n) => n + 1);
    setSaveDialogOpen(false);
  };

  const handleSelectTemplate = (value: string) => {
    if (!value) return;
    const built = templates.find((t) => t.name === value);
    if (built) setDoc(JSON.parse(JSON.stringify(built.doc)));
  };

  return (
    <>
      {/* ✅ FIXED HEADER */}
      <div className="h-14 border-b bg-white">
        <div className="w-full overflow-x-auto">
          <div className="flex items-center px-4 gap-3 whitespace-nowrap min-w-max pt-2">

            <div className="font-semibold">📧 Email Builder v3.3</div>

            <div className="ml-6 flex gap-2 flex-none">
              <select
                className="text-sm border rounded px-2 py-1"
                onChange={(e) => handleSelectTemplate(e.target.value)}
              >
                <option>Templates…</option>
                {templates.map((t) => (
                  <option key={t.name}>{t.name}</option>
                ))}
              </select>

              <button onClick={handleSaveAsTemplate} className="bg-emerald-600 text-white px-3 py-1 rounded">
                + New template
              </button>

              <button onClick={undo} className="border px-2 py-1 rounded">
                Undo
              </button>

              <button onClick={redo} className="border px-2 py-1 rounded">
                Redo
              </button>
            </div>

            <div className="ml-auto flex gap-2 flex-none">
              <button onClick={() => onPreview("desktop")} className="border px-3 py-1 rounded">
                Desktop
              </button>
              <button onClick={() => onPreview("mobile")} className="border px-3 py-1 rounded">
                Mobile
              </button>
              <button onClick={handleOpenInTab} className="border px-3 py-1 rounded">
                New tab
              </button>
              <button onClick={handleExportEml} className="bg-indigo-600 text-white px-3 py-1 rounded">
                Outlook (.eml)
              </button>
              <button onClick={handleCopyForOutlook} className="border px-3 py-1 rounded">
                Copy for Outlook
              </button>
              <button onClick={handleCopy} className="border px-3 py-1 rounded">
                Copy source
              </button>
              <button onClick={handleExport} className="bg-blue-600 text-white px-3 py-1 rounded">
                Export HTML
              </button>
            </div>

          </div>
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