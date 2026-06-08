"use client";

import { useEffect, useState, useRef } from "react";
import { useNotifications } from "@/components/NotificationProvider";
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
import { newDocument, type EmailDocument } from "@/lib/types";
import { clearSaved } from "@/lib/autosave";
import ConfirmDialog from "@/components/ConfirmDialog";

/* -------------------------- Toolbar helpers -------------------------- */
// Small UI primitives used by the redesigned header. Kept in this file so
// the whole toolbar stays self-contained.

function Divider({ className = "" }: { className?: string }) {
  return (
    <div
      className={"h-7 w-px bg-slate-200 mx-0.5 hidden sm:block " + className}
    />
  );
}

function IconButton({
  onClick,
  title,
  children,
}: {
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white text-sm text-slate-700 hover:bg-slate-50 transition"
    >
      {children}
    </button>
  );
}

/**
 * Export dropdown — combines:
 *   - Export HTML  → downloads .html file
 *   - Outlook .eml → downloads .eml for Outlook
 *   - Open in tab  → preview the rendered HTML in a new tab
 *   - Copy HTML    → clipboard
 *   - Copy for Outlook → clipboard (with Outlook-friendly wrapping)
 *
 * Closes when the user clicks anywhere outside the panel.
 */
function ExportMenu({
  onExportHtml,
  onExportEml,
  onCopyHtml,
  onCopyOutlook,
  onOpenInTab,
}: {
  onExportHtml: () => void;
  onExportEml: () => void;
  onCopyHtml: () => void;
  onCopyOutlook: () => void;
  onOpenInTab: () => void;
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [open]);

  function pick(fn: () => void) {
    return (e: React.MouseEvent) => {
      e.stopPropagation();
      setOpen(false);
      fn();
    };
  }

  return (
    <div className="relative">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="h-9 inline-flex items-center gap-1 px-3 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-black transition"
      >
        Export <span className="text-xs opacity-70">▾</span>
      </button>
      {open && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute right-0 mt-1 w-56 bg-white border border-slate-200 rounded-lg shadow-lg z-40 py-1 text-sm"
        >
          <button
            onClick={pick(onExportHtml)}
            className="w-full text-left px-3 py-1.5 hover:bg-slate-50"
          >
            Download HTML
          </button>
          <button
            onClick={pick(onExportEml)}
            className="w-full text-left px-3 py-1.5 hover:bg-slate-50"
          >
            Download Outlook (.eml)
          </button>
          <button
            onClick={pick(onOpenInTab)}
            className="w-full text-left px-3 py-1.5 hover:bg-slate-50"
          >
            Open in new tab
          </button>
          <div className="h-px bg-slate-100 my-1" />
          <button
            onClick={pick(onCopyHtml)}
            className="w-full text-left px-3 py-1.5 hover:bg-slate-50"
          >
            Copy HTML source
          </button>
          <button
            onClick={pick(onCopyOutlook)}
            className="w-full text-left px-3 py-1.5 hover:bg-slate-50"
          >
            Copy for Outlook
          </button>
        </div>
      )}
    </div>
  );
}

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
            No saved templates yet. Design an email and click "💾 Save as template" to keep it.
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

