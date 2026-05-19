"use client";

// =============================================================================
// /reports — delivery + open analytics across all campaigns.
// Pulls aggregated counts from /api/dashboard for now; per-campaign drill-in
// is part of Phase 4 (tracking pixel + click-through redirects).
// =============================================================================

import { useEffect, useState } from "react";
import AppShell, {
  Card,
  EmptyState,
  PrimaryButton,
  StatCard,
  useBuilderChooser,
} from "@/components/AppShell";

interface Data {
  stats: {
    delivered: number;
    bounces: number;
    openRate: number;
    deliveryRate: number;
  };
  series: { day: string; delivered: number; opens: number }[];
}

// Header CTA — pops the chooser modal exposed by AppShell.
function ReportsActions() {
  const chooser = useBuilderChooser();
  return (
    <PrimaryButton onClick={() => chooser.open()}>
      ＋ Send a campaign
    </PrimaryButton>
  );
}

export default function ReportsPage() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  const maxBar = Math.max(
    1,
    ...(data?.series.flatMap((p) => [p.delivered, p.opens]) || [0])
  );
  const empty =
    !data || (data.stats.delivered === 0 && data.stats.bounces === 0);

  return (
    <AppShell title="Reports" actions={<ReportsActions />}>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <StatCard
          label="Delivered"
          value={data?.stats.delivered ?? (loading ? "…" : 0)}
          tone="emerald"
        />
        <StatCard
          label="Bounces"
          value={data?.stats.bounces ?? (loading ? "…" : 0)}
          tone="rose"
        />
        <StatCard
          label="Open rate"
          value={data ? `${data.stats.openRate}%` : loading ? "…" : "0%"}
          tone="amber"
        />
        <StatCard
          label="Delivery rate"
          value={
            data ? `${data.stats.deliveryRate}%` : loading ? "…" : "100%"
          }
          tone="indigo"
        />
      </div>

      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-sm font-semibold">Delivery timeline</div>
            <div className="text-xs text-slate-500">Last 14 days</div>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-indigo-500" />
              Delivered
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-amber-400" />
              Opens
            </span>
          </div>
        </div>
        {empty ? (
          <div className="py-10 text-center text-sm text-slate-500">
            {loading
              ? "Loading…"
              : "No email events yet. Send a campaign to populate this chart."}
          </div>
        ) : (
          <div className="flex items-end gap-1.5 h-48">
            {data!.series.map((p) => (
              <div
                key={p.day}
                className="flex-1 flex flex-col items-center gap-0.5"
                title={`${p.day} — delivered ${p.delivered}, opens ${p.opens}`}
              >
                <div className="w-full flex items-end gap-0.5 h-44">
                  <div
                    className="flex-1 bg-indigo-500/80 rounded-t"
                    style={{ height: `${(p.delivered / maxBar) * 100}%` }}
                  />
                  <div
                    className="flex-1 bg-amber-400/80 rounded-t"
                    style={{ height: `${(p.opens / maxBar) * 100}%` }}
                  />
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  {p.day.slice(5)}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-5 mt-4">
        <div className="text-sm font-semibold mb-2">Coming soon</div>
        <div className="text-sm text-slate-600">
          Per-campaign breakdowns, click-through tracking, device and geo
          analytics, and CSV export are part of <b>Phase 4</b> of the roadmap
          (<code>ARCHITECTURE.md</code>). The tables that store these signals
          (<code>EmailEvent</code>) are already live; the dashboards land
          here.
        </div>
      </Card>
    </AppShell>
  );
}
