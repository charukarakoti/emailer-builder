"use client";

// =============================================================================
// /campaigns — campaign list with status filter, search and per-row actions.
// + New campaign opens a campaign-specific builder flow. Campaign drafts store
// their own email content so edits do not mutate the original template.
// =============================================================================

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppShell, {
  Card,
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
  const router = useRouter();
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
                <PrimaryButton onClick={() => setShowNew(true)}>
                  Open builder
                </PrimaryButton>
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
                      <a href={`/?campaign=${encodeURIComponent(c.id)}`} className="font-medium hover:underline block">
                        {c.name}
                      </a>
                      <div className="text-xs text-slate-500 truncate max-w-md">
                        {c.subject || "(no subject)"}
                      </div>
                      <a
                        href={`/?campaign=${encodeURIComponent(c.id)}`}
                        className="text-xs text-indigo-600 hover:underline mt-1 inline-block"
                      >
                        Edit draft
                      </a>
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

      {showNew && <NewCampaignDialog onClose={() => setShowNew(false)} />}
    </AppShell>
  );
}

function NewCampaignDialog({
  onClose,
}: {
  onClose: () => void;
}) {
  const router = useRouter();
  const [step, setStep] = useState<"choice" | "form">("choice");
  const [mode, setMode] = useState<"blank" | "template">("blank");
  const [templates, setTemplates] = useState<{ id: string; name: string }[]>(
    []
  );
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (step === "form" && mode === "template") {
      void loadTemplates();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, mode]);

  async function loadTemplates() {
    setLoadingTemplates(true);
    try {
      const r = await fetch("/api/templates");
      const data = await r.json();
      setTemplates(data.templates || []);
    } catch {
      setTemplates([]);
    } finally {
      setLoadingTemplates(false);
    }
  }

  function start(mode: "blank" | "template") {
    setMode(mode);
    setStep("form");
    setError(null);
    if (mode === "template") {
      void loadTemplates();
    }
  }

  function reset() {
    setStep("choice");
    setMode("blank");
    setSelectedTemplate("");
    setName("");
    setSubject("");
    setError(null);
  }

  async function createCampaign() {
    if (!name.trim()) {
      setError("Campaign name is required.");
      return;
    }
    if (mode === "template" && !selectedTemplate) {
      setError("Please choose a template to continue.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      // For template-mode we do NOT create a campaign immediately. Instead
      // navigate to the builder with the chosen template and the desired
      // campaign name/subject in the URL so the user can edit and then
      // explicitly create/save the campaign from the builder.
      if (mode === "template") {
        onClose();
        reset();
        const url = new URL(window.location.href);
        url.pathname = "/";
        url.searchParams.set("template", selectedTemplate);
        url.searchParams.set("campaignName", name.trim());
        url.searchParams.set("campaignSubject", subject.trim());
        router.push(url.toString());
        return;
      }

      // Blank mode: create campaign immediately and open builder for editing.
      const body: Record<string, unknown> = {
        name: name.trim(),
        subject: subject.trim(),
      };
      const r = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (!r.ok) {
        throw new Error(data.error || "Unable to create campaign.");
      }
      const campaignId = data.campaign?.id;
      if (!campaignId) {
        throw new Error("Campaign created without an ID.");
      }
      onClose();
      reset();
      router.push(`/?campaign=${encodeURIComponent(campaignId)}`);
    } catch (err: any) {
      setError(err?.message || "Unable to create campaign.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center px-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl p-5 w-full max-w-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {step === "choice" ? (
          <>
            <div className="font-semibold mb-3">Open builder</div>
            <div className="text-sm text-slate-600 mb-4">
              Choose how you want to start this campaign.
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                onClick={() => start("template")}
                className="rounded-2xl border border-slate-200 p-5 text-left hover:border-indigo-400 hover:shadow-sm transition"
              >
                <div className="text-indigo-600 font-semibold mb-2">
                  Template
                </div>
                <div className="text-sm text-slate-600">
                  Pick an existing template from the Templates section and
                  use it inside this campaign. Changes made here will stay in
                  the campaign draft and won't modify the original template.
                </div>
              </button>
              <button
                onClick={() => start("blank")}
                className="rounded-2xl border border-slate-200 p-5 text-left hover:border-indigo-400 hover:shadow-sm transition"
              >
                <div className="text-indigo-600 font-semibold mb-2">
                  Blank
                </div>
                <div className="text-sm text-slate-600">
                  Start from scratch with an empty builder. When saved, the
                  campaign will be stored under Campaigns.
                </div>
              </button>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <GhostButton onClick={onClose}>Cancel</GhostButton>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="font-semibold text-lg">
                  {mode === "template"
                    ? "New campaign from template"
                    : "New blank campaign"}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  Enter a campaign name and subject. The draft will open in
                  the builder immediately.
                </div>
              </div>
              <button
                onClick={() => {
                  reset();
                }}
                className="text-sm text-slate-500 hover:text-slate-700"
              >
                ← Back
              </button>
            </div>
            <div className="space-y-4 text-sm">
              {mode === "template" && (
                <label className="block">
                  <span className="block text-slate-600 mb-1">
                    Template
                  </span>
                  <select
                    value={selectedTemplate}
                    onChange={(e) => setSelectedTemplate(e.target.value)}
                    disabled={loadingTemplates}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="">Select a template</option>
                    {templates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name}
                      </option>
                    ))}
                  </select>
                  {loadingTemplates && (
                    <div className="mt-2 text-xs text-slate-400">
                      Loading templates…
                    </div>
                  )}
                  {!loadingTemplates && templates.length === 0 && (
                    <div className="mt-2 text-xs text-rose-600">
                      No templates available. Add templates in the Templates
                      section first.
                    </div>
                  )}
                </label>
              )}
              <label className="block">
                <span className="block text-slate-600 mb-1">Campaign name</span>
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
              {error && (
                <div className="text-sm text-rose-600">{error}</div>
              )}
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <GhostButton onClick={onClose}>Cancel</GhostButton>
              <PrimaryButton
                onClick={createCampaign}
                disabled={
                  saving ||
                  (mode === "template" && templates.length === 0)
                }
              >
                {saving ? "Opening…" : "Open builder"}
              </PrimaryButton>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
