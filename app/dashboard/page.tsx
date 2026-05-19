"use client";

// =============================================================================
// /dashboard — landing page for signed-in users. Stat cards, a delivery /
// opens bar chart, and the most recent activity. All numbers come from
// /api/dashboard which queries the workspace-scoped tables.
// =============================================================================

import { useEffect, useState } from "react";
import AppShell, {
  Card,
  EmptyState,
  PrimaryButton,
  StatCard,
  useBuilderChooser,
} from "@/components/AppShell";

interface DashboardData {
  stats: {
    campaigns: number;
    contacts: number;
    templates: number;
    openRate: number;
    deliveryRate: number;
    delivered: number;
    bounces: number;
  };
  series: { day: string; delivered: number; opens: number }[];
  activity: {
    id: string;
    action: string;
    target: string | null;
    meta: any;
    createdAt: number;
    user: { email: string; name: string | null } | null;
  }[];
}

const ACTION_LABEL: Record<string, string> = {
  "email.sent": "Email sent",
  "contact.created": "Contact added",
  "contact.updated": "Contact updated",
  "contact.deleted": "Contact removed",
  "contacts.imported": "Contacts imported",
  "template.created": "Template created",
  "template.updated": "Template updated",
};

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then((d) => {
        setData(d);
      })
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  const maxBar = Math.max(
    1,
    ...(data?.series.flatMap((p) => [p.delivered, p.opens]) || [0])
  );

  return (
    <AppShell
      title="Dashboard"
      actions={<DashboardActions />}
    >
      {/* Hero stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Campaigns"
          value={data?.stats.campaigns ?? (loading ? "…" : 0)}
          delta="All time"
          tone="indigo"
        />
        <StatCard
          label="Contacts"
          value={data?.stats.contacts ?? (loading ? "…" : 0)}
          delta="In workspace"
          tone="emerald"
        />
        <StatCard
          label="Open rate"
          value={
            data ? `${data.stats.openRate}%` : loading ? "…" : "0%"
          }
          delta={`${data?.stats.delivered ?? 0} delivered`}
          tone="amber"
        />
        <StatCard
          label="Delivery rate"
          value={
            data ? `${data.stats.deliveryRate}%` : loading ? "…" : "100%"
          }
          delta={`${data?.stats.bounces ?? 0} bounces`}
          tone="rose"
        />
      </div>

      {/* Chart + activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-6">
        <Card className="p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-sm font-semibold">Last 14 days</div>
              <div className="text-xs text-slate-500">
                Delivered vs opens
              </div>
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
          {data && data.series.some((p) => p.delivered + p.opens > 0) ? (
            <div className="flex items-end gap-1.5 h-44">
              {data.series.map((p) => (
                <div
                  key={p.day}
                  className="flex-1 flex flex-col items-center gap-0.5 group"
                  title={`${p.day} — delivered ${p.delivered}, opens ${p.opens}`}
                >
                  <div className="w-full flex items-end gap-0.5 h-40">
                    <div
                      className="flex-1 bg-indigo-500/80 rounded-t"
                      style={{
                        height: `${(p.delivered / maxBar) * 100}%`,
                      }}
                    />
                    <div
                      className="flex-1 bg-amber-400/80 rounded-t"
                      style={{
                        height: `${(p.opens / maxBar) * 100}%`,
                      }}
                    />
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    {p.day.slice(5)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-sm text-slate-500 py-12">
              {loading
                ? "Loading…"
                : "No email events yet. Send a campaign to populate this chart."}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <div className="text-sm font-semibold mb-3">Recent activity</div>
          {data && data.activity.length > 0 ? (
            <ul className="divide-y divide-slate-100">
              {data.activity.map((a) => (
                <li key={a.id} className="py-2.5 flex items-start gap-3">
                  <div className="h-7 w-7 rounded-full bg-slate-100 text-slate-500 text-xs flex items-center justify-center mt-0.5">
                    {(a.user?.name || a.user?.email || "?")
                      .charAt(0)
                      .toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate">
                      {ACTION_LABEL[a.action] || a.action}
                    </div>
                    <div className="text-xs text-slate-500">
                      {new Date(a.createdAt).toLocaleString()}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-sm text-slate-500 py-6 text-center">
              {loading ? "Loading…" : "No activity yet."}
            </div>
          )}
        </Card>
      </div>

      {/* Quick links */}
      <DashboardQuickLinks />
    </AppShell>
  );
}

/**
 * Dashboard header actions — the "＋ New campaign" button summons the
 * HTML/Visual chooser modal exposed by AppShell. Pulled into its own
 * sub-component so it can call useBuilderChooser() (which requires the
 * AppShell context to already be mounted above).
 */
function DashboardActions() {
  const chooser = useBuilderChooser();
  return (
    <PrimaryButton onClick={() => chooser.open()}>
      ＋ New campaign
    </PrimaryButton>
  );
}

/**
 * Quick-link cards under the chart. The "Design an email" tile opens the
 * chooser instead of jumping straight into /, so the user picks HTML vs
 * Visual before they land on an editor.
 */
function DashboardQuickLinks() {
  const chooser = useBuilderChooser();
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
      <QuickLink
        title="Design an email"
        body="Open a builder. We'll ask which editor — Visual drag-and-drop or raw HTML — fits the task."
        cta="Open builder →"
        onClick={() => chooser.open()}
      />
      <QuickLink
        title="Import contacts"
        body="Bring in CSV exports from your CRM. Add to lists and tags."
        href="/contacts"
        cta="Go to Contacts →"
      />
      <QuickLink
        title="Browse templates"
        body="Reuse one of your saved designs as the starting point."
        href="/templates"
        cta="Open gallery →"
      />
    </div>
  );
}

function QuickLink({
  title,
  body,
  href,
  cta,
  onClick,
}: {
  title: string;
  body: string;
  href?: string;
  cta: string;
  onClick?: () => void;
}) {
  const inner = (
    <span className="inline-block mt-3 text-sm font-medium text-indigo-600 hover:text-indigo-700">
      {cta}
    </span>
  );
  return (
    <Card className="p-5 hover:shadow-md transition">
      <div className="text-sm font-semibold">{title}</div>
      <div className="mt-1 text-sm text-slate-500">{body}</div>
      {href ? (
        <a href={href}>{inner}</a>
      ) : (
        <button onClick={onClick} className="text-left">
          {inner}
        </button>
      )}
    </Card>
  );
}