/* -------------------- Send Email Dialog -------------------- */
// Redesigned Phase-2 dialog. Visual changes:
//   • Header strip with brand-coloured icon + close button
//   • Inputs reorganised so the most-mistaken field (recipients) is up top
//   • Recipients shown as live "chips" as the user types — instant visual
//     feedback for how many people the email is going to
//   • Status, success and failure rendered inline (no longer routed through
//     the global toast for the email-specific path)
//   • Friendlier copy + grouped helper text
//
// The send protocol itself is unchanged — POST /api/send with the same
// payload. Behaviour around partial failures is preserved.
function SendEmailDialog({
  doc,
  onClose,
  onSent,
  onError,
}: {
  doc: EmailDocument;
  onClose: () => void;
  onSent: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState(doc.meta?.subject || "");
  const [fromName, setFromName] = useState("");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<{ email: string; error: string }[]>([]);
  const [success, setSuccess] = useState<string | null>(null);
  const [inlineError, setInlineError] = useState<string | null>(null);

  const parseRecipientsRef = useRef<(raw: any) => string[]>((raw: any) =>
    String(raw || "")
      .split(/[\s,;]+/)
      .map((s) => s.trim())
      .filter(Boolean)
  );
  const isValidRecipientRef = useRef<(s: string) => boolean>((s: string) =>
    /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s)
  );

  useEffect(() => {
    let mounted = true;
    import("@/lib/email/recipients")
      .then((m) => {
        if (!mounted) return;
        if (typeof m.parseRecipients === "function")
          parseRecipientsRef.current = m.parseRecipients;
        if (typeof m.isValidRecipient === "function")
          isValidRecipientRef.current = m.isValidRecipient;
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  const parsed = parseRecipientsRef.current(to);
  const valid = parsed.filter(isValidRecipientRef.current);
  const invalid = parsed.filter((e) => !isValidRecipientRef.current(e));

  async function send() {
    setInlineError(null);
    setSuccess(null);
    setFailed([]);
    if (valid.length === 0) {
      setInlineError("Add at least one valid recipient.");
      return;
    }
    setBusy(true);
    try {
      const r = await fetch("/api/send", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          to: valid,
          subject: subject || undefined,
          doc,
          fromName: fromName || undefined,
        }),
      });
      const data = await r.json();
      if (!r.ok) {
        setInlineError(data?.error || "Send failed");
        return;
      }
      const sent: string[] = data.sent || [];
      const fail: { email: string; error: string }[] = data.failed || [];
      setFailed(fail);
      if (sent.length && !fail.length) {
        setSuccess(
          `Delivered to ${sent.length} recipient${
            sent.length === 1 ? "" : "s"
          } 🎉`
        );
        // Also surface a toast so closing the dialog doesn't lose the news.
        onSent(`Email sent to ${sent.length}.`);
      } else if (sent.length && fail.length) {
        setSuccess(
          `Delivered to ${sent.length}, but ${fail.length} failed.`
        );
      } else {
        setInlineError("All deliveries failed — see the list below.");
      }
    } catch (e: any) {
      setInlineError(e?.message || "Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center px-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header strip */}
        <div className="flex items-start justify-between px-6 pt-5 pb-3 border-b border-slate-100">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center text-base shadow-sm">
              ✉
            </div>
            <div>
              <div className="font-semibold text-base text-slate-900">
                Send email
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                Delivers the current canvas through your SMTP account. One
                message per recipient.
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 transition h-7 w-7 inline-flex items-center justify-center rounded-md hover:bg-slate-100"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-4">
          {/* Recipients */}
          <div>
            <label className="block text-sm">
              <span className="block text-slate-700 font-medium mb-1.5">
                Recipients
              </span>
              <textarea
                value={to}
                onChange={(e) => setTo(e.target.value)}
                rows={3}
                placeholder="alice@example.com, bob@example.com or Alice <alice@example.com>"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition"
              />
            </label>
            {parsed.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {valid.map((e) => (
                  <span
                    key={e}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-emerald-50 text-emerald-700 border border-emerald-200"
                  >
                    {e}
                  </span>
                ))}
                {invalid.map((e) => (
                  <span
                    key={e}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-rose-50 text-rose-700 border border-rose-200"
                    title="Not a valid email address"
                  >
                    {e}
                  </span>
                ))}
              </div>
            )}
            <div className="mt-1.5 text-xs text-slate-500">
              {valid.length} valid · {invalid.length} invalid
              {invalid.length > 0 && " (will be skipped)"}
            </div>
          </div>

          {/* Subject + from name (2-col on wider screens) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="block text-slate-700 font-medium mb-1.5">
                Subject
              </span>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="What recipients see in their inbox"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition"
              />
            </label>
            <label className="block text-sm">
              <span className="block text-slate-700 font-medium mb-1.5">
                From name{" "}
                <span className="text-slate-400 font-normal">(optional)</span>
              </span>
              <input
                value={fromName}
                onChange={(e) => setFromName(e.target.value)}
                placeholder="JV Team"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition"
              />
            </label>
          </div>

          {/* Helper note */}
          <div className="text-xs text-slate-500 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
            <strong className="text-slate-700">Heads up:</strong> the sender
            address is fixed to <code>SMTP_FROM</code> in your{" "}
            <code>.env</code>. Only the display name can change above (most
            providers require a verified address).
          </div>

          {/* Inline status */}
          {success && (
            <div className="text-sm bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg px-3 py-2">
              {success}
            </div>
          )}
          {inlineError && (
            <div className="text-sm bg-rose-50 border border-rose-200 text-rose-800 rounded-lg px-3 py-2">
              {inlineError}
            </div>
          )}
          {failed.length > 0 && (
            <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-xs text-rose-800">
              <div className="font-semibold mb-1">
                Failed deliveries ({failed.length}):
              </div>
              <ul className="space-y-0.5 max-h-24 overflow-y-auto">
                {failed.map((f, i) => (
                  <li key={i}>
                    <span className="font-mono">{f.email}</span> — {f.error}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 px-6 py-4 bg-slate-50 border-t border-slate-100">
          <div className="text-xs text-slate-500">
            {valid.length > 0 && !busy
              ? `Ready to send to ${valid.length} recipient${
                  valid.length === 1 ? "" : "s"
                }`
              : busy
              ? "Sending in progress…"
              : "Enter at least one recipient to enable Send"}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              disabled={busy}
              className="h-9 px-3.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-50 transition"
            >
              Cancel
            </button>
            <button
              onClick={send}
              disabled={busy || valid.length === 0}
              className="h-9 inline-flex items-center gap-1.5 px-4 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {busy ? (
                <>
                  <span className="inline-block h-3.5 w-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Sending…
                </>
              ) : (
                <>✉ Send email</>
              )}
            </button>
          </div>
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
  const { notify } = useNotifications();
  const [userTemplates, setUserTemplates] = useState<UserTemplate[]>([]);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [managerOpen, setManagerOpen] = useState(false);
  // Send-email dialog state. The dialog calls POST /api/send with the
  // current canvas doc and a comma-separated recipient list.
  const [sendOpen, setSendOpen] = useState(false);
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [pendingCampaignName, setPendingCampaignName] = useState<string | null>(null);
  const [pendingCampaignSubject, setPendingCampaignSubject] = useState<string | null>(null);
  const [pendingTemplateId, setPendingTemplateId] = useState<string | null>(null);
  const [savingCampaign, setSavingCampaign] = useState(false);
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

  // userTemplates now live in Postgres (see lib/userTemplates.ts).
  // The list is reloaded whenever `refresh` ticks. If the user isn't signed
  // in (or the fetch fails) we just get an empty array — middleware should
  // have already bounced them to /login.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const list = await loadUserTemplates();
      if (!cancelled) setUserTemplates(list);
    })();
    return () => {
      cancelled = true;
    };
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
    notify("HTML export ready", "success");
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
    notify("Outlook export ready", "success");
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(buildHtml());
      notify("HTML copied", "success");
    } catch {
      notify("Unable to copy HTML", "error");
    }
  };

  const handleCopyForOutlook = async () => {
    const html = buildHtml();
    try {
      const blob = new Blob([html], { type: "text/html" });
      const plain = new Blob([html], { type: "text/plain" });
      await navigator.clipboard.write([
        new ClipboardItem({ "text/html": blob, "text/plain": plain }),
      ]);
      notify("HTML copied for Outlook", "success");
    } catch {
      try {
        await navigator.clipboard.writeText(html);
        notify("HTML copied", "success");
      } catch {
        notify("Unable to copy HTML", "error");
      }
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    setCampaignId(params.get("campaign"));
    setPendingCampaignName(params.get("campaignName"));
    setPendingCampaignSubject(params.get("campaignSubject"));
    setPendingTemplateId(params.get("template"));
  }, []);

  const handleSaveCampaign = async () => {
    if (!campaignId) return;
    setSavingCampaign(true);
    try {
      const response = await fetch(
        `/api/campaigns/${encodeURIComponent(campaignId)}`,
        {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            doc,
            subject: doc.meta.subject || "",
          }),
        }
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Failed to save campaign");
      }
      notify("Campaign draft saved", "success");
    } catch (err: any) {
      notify(err?.message || "Unable to save campaign", "error");
    } finally {
      setSavingCampaign(false);
    }
  };

  const handleCreateCampaign = async () => {
    // Create a new campaign from the current canvas/doc when the user arrived
    // from the NewCampaignDialog (template flow) and no campaignId exists yet.
    setSavingCampaign(true);
    try {
      const body: any = {
        name: pendingCampaignName || "Untitled campaign",
        subject: pendingCampaignSubject || doc.meta.subject || "",
        templateId: pendingTemplateId || null,
        doc,
      };
      const response = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Failed to create campaign");
      const id = data.campaign?.id;
      if (!id) throw new Error("No campaign id returned");
      notify("Campaign created", "success");
      // Update URL: remove campaignName/template params and set campaign id
      const url = new URL(window.location.href);
      url.searchParams.delete("campaignName");
      url.searchParams.delete("campaignSubject");
      url.searchParams.delete("template");
      url.searchParams.set("campaign", id);
      window.history.replaceState({}, "", url.toString());
      setCampaignId(id);
    } catch (err: any) {
      notify(err?.message || "Unable to create campaign", "error");
    } finally {
      setSavingCampaign(false);
    }
  };

  const handleOpenInTab = () => {
    const html = buildHtml();
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
    notify("Preview opened in a new tab", "info");
  };

  const handleSaveAsTemplate = () => setSaveDialogOpen(true);

  // "+ New template" — wipes the canvas back to a fresh blank document so the
  // user never starts a new template on top of yesterday's work. We confirm
  // first when there are existing sections, clear the localStorage-backed
  // history + autosave (so a reload won't bring the old draft back), and then
  // reset the store to a brand-new EmailDocument.
  const handleNewBlankTemplate = () => {
    const hasContent =
      doc.sections.length > 0 ||
      (doc.meta.subject && doc.meta.subject.trim().length > 0);
    const reset = () => {
      clearSaved();
      setDoc(newDocument());
      notify("Started a new blank template", "success");
    };
    if (!hasContent) {
      reset();
      return;
    }
    setConfirmDialog({
      isOpen: true,
      title: "Start a new template?",
      message:
        "This clears the current canvas. Any unsaved work will be lost. (Already-saved templates in the Templates dropdown are unaffected.)",
      confirmText: "Start blank",
      variant: "primary",
      action: () => {
        setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        reset();
      },
    });
  };

  const handleSaveConfirm = async (name: string, overwrite: boolean) => {
    try {
      if (overwrite) {
        const existing = userTemplates.find((t) => t.name === name);
        if (existing) {
          await updateUserTemplate(existing.id, name, doc);
          notify(`Template \"${name}\" overwritten`, "success");
        }
      } else {
        await saveUserTemplate(name, doc);
        notify(`Template \"${name}\" saved`, "success");
      }
      setRefresh((n) => n + 1);
    } catch (err: any) {
      notify(err?.message || "Failed to save template", "error");
    } finally {
      setSaveDialogOpen(false);
    }
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
      action: async () => {
        try {
          await deleteUserTemplate(id);
          setRefresh((n) => n + 1);
          notify(`Template \"${name}\" deleted`, "success");
        } catch (err: any) {
          notify(err?.message || "Failed to delete template", "error");
        } finally {
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  const closeConfirmDialog = () => {
    setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
  };

  return (
    <>
      {/* =====================================================================
          Cleaner SaaS toolbar.

          Visual goals (Benchmark-style):
          - One row of grouped chips; never more than two on mobile.
          - Subtle vertical separators between groups.
          - Light background, rounded buttons, consistent height (h-9).
          - Less noise: rare actions (Copy source, .eml, etc.) live inside a
            single "Export ▾" dropdown instead of cluttering the bar.
          - The "Manage" button is removed — the same destructive flow lives
            on the Templates dropdown / Saved templates dialog.
          ===================================================================== */}
      <div className="sticky top-0 z-30 bg-white border-b border-slate-200">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 sm:px-5 py-2.5">
          {/* Brand — clicks to the dashboard. */}
          <a
            href="/dashboard"
            className="flex items-center gap-2 font-semibold tracking-tight mr-1 hover:opacity-80 transition"
            title="Go to dashboard"
          >
            <span className="inline-flex items-center justify-center h-7 w-7 rounded-lg bg-gradient-to-br from-indigo-500 to-blue-600 text-white text-xs">
              ✉
            </span>
            <span className="hidden sm:inline">Email Builder</span>
          </a>

          {/* Explicit dashboard link so the back-out path is obvious even
              for users who don't realise the logo is clickable. */}
          <a
            href="/dashboard"
            className="hidden md:inline-flex items-center gap-1 h-9 px-3 rounded-lg text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition"
            title="Back to dashboard"
          >
            ← Dashboard
          </a>

          <Divider />

          {/* Template ops — load / new / save */}
          <div className="flex items-center gap-1.5">
            <select
              className="h-9 text-sm border border-slate-200 bg-white rounded-lg px-2.5 max-w-[180px] focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                <optgroup label="Saved">
                  {userTemplates.map((t) => (
                    <option key={t.id}>{t.name}</option>
                  ))}
                </optgroup>
              )}
            </select>
            <button
              onClick={handleNewBlankTemplate}
              className="h-9 inline-flex items-center gap-1 px-3 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition"
              title="Clear the canvas and start a brand-new blank template"
            >
              ＋ New
            </button>
            <button
              onClick={handleSaveAsTemplate}
              className="h-9 inline-flex items-center gap-1 px-3 rounded-lg border border-slate-200 text-sm text-slate-700 hover:bg-slate-50 transition"
              title="Save the current canvas as a reusable template"
            >
              Save
            </button>
            {!campaignId && pendingCampaignName && (
              <button
                onClick={handleCreateCampaign}
                disabled={savingCampaign}
                className="h-9 inline-flex items-center gap-1 px-3 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition"
                title="Create this campaign and save the current draft"
              >
                {savingCampaign ? "…" : "💾 Create"}
              </button>
            )}
            {campaignId && (
              <button
                onClick={handleSaveCampaign}
                disabled={savingCampaign}
                className="h-9 inline-flex items-center gap-1 px-3 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition"
                title="Save all changes to this campaign"
              >
                {savingCampaign ? "…" : "💾 Save"}
              </button>
            )}
          </div>

          <Divider />

          {/* History */}
          <div className="flex items-center gap-1">
            <IconButton onClick={undo} title="Undo (Cmd+Z)">
              ↶
            </IconButton>
            <IconButton onClick={redo} title="Redo (Cmd+Shift+Z)">
              ↷
            </IconButton>
          </div>

          {/* Right cluster — preview / export / send / auth */}
          <div className="flex items-center gap-1.5 ml-auto">
            <div className="hidden sm:inline-flex items-center rounded-lg border border-slate-200 bg-white overflow-hidden">
              <button
                onClick={() => onPreview("desktop")}
                className="h-9 px-3 text-sm text-slate-700 hover:bg-slate-50 transition"
                title="Desktop preview"
              >
                Desktop
              </button>
              <span className="w-px h-5 bg-slate-200" />
              <button
                onClick={() => onPreview("mobile")}
                className="h-9 px-3 text-sm text-slate-700 hover:bg-slate-50 transition"
                title="Mobile preview"
              >
                Mobile
              </button>
            </div>

            {/* Export dropdown — folds the four export/copy variants into one
                button so the bar isn't dominated by them. */}
            <ExportMenu
              onExportHtml={handleExport}
              onExportEml={handleExportEml}
              onCopyHtml={handleCopy}
              onCopyOutlook={handleCopyForOutlook}
              onOpenInTab={handleOpenInTab}
            />

            <button
              onClick={() => setSendOpen(true)}
              className="h-9 inline-flex items-center gap-1.5 px-3.5 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition"
              title="Send the current canvas via email"
            >
              ✉ Send
            </button>

            <Divider className="hidden md:block" />

            <button
              onClick={async () => {
                await fetch("/api/auth/logout", { method: "POST" });
                window.location.href = "/login";
              }}
              className="h-9 px-3 rounded-lg text-sm text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition"
              title="Sign out"
            >
              Sign out
            </button>
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

      {sendOpen && (
        <SendEmailDialog
          doc={doc}
          onClose={() => setSendOpen(false)}
          onSent={(msg) => {
            setSendOpen(false);
            notify(msg, "success");
          }}
          onError={(msg) => notify(msg, "error")}
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
