"use client";

// =============================================================================
// /html-editor — split-screen source editor + live preview.
//
//   ┌────────────────────────────────┬────────────────────────────────┐
//   │ Source code (textarea)         │ Live preview (iframe)          │
//   │  - line numbers                │  - Desktop / Mobile toggle     │
//   │  - paste / import / file       │  - srcDoc-based                │
//   │  - autosave to localStorage    │  - updates ~250ms after typing │
//   └────────────────────────────────┴────────────────────────────────┘
//
// Saving stores the HTML on the workspace via /api/templates with the
// `rawHtml` shape so the template gallery, send dialog, and preview
// modal all pick it up automatically.
// =============================================================================

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import AppShell, {
  Card,
  GhostButton,
  PrimaryButton,
} from "@/components/AppShell";
import { formatHtml } from "@/lib/htmlFormat";
import { pdfFileToHtml } from "@/lib/pdfToHtml";

const LS_KEY = "email-builder:html-editor:v1";

const STARTER_HTML = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td align="center" style="padding:32px 12px;">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border-radius:8px;">
            <tr>
              <td style="padding:32px;">
                <h1 style="margin:0 0 8px;font-size:24px;color:#111827;">Hello there</h1>
                <p style="margin:0 0 16px;font-size:14px;color:#374151;line-height:1.6;">
                  This is a starter email. Replace this content with your own
                  HTML — the preview on the right updates as you type.
                </p>
                <a href="https://example.com" style="display:inline-block;padding:10px 20px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:600;">
                  Get started
                </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

// useSearchParams must be wrapped in <Suspense> for Next.js 14's static
// prerender. Splitting the wrapper from the editor body keeps the
// build clean.
export default function HtmlEditorPage() {
  return (
    <Suspense fallback={null}>
      <HtmlEditor />
    </Suspense>
  );
}

