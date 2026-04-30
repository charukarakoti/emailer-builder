"use client";

import { useEffect, useState } from "react";
import { useBuilder } from "@/lib/store";
import { generateEmailHtml } from "@/lib/htmlGenerator";
import { templates } from "@/lib/templates";
import {
  loadUserTemplates,
  saveUserTemplate,
  updateUserTemplate,
  deleteUserTemplate,
  type UserTemplate,
} from "@/lib/userTemplates";
import type { EmailDocument } from "@/lib/types";
import ConfirmDialog from "@/components/ConfirmDialog";

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
  userTemplates,
}: {
  doc: EmailDocument;
  onCancel: () => void;
  onSave: (name: string, overwrite: boolean) => void;
  userTemplates: UserTemplate[];
}) {
  const defaultName = `${doc.meta.subject || "Template"} — ${new Date().toLocaleString()}`;
  const [name, setName] = useState(defaultName);
  const [saveMode, setSaveMode] = useState<"new" | "overwrite">("new");

  const nameExists = userTemplates.some((t) => t.name === name);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center" onClick={onCancel}>
      <div className="bg-white rounded-lg shadow-xl p-5 w-[480px]" onClick={(e) => e.stopPropagation()}>
        <div className="font-semibold mb-3">Save Template</div>

        <div className="mb-3">
          <label className="text-sm text-slate-600">Template name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border px-2 py-1 mt-1"
            placeholder="Enter template name"
          />
          {nameExists && (
            <div className="text-xs text-amber-600 mt-1">
              ⚠️ A template with this name already exists. Choose an option below:
            </div>
          )}
        </div>

        {nameExists && (
          <div className="mb-3 p-2 bg-slate-50 border border-slate-200 rounded">
            <div className="flex items-center gap-2 mb-2">
              <input
                type="radio"
                id="save-new"
                checked={saveMode === "new"}
                onChange={() => setSaveMode("new")}
              />
              <label htmlFor="save-new" className="text-sm cursor-pointer">
                Save as new (with suffix)
              </label>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="radio"
                id="save-overwrite"
                checked={saveMode === "overwrite"}
                onChange={() => setSaveMode("overwrite")}
              />
              <label htmlFor="save-overwrite" className="text-sm cursor-pointer">
                Overwrite existing template
              </label>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="border px-3 py-1 rounded hover:bg-slate-50">
            Cancel
          </button>
          <button
            onClick={() => onSave(name, saveMode === "overwrite")}
            className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

/* -------------------- Template Manager Dialog -------------------- */
function TemplateManagerDialog({
  userTemplates,
  onClose,
  onDeleteRequest,
}: {
  userTemplates: UserTemplate[];
  onClose: () => void;
  onDeleteRequest: (id: string, name: string) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl p-5 w-[500px] max-h-[600px] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="font-semibold mb-3">Saved Templates ({userTemplates.length})</div>

        {userTemplates.length === 0 ? (
          <div className="text-sm text-slate-500 text-center py-8">
            No saved templates yet. Click "+ New template" to create one.
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto mb-3 space-y-2 border rounded p-2 bg-slate-50">
            {userTemplates.map((t) => (
              <div key={t.id} className="flex items-center justify-between p-2 bg-white border rounded hover:border-blue-300">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{t.name}</div>
                  <div className="text-xs text-slate-400">
                    {new Date(t.createdAt).toLocaleDateString()} {new Date(t.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
                <button
                  onClick={() => onDeleteRequest(t.id, t.name)}
                  className="text-xs px-2 py-1 border border-red-300 text-red-600 rounded hover:bg-red-50 flex-shrink-0 ml-2"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="border px-3 py-1 rounded hover:bg-slate-50">
            Close
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
  const { doc, undo, redo, setDoc } = useBuilder();
  const [userTemplates, setUserTemplates] = useState<UserTemplate[]>([]);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [managerOpen, setManagerOpen] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText: string;
    variant: "danger" | "primary";
    action: () => void;
  }>({
    isOpen: false,
    title: "",
    message: "",
    confirmText: "Confirm",
    variant: "primary",
    action: () => {},
  });

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

  const handleSaveConfirm = (name: string, overwrite: boolean) => {
    if (overwrite) {
      const existing = userTemplates.find((t) => t.name === name);
      if (existing) {
        updateUserTemplate(existing.id, name, doc);
      }
    } else {
      saveUserTemplate(name, doc);
    }
    setRefresh((n) => n + 1);
    setSaveDialogOpen(false);
  };

  const handleSelectTemplate = (value: string) => {
    if (!value) return;

    // Check built-in templates first
    const built = templates.find((t) => t.name === value);
    if (built) {
      setDoc(JSON.parse(JSON.stringify(built.doc)));
      return;
    }

    // Check user templates
    const user = userTemplates.find((t) => t.name === value);
    if (user) {
      setDoc(JSON.parse(JSON.stringify(user.doc)));
      return;
    }
  };

  const handleDeleteTemplateRequest = (id: string, name: string) => {
    setConfirmDialog({
      isOpen: true,
      title: "Delete Template",
      message: `Are you sure you want to delete the template "${name}"? This action cannot be undone.`,
      confirmText: "Delete",
      variant: "danger",
      action: () => {
        deleteUserTemplate(id);
        setRefresh((n) => n + 1);
        setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  const closeConfirmDialog = () => {
    setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
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
                className="text-sm border rounded px-2 py-1 bg-white"
                onChange={(e) => handleSelectTemplate(e.target.value)}
                defaultValue=""
              >
                <option value="">Templates…</option>
                {templates.length > 0 && (
                  <optgroup label="Built-in">
                    {templates.map((t) => (
                      <option key={t.name}>{t.name}</option>
                    ))}
                  </optgroup>
                )}
                {userTemplates.length > 0 && (
                  <optgroup label="Saved Templates">
                    {userTemplates.map((t) => (
                      <option key={t.id}>{t.name}</option>
                    ))}
                  </optgroup>
                )}
              </select>

              <button
                onClick={handleSaveAsTemplate}
                className="bg-emerald-600 text-white px-3 py-1 rounded hover:bg-emerald-700 text-sm"
              >
                + New template
              </button>

              {userTemplates.length > 0 && (
                <button
                  onClick={() => setManagerOpen(true)}
                  className="text-sm border px-2 py-1 rounded hover:bg-slate-100"
                  title="Manage saved templates"
                >
                  📋 Manage
                </button>
              )}

              <button
                onClick={undo}
                className="border px-2 py-1 rounded hover:bg-slate-100 text-sm"
                title="Undo (Cmd+Z)"
              >
                ↶ Undo
              </button>

              <button
                onClick={redo}
                className="border px-2 py-1 rounded hover:bg-slate-100 text-sm"
                title="Redo (Cmd+Shift+Z)"
              >
                ↷ Redo
              </button>
            </div>

            <div className="ml-auto flex gap-2 flex-none">
              <button onClick={() => onPreview("desktop")} className="border px-3 py-1 rounded hover:bg-slate-100 text-sm">
                Desktop
              </button>
              <button onClick={() => onPreview("mobile")} className="border px-3 py-1 rounded hover:bg-slate-100 text-sm">
                Mobile
              </button>
              <button onClick={handleOpenInTab} className="border px-3 py-1 rounded hover:bg-slate-100 text-sm">
                New tab
              </button>
              <button onClick={handleExportEml} className="bg-indigo-600 text-white px-3 py-1 rounded hover:bg-indigo-700 text-sm">
                Outlook (.eml)
              </button>
              <button onClick={handleCopyForOutlook} className="border px-3 py-1 rounded hover:bg-slate-100 text-sm">
                Copy for Outlook
              </button>
              <button onClick={handleCopy} className="border px-3 py-1 rounded hover:bg-slate-100 text-sm">
                Copy source
              </button>
              <button onClick={handleExport} className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 text-sm">
                Export HTML
              </button>
            </div>

          </div>
        </div>
      </div>

      {saveDialogOpen && (
        <SaveTemplateDialog
          doc={doc}
          userTemplates={userTemplates}
          onCancel={() => setSaveDialogOpen(false)}
          onSave={handleSaveConfirm}
        />
      )}

      {managerOpen && (
        <TemplateManagerDialog
          userTemplates={userTemplates}
          onClose={() => setManagerOpen(false)}
          onDeleteRequest={handleDeleteTemplateRequest}
        />
      )}

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmText={confirmDialog.confirmText}
        confirmVariant={confirmDialog.variant}
        onConfirm={confirmDialog.action}
        onCancel={closeConfirmDialog}
      />
    </>
  );
}
