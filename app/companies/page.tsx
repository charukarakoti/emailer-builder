"use client";

// =============================================================================
// /companies — Company directory.
// Table of name / industry / website / linked-contact-count, search input,
// "+ New" dialog. Identical pattern to /contacts so the look + feel stays
// consistent across the SaaS pages.
// =============================================================================

import { useEffect, useState } from "react";
import AppShell, {
  Card,
  EmptyState,
  GhostButton,
  PrimaryButton,
} from "@/components/AppShell";

interface C {
  id: string;
  name: string;
  industry: string | null;
  website: string | null;
  notes: string | null;
  contactCount: number;
  createdAt: number;
}

export default function CompaniesPage() {
  const [rows, setRows] = useState<C[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      const r = await fetch(`/api/companies?${params}`);
      const data = await r.json();
      setRows(data.companies || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AppShell
      title="Companies"
      actions={
        <PrimaryButton onClick={() => setShowAdd(true)}>
          ＋ New company
        </PrimaryButton>
      }
    >
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

        <Card className="p-4">
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && refresh()}
              placeholder="Search company or industry…"
              className="flex-1 min-w-[200px] border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <GhostButton onClick={refresh}>Search</GhostButton>
          </div>

          {loading ? (
            <div className="text-sm text-slate-500 py-10 text-center">
              Loading…
            </div>
          ) : rows.length === 0 ? (
            <div className="py-10 text-center">
              <div className="text-sm text-slate-500">
                No companies yet. Add one to start linking contacts.
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto mt-3">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left border-b border-slate-200 text-slate-500">
                    <th className="py-2 pr-3 font-medium">Company</th>
                    <th className="py-2 pr-3 font-medium">Industry</th>
                    <th className="py-2 pr-3 font-medium">Website</th>
                    <th className="py-2 pr-3 font-medium text-right">
                      Contacts
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((c) => (
                    <tr
                      key={c.id}
                      className="border-b border-slate-100 hover:bg-slate-50"
                    >
                      <td className="py-2 pr-3 font-medium text-slate-900">
                        {c.name}
                      </td>
                      <td className="py-2 pr-3 text-slate-700">
                        {c.industry || "—"}
                      </td>
                      <td className="py-2 pr-3 text-indigo-600">
                        {c.website ? (
                          <a
                            href={c.website}
                            target="_blank"
                            rel="noreferrer"
                            className="hover:underline"
                          >
                            {c.website.replace(/^https?:\/\//, "")}
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="py-2 pr-3 text-right text-slate-700">
                        {c.contactCount}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {showAdd && (
        <AddCompanyDialog
          onClose={() => setShowAdd(false)}
          onSaved={async (msg) => {
            setShowAdd(false);
            setStatus(msg);
            await refresh();
          }}
          onError={setError}
        />
      )}
    </AppShell>
  );
}

function AddCompanyDialog({
  onClose,
  onSaved,
  onError,
}: {
  onClose: () => void;
  onSaved: (msg: string) => void;
  onError: (m: string) => void;
}) {
  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("");
  const [website, setWebsite] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const r = await fetch("/api/companies", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, industry, website, notes }),
    });
    const data = await r.json();
    setSaving(false);
    if (!r.ok) {
      onError(data.error || "Failed");
      return;
    }
    onSaved(`Saved ${name}`);
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center px-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl p-5 w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="font-semibold text-base mb-3">New company</div>
        <div className="space-y-3 text-sm">
          <label className="block">
            <span className="block text-slate-600 mb-1">Name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="block text-slate-600 mb-1">Industry</span>
            <input
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              placeholder="SaaS, Healthcare, Manufacturing…"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="block text-slate-600 mb-1">Website</span>
            <input
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="block text-slate-600 mb-1">Notes</span>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
            />
          </label>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <PrimaryButton onClick={save} disabled={saving || !name}>
            {saving ? "Saving…" : "Save"}
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}
