"use client";

// =============================================================================
// /campaigns — campaign list with status filter, search and per-row actions.
// "+ New campaign" leads to the builder; the campaign itself is captured by
// the existing Save / Send flow in the editor. Send/Schedule wizard is part
// of Phase 3 of the roadmap.
// =============================================================================

import { useEffect, useState } from "react";
import AppShell, {
  Card,
  EmptyState,
  GhostButton,
  PrimaryButton,
  StatCard,
} from "@/components/AppShell";

interface Camp {
  id: string;
  name: string;
  subject: string;
  status: string;
  scheduledAt: string | null;
  sentAt: string | null;
  recipientCount: number;
  template: { id: string; name: string } | null;
  createdAt: number;
}

const STATUS_CLASS: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700",
  scheduled: "bg-amber-100 text-amber-800",
  sending: "bg-blue-100 text-blue-700",
  sent: "bg-emerald-100 text-emerald-700",
  failed: "bg-rose-100 text-rose-700",
  canceled: "bg-slate-100 text-slate-500",
};

export default function CampaignsPage() {
  const [rows, setRows] = useState<Camp[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [showNew, setShowNew] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      const r = await fetch("/api/campaigns");
      const data = await r.json();
      setRows(data.campaigns || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const filtered = rows.filter((r) => {
    if (status && r.status !== status) return false;
    if (
      q &&
      !`${r.name} ${r.subject}`.toLowerCase().includes(q.toLowerCase())
    )
      return false;
    return true;
  });

  const counts = {
    draft: rows.filter((r) => r.status === "draft").length,
    scheduled: rows.filter((r) => r.status === "scheduled").length,
    sent: rows.filter((r) => r.status === "sent").length,
    recipients: rows.reduce((n, r) => n + r.recipientCount, 0),
  };

  return (
    <AppShell
      title="Campaigns"
      actions={
        <PrimaryButton onClick={() => setShowNew(true)}>
          ＋ New campaign
        </PrimaryButton>
      }
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <StatCard label="Drafts" value={counts.draft} tone="indigo" />
        <StatCard
          label="Scheduled"
          value={counts.scheduled}
          tone="amber"
        />
        <StatCard label="Sent" value={counts.sent} tone="emerald" />
        <StatCard
          label="Total recipients"
          value={counts.recipients}
          tone="rose"
        />
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search campaign name or subject…"
            className="flex-1 min-w-[220px] border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm bg-white"
          >
            <option value="">All statuses</option>
            <option value="draft">Draft</option>
            <option value="scheduled">Scheduled</option>
            <option value="sending">Sending</option>
            <option value="sent">Sent</option>
            <option value="failed">Failed</option>
            <option value="canceled">Canceled</option>
          </select>
          <GhostButton onClick={refresh}>Refresh</GhostButton>
        </div>

        {loading ? (
          <div className="text-sm text-slate-500 py-10 text-center">
            Loading…
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-10 text-center">
            <div className="text-3xl mb-2">✉</div>
            <div className="text-sm font-medium">
              {rows.length === 0
                ? "No campaigns yet"
                : "No campaigns match those filters"}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              Design an email in the builder, then save it as a campaign.
            </div>
            {rows.length === 0 && (
              <div className="mt-3">
                <PrimaryButton href="/">Open builder</PrimaryButton>
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-slate-500">
                <tr className="text-left border-b border-slate-200">
                  <th className="py-2 pr-3 font-medium">Campaign</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2 pr-3 font-medium">Recipients</th>
                  <th className="py-2 pr-3 font-medium">Template</th>
                  <th className="py-2 pr-3 font-medium text-right">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr
                    key={c.id}
                    className="border-b border-slate-100 hover:bg-slate-50"
                  >
                    <td className="py-2 pr-3">
                      <div className="font-medium">{c.name}</div>
                      <div className="text-xs text-slate-500 truncate max-w-md">
                        {c.subject || "(no subject)"}
                      </div>
                    </td>
                    <td className="py-2 pr-3">
                      <span
                        className={
                          "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium " +
                          (STATUS_CLASS[c.status] ||
                            "bg-slate-100 text-slate-700")
                        }
                      >
                        {c.status}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-slate-700">
                      {c.recipientCount}
                    </td>
                    <td className="py-2 pr-3 text-slate-700">
                      {c.template?.name || "—"}
                    </td>
                    <td className="py-2 pr-3 text-right text-xs text-slate-500">
                      {c.sentAt
                        ? `Sent ${new Date(c.sentAt).toLocaleDateString()}`
                        : c.scheduledAt
                        ? `Scheduled ${new Date(c.scheduledAt).toLocaleDateString()}`
                        : `Created ${new Date(c.createdAt).toLocaleDateString()}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {showNew && (
        <NewCampaignDialog
          onClose={() => setShowNew(false)}
          onSaved={async () => {
            setShowNew(false);
            await refresh();
          }}
        />
      )}
    </AppShell>
  );
}

function NewCampaignDialog({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    const r = await fetch("/api/campaigns", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, subject }),
    });
    const data = await r.json();
    setSaving(false);
    if (!r.ok) {
      setError(data.error || "Failed");
      return;
    }
    onSaved();
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
        <div className="font-semibold mb-3">New campaign</div>
        <div className="space-y-3 text-sm">
          <label className="block">
            <span className="block text-slate-600 mb-1">Internal name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Q4 product launch"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="block text-slate-600 mb-1">Subject line</span>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="What recipients see in their inbox"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
            />
          </label>
          <div className="text-xs text-slate-500">
            Saving here creates a <b>draft</b>. Design the email in the
            builder and use Save / Send to publish.
          </div>
          {error && (
            <div className="text-sm text-red-600">{error}</div>
          )}
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <PrimaryButton onClick={save} disabled={saving || !name}>
            {saving ? "…" : "Create draft"}
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}
