"use client";

// =============================================================================
// /designations — manage job titles / designations for tagging contacts.
// Chip-style display with usage count + a quick-add form at the top.
// =============================================================================

import { useEffect, useState } from "react";
import AppShell, {
  Card,
  EmptyState,
  PrimaryButton,
} from "@/components/AppShell";

interface D {
  id: string;
  name: string;
  category: string | null;
  usage: number;
}

const CATEGORIES = [
  "engineering",
  "sales",
  "marketing",
  "executive",
  "operations",
  "other",
];

export default function DesignationsPage() {
  const [rows, setRows] = useState<D[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("other");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    try {
      const r = await fetch("/api/designations");
      const data = await r.json();
      setRows(data.designations || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function add() {
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    const r = await fetch("/api/designations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, category }),
    });
    const data = await r.json();
    setSaving(false);
    if (!r.ok) {
      setError(data.error || "Failed");
      return;
    }
    setName("");
    await refresh();
  }

  return (
    <AppShell title="Designations">
      <div className="space-y-5">
        <Card className="p-5">
          <div className="text-sm font-semibold mb-3">Add a designation</div>
          <div className="flex flex-wrap gap-2 items-center">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && add()}
              placeholder="Software Engineer, Sales Director…"
              className="flex-1 min-w-[200px] border border-slate-200 rounded-lg px-3 py-2 text-sm"
            />
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <PrimaryButton onClick={add} disabled={saving || !name.trim()}>
              {saving ? "…" : "Add"}
            </PrimaryButton>
          </div>
          {error && (
            <div className="mt-2 text-sm text-red-600">{error}</div>
          )}
        </Card>

        <Card className="p-5">
          <div className="text-sm font-semibold mb-3">
            All designations ({rows.length})
          </div>
          {loading ? (
            <div className="text-sm text-slate-500 py-6 text-center">
              Loading…
            </div>
          ) : rows.length === 0 ? (
            <div className="text-sm text-slate-500 py-6 text-center">
              No designations yet — add one above.
            </div>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {rows.map((d) => (
                <li
                  key={d.id}
                  className="inline-flex items-center gap-2 pl-3 pr-2 py-1 rounded-full text-sm bg-slate-100 text-slate-700"
                >
                  <span>{d.name}</span>
                  <span className="text-xs text-slate-500">
                    {d.category || "other"}
                  </span>
                  <span className="text-xs bg-white text-slate-600 rounded-full px-2 py-0.5 border border-slate-200">
                    {d.usage}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </AppShell>
  );
}
