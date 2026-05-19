"use client";

// =============================================================================
// /cvs — CV / resume library with drag-and-drop upload.
// Uploads go through /api/cvs (multipart/form-data → /public/uploads/cvs/).
// Click any row to open the file in a new tab.
// =============================================================================

import { useEffect, useRef, useState } from "react";
import AppShell, {
  Card,
  EmptyState,
  GhostButton,
  PrimaryButton,
} from "@/components/AppShell";

interface CvRow {
  id: string;
  title: string;
  url: string;
  filename: string;
  contentType: string | null;
  sizeBytes: number | null;
  createdAt: number;
  contact: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  } | null;
}

function prettyBytes(b: number | null): string {
  if (!b) return "—";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

export default function CvsPage() {
  const [rows, setRows] = useState<CvRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function refresh() {
    setLoading(true);
    try {
      const r = await fetch("/api/cvs");
      const data = await r.json();
      setRows(data.cvs || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function upload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);
    setStatus(null);
    let ok = 0;
    let fail = 0;
    for (const f of Array.from(files)) {
      const fd = new FormData();
      fd.append("file", f);
      const r = await fetch("/api/cvs", { method: "POST", body: fd });
      if (r.ok) ok++;
      else {
        fail++;
        const d = await r.json().catch(() => ({}));
        setError(d.error || "Upload failed");
      }
    }
    setUploading(false);
    if (ok > 0) setStatus(`Uploaded ${ok} file${ok === 1 ? "" : "s"}.`);
    await refresh();
  }

  return (
    <AppShell
      title="CVs"
      actions={
        <PrimaryButton onClick={() => inputRef.current?.click()}>
          {uploading ? "Uploading…" : "＋ Upload CV"}
        </PrimaryButton>
      }
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.doc,.docx,.txt"
        multiple
        className="hidden"
        onChange={(e) => upload(e.target.files)}
      />

      <div className="space-y-4">
        {status && (
          <div className="text-sm bg-green-50 border border-green-200 text-green-700 rounded px-3 py-2">
            {status}
          </div>
        )}
        {error && (
          <div className="text-sm bg-red-50 border border-red-200 text-red-700 rounded px-3 py-2">
            {error}
          </div>
        )}

        <Card
          className={
            "p-8 text-center transition border-2 border-dashed " +
            (dragging
              ? "border-indigo-400 bg-indigo-50/50"
              : "border-slate-200")
          }
        >
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              upload(e.dataTransfer.files);
            }}
          >
            <div className="text-3xl mb-2">📄</div>
            <div className="text-sm font-medium">
              Drag and drop CVs here, or
              <button
                onClick={() => inputRef.current?.click()}
                className="text-indigo-600 hover:underline ml-1"
              >
                browse
              </button>
            </div>
            <div className="text-xs text-slate-500 mt-1">
              PDF, DOC, DOCX, TXT — up to 10 MB each
            </div>
          </div>
        </Card>

        <Card className="p-0 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-200 text-sm font-semibold">
            Library ({rows.length})
          </div>
          {loading ? (
            <div className="text-sm text-slate-500 py-10 text-center">
              Loading…
            </div>
          ) : rows.length === 0 ? (
            <div className="text-sm text-slate-500 py-10 text-center">
              No CVs uploaded yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-slate-500">
                  <tr className="text-left">
                    <th className="px-5 py-2 font-medium">Title</th>
                    <th className="px-5 py-2 font-medium">Type</th>
                    <th className="px-5 py-2 font-medium">Size</th>
                    <th className="px-5 py-2 font-medium">Linked to</th>
                    <th className="px-5 py-2 font-medium text-right">
                      Uploaded
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((c) => (
                    <tr
                      key={c.id}
                      className="border-t border-slate-100 hover:bg-slate-50"
                    >
                      <td className="px-5 py-2 font-medium">
                        <a
                          href={c.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-indigo-600 hover:underline"
                        >
                          {c.title}
                        </a>
                        <div className="text-xs text-slate-500 truncate max-w-xs">
                          {c.filename}
                        </div>
                      </td>
                      <td className="px-5 py-2 text-slate-600">
                        {(c.contentType || "—").replace(
                          "application/",
                          ""
                        )}
                      </td>
                      <td className="px-5 py-2 text-slate-600">
                        {prettyBytes(c.sizeBytes)}
                      </td>
                      <td className="px-5 py-2 text-slate-600">
                        {c.contact
                          ? [
                              c.contact.firstName,
                              c.contact.lastName,
                            ]
                              .filter(Boolean)
                              .join(" ") || c.contact.email
                          : "—"}
                      </td>
                      <td className="px-5 py-2 text-right text-xs text-slate-500">
                        {new Date(c.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </AppShell>
  );
}
