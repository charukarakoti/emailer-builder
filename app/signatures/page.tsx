"use client";

// =============================================================================
// /signatures — workspace signature library.
// Lists every saved signature with a live HTML preview thumbnail and the
// usual Use / Delete affordances. "+ New signature" creates a draft and
// hands you to the editor.
// =============================================================================

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppShell, {
  Card,
  EmptyState,
  GhostButton,
  PrimaryButton,
} from "@/components/AppShell";

interface SigRow {
  id: string;
  name: string;
  doc: any;
  createdAt: number;
  updatedAt: number;
  isMine: boolean;
}

export default function SignaturesListPage() {
  const router = useRouter();
  const [rows, setRows] = useState<SigRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      const r = await fetch("/api/signatures");
      const data = await r.json();
      setRows((data.signatures || []) as SigRow[]);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    refresh();
  }, []);

  async function createNew() {
    setCreating(true);
    setError(null);
    const r = await fetch("/api/signatures", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "New signature" }),
    });
    const data = await r.json();
    setCreating(false);
    if (!r.ok) {
      setError(data.error || "Couldn't create signature");
      return;
    }
    router.push(`/signatures/${data.signature.id}`);
  }

  async function remove(s: SigRow) {
    if (!confirm(`Delete signature "${s.name}"?`)) return;
    const r = await fetch(`/api/signatures/${s.id}`, { method: "DELETE" });
    if (r.ok) {
      setStatus(`Deleted "${s.name}".`);
      await refresh();
    } else {
      const d = await r.json().catch(() => ({}));
      setError(d.error || "Delete failed");
    }
  }

  return (
    <AppShell
      title="Signatures"
      actions={
        <PrimaryButton onClick={createNew} disabled={creating}>
          {creating ? "Creating…" : "＋ New signature"}
        </PrimaryButton>
      }
    >
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

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="p-4">
              <div className="h-40 bg-slate-100 rounded animate-pulse" />
            </Card>
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          title="No signatures yet"
          description="Design a reusable email sign-off — name, role, contact details, social links — that anyone in your workspace can paste into Gmail, Outlook, or attach to a campaign."
          cta={
            <PrimaryButton onClick={createNew}>
              ＋ Create your first signature
            </PrimaryButton>
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {rows.map((s) => (
            <SignatureCard
              key={s.id}
              s={s}
              onOpen={() => router.push(`/signatures/${s.id}`)}
              onDelete={() => remove(s)}
            />
          ))}
        </div>
      )}
    </AppShell>
  );
}

function SignatureCard({
  s,
  onOpen,
  onDelete,
}: {
  s: SigRow;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const [html, setHtml] = useState<string | null>(null);
  useEffect(() => {
    fetch(`/api/signatures/${s.id}/render?full=1`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setHtml(d?.html || ""))
      .catch(() => setHtml(""));
  }, [s.id]);

  return (
    <Card className="overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition">
      <button
        onClick={onOpen}
        className="block w-full h-44 bg-white overflow-hidden border-b border-slate-100"
        title="Open editor"
      >
        {html ? (
          <iframe
            title={`Signature ${s.name}`}
            srcDoc={html}
            sandbox=""
            className="w-full h-full bg-white pointer-events-none"
          />
        ) : (
          <div className="h-full flex items-center justify-center text-slate-300 text-3xl">
            ✍
          </div>
        )}
      </button>
      <div className="p-4 flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <div className="font-medium truncate">{s.name}</div>
          <div className="text-xs text-slate-500">
            Updated {new Date(s.updatedAt).toLocaleDateString()}
          </div>
        </div>
        <GhostButton onClick={onOpen}>Edit</GhostButton>
        {s.isMine && (
          <button
            onClick={onDelete}
            className="h-9 w-9 inline-flex items-center justify-center rounded-md border border-slate-200 text-rose-600 hover:bg-rose-50"
            title="Delete"
          >
            🗑
          </button>
        )}
      </div>
    </Card>
  );
}