function HtmlEditor() {
  const search = useSearchParams();
  const templateId = search.get("template");

  const [source, setSource] = useState("");
  const [subject, setSubject] = useState("");
  const [debounced, setDebounced] = useState("");
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSave, setShowSave] = useState(false);
  const [saveName, setSaveName] = useState("");
  // Send-email dialog — POSTs the raw HTML to /api/send with the rawHtml
  // shape (added in the SMTP polish round). No prior "Save" required.
  const [showSend, setShowSend] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Initial hydrate — four sources, first non-empty wins:
  //   1. ?fresh=1        → always start with the starter HTML (clears cache)
  //   2. ?template=<id>  → fetch from API
  //   3. localStorage    → previous draft
  //   4. starter HTML    → seed
  useEffect(() => {
    let cancelled = false;
    const fresh = search.get("fresh") === "1";
    if (fresh) {
      try {
        window.localStorage.removeItem(LS_KEY);
      } catch {
        /* ignore */
      }
      setSource(STARTER_HTML);
      // Strip the param so a refresh doesn't keep re-seeding.
      const url = new URL(window.location.href);
      url.searchParams.delete("fresh");
      window.history.replaceState({}, "", url.toString());
      return;
    }
    (async () => {
      if (templateId) {
        try {
          const r = await fetch(
            `/api/templates/${encodeURIComponent(templateId)}`
          );
          const data = await r.json();
          if (!cancelled && data?.template) {
            const doc: any = data.template.doc;
            if (doc?._kind === "html") {
              setSource(doc.html || "");
              setSubject(doc.subject || "");
              setSaveName(data.template.name || "");
              return;
            }
            // Visual-builder template → render to HTML so user can fork it.
            const rr = await fetch(
              `/api/templates/${encodeURIComponent(templateId)}/render`
            );
            const rd = await rr.json();
            if (!cancelled && rd?.html) {
              setSource(rd.html);
              setSaveName(`${data.template.name} (HTML copy)`);
              return;
            }
          }
        } catch {
          /* fall through */
        }
      }
      const cached = typeof window !== "undefined"
        ? window.localStorage.getItem(LS_KEY)
        : null;
      if (cached && !cancelled) {
        try {
          const parsed = JSON.parse(cached) as {
            source: string;
            subject: string;
          };
          setSource(parsed.source || STARTER_HTML);
          setSubject(parsed.subject || "");
          return;
        } catch {
          /* ignore */
        }
      }
      if (!cancelled) setSource(STARTER_HTML);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounce the source into the iframe so typing doesn't lag on big HTML.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(source), 250);
    return () => clearTimeout(t);
  }, [source]);

  // Local autosave so a refresh doesn't wipe a draft.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const id = setTimeout(() => {
      try {
        window.localStorage.setItem(
          LS_KEY,
          JSON.stringify({ source, subject })
        );
      } catch {
        /* quota — ignore */
      }
    }, 600);
    return () => clearTimeout(id);
  }, [source, subject]);

  const lineCount = useMemo(() => source.split("\n").length, [source]);

  async function onImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setError(null);
    setStatus(null);
    const lower = f.name.toLowerCase();

    // PDF → render every page to a JPEG and stitch into table-based HTML.
    // Fully email-safe (image-only) but layout-perfect.
    if (lower.endsWith(".pdf") || f.type === "application/pdf") {
      try {
        setStatus(`Converting ${f.name}…`);
        const result = await pdfFileToHtml(f, {
          maxWidthPx: 600,
          scale: 1.5,
          onProgress: (done, total) => {
            setStatus(`Converting ${f.name} · page ${done}/${total}…`);
          },
        });
        setSource(formatHtml(result.html));
        setSaveName((p) => p || f.name.replace(/\.[^.]+$/, ""));
        setStatus(
          `Imported ${f.name} · ${result.pageCount} page${
            result.pageCount === 1 ? "" : "s"
          } · ${(result.bytes / 1024).toFixed(0)} KB`
        );
      } catch (err: any) {
        setError(err?.message || "Couldn't convert PDF");
      }
      // Reset the input so picking the same file again re-fires onChange.
      e.target.value = "";
      return;
    }

    // HTML/HTM/TXT → auto-format on import so the source pane stays tidy.
    try {
      const text = await f.text();
      const pretty = lower.endsWith(".html") || lower.endsWith(".htm")
        ? formatHtml(text)
        : text;
      setSource(pretty);
      setSaveName((p) => p || f.name.replace(/\.[^.]+$/, ""));
      setStatus(`Imported ${f.name} (${(f.size / 1024).toFixed(1)} KB)`);
    } catch (err: any) {
      setError(err?.message || "Couldn't read file");
    }
    e.target.value = "";
  }

  // Manual "Format" — reflows the current source through the formatter.
  // Useful after pasting minified HTML or after editing.
  function formatNow() {
    const pretty = formatHtml(source);
    setSource(pretty);
    setStatus("Reformatted.");
  }

  function copySource() {
    navigator.clipboard.writeText(source).then(
      () => setStatus("HTML copied to clipboard"),
      () => setError("Copy failed — your browser may have blocked it.")
    );
  }

  function downloadHtml() {
    const blob = new Blob([source], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(saveName || "email").replace(/\s+/g, "-")}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function saveToLibrary() {
    if (!saveName.trim()) {
      setError("Give the template a name first.");
      return;
    }
    setSaving(true);
    setError(null);
    setStatus(null);
    const r = await fetch("/api/templates", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: saveName.trim(),
        rawHtml: source,
        subject,
      }),
    });
    const data = await r.json();
    setSaving(false);
    setShowSave(false);
    if (!r.ok) {
      setError(data.error || "Save failed");
      return;
    }
    setStatus(`Saved "${data.template.name}" to your library.`);
  }

  return (
    <AppShell
      title="HTML editor"
      actions={
        <>
          <GhostButton onClick={() => fileRef.current?.click()}>
            Import file
          </GhostButton>
          <GhostButton onClick={formatNow}>Format</GhostButton>
          <GhostButton onClick={copySource}>Copy source</GhostButton>
          <GhostButton onClick={downloadHtml}>Download .html</GhostButton>
          <GhostButton onClick={() => setShowSave(true)}>
            Save to library
          </GhostButton>
          {/* Send — opens the SendHtmlDialog; ships the source HTML through
              POST /api/send via the new rawHtml shape. No save required. */}
          <button
            onClick={() => setShowSend(true)}
            disabled={!source.trim()}
            className="h-9 inline-flex items-center gap-1.5 px-3.5 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition"
            title="Send this HTML through your SMTP account"
          >
            ✉ Send email
          </button>
        </>
      }
    >
      {/* Import file types:
            .html / .htm / .txt → read text, optionally auto-format
            .pdf                → render each page to an image and emit
                                  email-safe table HTML (see lib/pdfToHtml) */}
      <input
        ref={fileRef}
        type="file"
        accept=".html,.htm,.txt,.pdf,text/html,application/pdf"
        onChange={onImportFile}
        className="hidden"
      />

      {status && (
        <div className="mb-4 text-sm bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg px-3 py-2">
          {status}
        </div>
      )}
      {error && (
        <div className="mb-4 text-sm bg-rose-50 border border-rose-200 text-rose-700 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-[calc(100vh-180px)] min-h-[520px]">
        {/* ---------------------- Source editor ---------------------- */}
        <Card className="overflow-hidden flex flex-col">
          <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-100 bg-slate-50">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Source
            </span>
            <span className="text-xs text-slate-400">{lineCount} lines</span>
            <div className="ml-auto text-xs text-slate-400">
              Autosaves locally · {source.length.toLocaleString()} chars
            </div>
          </div>
          <div className="flex-1 flex overflow-hidden">
            <pre
              className="select-none text-right px-2 py-3 text-[12px] leading-[1.5] font-mono text-slate-400 bg-slate-50 border-r border-slate-100 overflow-hidden"
              aria-hidden="true"
            >
              {Array.from({ length: lineCount }, (_, i) => i + 1).join("\n")}
            </pre>
            <textarea
              value={source}
              onChange={(e) => setSource(e.target.value)}
              spellCheck={false}
              className="flex-1 p-3 text-[12px] leading-[1.5] font-mono text-slate-800 focus:outline-none resize-none w-full"
              placeholder="Paste your email HTML here…"
            />
          </div>
        </Card>

        {/* ---------------------- Live preview ---------------------- */}
        <Card className="overflow-hidden flex flex-col">
          <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-100 bg-slate-50">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Live preview
            </span>
            <div className="ml-auto inline-flex rounded-md border border-slate-200 bg-white overflow-hidden">
              <button
                onClick={() => setDevice("desktop")}
                className={
                  "px-3 py-1 text-xs " +
                  (device === "desktop"
                    ? "bg-indigo-600 text-white"
                    : "text-slate-600 hover:bg-slate-50")
                }
              >
                Desktop
              </button>
              <button
                onClick={() => setDevice("mobile")}
                className={
                  "px-3 py-1 text-xs " +
                  (device === "mobile"
                    ? "bg-indigo-600 text-white"
                    : "text-slate-600 hover:bg-slate-50")
                }
              >
                Mobile
              </button>
            </div>
          </div>
          <div className="flex-1 bg-slate-100 overflow-auto p-4 flex justify-center">
            <iframe
              title="Email preview"
              srcDoc={debounced}
              sandbox=""
              style={{ width: device === "mobile" ? 380 : "100%" }}
              className="h-full min-h-[420px] bg-white shadow-md rounded transition-all"
            />
          </div>
        </Card>
      </div>

      {/* ------------------------ Send dialog ----------------------- */}
      {showSend && (
        <SendHtmlDialog
          defaultSubject={subject || saveName}
          html={source}
          onClose={() => setShowSend(false)}
          onSent={(msg) => {
            setShowSend(false);
            setStatus(msg);
          }}
          onError={(msg) => setError(msg)}
        />
      )}

      {/* ------------------------ Save dialog ----------------------- */}
      {showSave && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center px-4"
          onClick={() => setShowSave(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="font-semibold mb-3">Save HTML template</div>
            <div className="space-y-3 text-sm">
              <label className="block">
                <span className="block text-slate-600 mb-1">Name</span>
                <input
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Promo newsletter — v3"
                />
              </label>
              <label className="block">
                <span className="block text-slate-600 mb-1">
                  Default subject{" "}
                  <span className="text-slate-400 font-normal">(optional)</span>
                </span>
                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Suggested subject line for new sends"
                />
              </label>
              <div className="text-xs text-slate-500">
                Saves to your workspace's template library. The Send dialog and
                preview modal will render the exact HTML below — no
                modifications.
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <GhostButton onClick={() => setShowSave(false)}>
                Cancel
              </GhostButton>
              <PrimaryButton
                onClick={saveToLibrary}
                disabled={saving || !saveName.trim()}
              >
                {saving ? "Saving…" : "Save"}
              </PrimaryButton>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

/* ------------------------------------------------------------------ */
/*  SendHtmlDialog                                                     */
/*                                                                     */
/*  Same visual treatment as the builder's SendEmailDialog — kept here */
/*  to avoid coupling the editor page to the builder bundle. POSTs the */
/*  raw HTML to /api/send via the new `rawHtml` shape (no Template row */
/*  required), so users can fire off ad-hoc HTML emails without saving.*/
/* ------------------------------------------------------------------ */

function SendHtmlDialog({
  html,
  defaultSubject,
  onClose,
  onSent,
  onError,
}: {
  html: string;
  defaultSubject: string;
  onClose: () => void;
  onSent: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState(defaultSubject || "");
  const [fromName, setFromName] = useState("");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<{ email: string; error: string }[]>([]);
  const [success, setSuccess] = useState<string | null>(null);
  const [inlineError, setInlineError] = useState<string | null>(null);

  const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
  const parsed = to
    .split(/[\s,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const valid = parsed.filter((e) => EMAIL_RE.test(e));
  const invalid = parsed.filter((e) => !EMAIL_RE.test(e));

  async function send() {
    setInlineError(null);
    setSuccess(null);
    setFailed([]);
    if (valid.length === 0) {
      setInlineError("Add at least one valid recipient.");
      return;
    }
    if (!subject.trim()) {
      setInlineError("Subject is required.");
      return;
    }
    setBusy(true);
    try {
      const r = await fetch("/api/send", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          to: valid,
          subject,
          rawHtml: html,
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
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-5 pb-3 border-b border-slate-100">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center text-base shadow-sm">
              ✉
            </div>
            <div>
              <div className="font-semibold text-base text-slate-900">
                Send HTML email
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                Delivers the source on the left through your SMTP account.
                One message per recipient. No save required.
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
          <div>
            <label className="block text-sm">
              <span className="block text-slate-700 font-medium mb-1.5">
                Recipients
              </span>
              <textarea
                value={to}
                onChange={(e) => setTo(e.target.value)}
                rows={3}
                placeholder="alice@example.com, bob@example.com"
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

          <div className="text-xs text-slate-500 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
            <strong className="text-slate-700">Heads up:</strong> the sender
            address is fixed to <code>SMTP_FROM</code> in your{" "}
            <code>.env</code>. Only the display name above changes.
          </div>

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
              disabled={busy || valid.length === 0 || !subject.trim()}
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
