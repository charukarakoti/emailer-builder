"use client";

// =============================================================================
// /settings — workspace + profile + SMTP health.
//
// Sections:
//   • Workspace — rename (OWNER only)
//   • Profile — read-only display name + email
//   • Email delivery — fires POST /api/send/test against your own inbox so
//     you can validate the .env values without sending the real campaign.
//
// Designed to be progressive — most controls degrade gracefully if the
// underlying API responds with 403 (e.g. non-owners see the workspace
// section read-only).
// =============================================================================

import { useEffect, useState } from "react";
import AppShell, {
  Card,
  GhostButton,
  PrimaryButton,
} from "@/components/AppShell";

interface Me {
  user: { id: string; email: string; name: string | null } | null;
  activeTeam: { id: string; name: string } | null;
  teams: { id: string; name: string; role: "OWNER" | "MEMBER" }[];
}

export default function SettingsPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // SMTP test
  const [testEmail, setTestEmail] = useState("");
  const [testing, setTesting] = useState(false);
  const [testStatus, setTestStatus] = useState<string | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  async function refresh() {
    const data = await fetch("/api/auth/me").then((r) => r.json());
    setMe(data);
    setName(data?.activeTeam?.name || "");
    if (data?.user?.email) setTestEmail((p) => p || data.user.email);
  }
  useEffect(() => {
    refresh();
  }, []);

  const myRole =
    me?.teams.find((t) => t.id === me?.activeTeam?.id)?.role ?? "MEMBER";

  async function saveWorkspace() {
    setError(null);
    setStatus(null);
    setSaving(true);
    const r = await fetch("/api/workspace", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const data = await r.json();
    setSaving(false);
    if (!r.ok) {
      setError(data.error || "Failed");
      return;
    }
    setStatus("Workspace renamed.");
    await refresh();
  }

  async function runSmtpTest() {
    setTestStatus(null);
    setTestError(null);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(testEmail)) {
      setTestError("Enter a valid email address.");
      return;
    }
    setTesting(true);
    const r = await fetch("/api/send/test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        to: testEmail,
        subject: "Email Builder — SMTP test",
      }),
    });
    const data = await r.json();
    setTesting(false);
    if (!r.ok) {
      setTestError(data?.error || "Test send failed");
      return;
    }
    setTestStatus(
      `Sent a test email to ${testEmail}. Check that inbox to confirm delivery.`
    );
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <AppShell title="Settings">
      {me === null ? (
        <div className="text-sm text-slate-500">Loading…</div>
      ) : !me.user ? (
        <div className="text-sm">
          <a href="/login" className="text-indigo-600 underline">
            Sign in
          </a>{" "}
          to view settings.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column — primary settings */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="p-5">
              <SectionHeading
                title="Workspace"
                subtitle="Shared with everyone you invite."
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                <Field label="Workspace name">
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={myRole !== "OWNER"}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50"
                  />
                </Field>
                <Field label="Your role">
                  <div className="h-10 inline-flex items-center px-3 rounded-lg bg-slate-100 text-sm text-slate-700">
                    {myRole}
                  </div>
                </Field>
              </div>
              {myRole === "OWNER" ? (
                <div className="mt-4 flex gap-2 justify-end">
                  <PrimaryButton
                    onClick={saveWorkspace}
                    disabled={saving || !name.trim()}
                  >
                    {saving ? "Saving…" : "Save changes"}
                  </PrimaryButton>
                </div>
              ) : (
                <div className="mt-3 text-xs text-slate-500">
                  Only the workspace owner can rename the workspace.
                </div>
              )}
              {status && (
                <div className="mt-3 text-sm bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg px-3 py-2">
                  {status}
                </div>
              )}
              {error && (
                <div className="mt-3 text-sm bg-rose-50 border border-rose-200 text-rose-700 rounded-lg px-3 py-2">
                  {error}
                </div>
              )}
            </Card>

            <Card className="p-5">
              <SectionHeading
                title="Email delivery"
                subtitle="Send a test message to confirm your SMTP credentials work end-to-end."
              />
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2 items-end">
                <Field label="Send test to">
                  <input
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </Field>
                <PrimaryButton
                  onClick={runSmtpTest}
                  disabled={testing || !testEmail}
                >
                  {testing ? "Sending…" : "Send test"}
                </PrimaryButton>
              </div>
              <div className="mt-3 text-xs text-slate-500">
                SMTP settings live in <code>.env</code> (<code>SMTP_HOST</code>,
                <code>SMTP_USER</code>, etc.). Edit them and restart{" "}
                <code>npm run dev</code> if you change providers.
              </div>
              {testStatus && (
                <div className="mt-3 text-sm bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg px-3 py-2">
                  {testStatus}
                </div>
              )}
              {testError && (
                <div className="mt-3 text-sm bg-rose-50 border border-rose-200 text-rose-700 rounded-lg px-3 py-2">
                  {testError}
                </div>
              )}
            </Card>
          </div>

          {/* Right column — profile & quick links */}
          <div className="space-y-6">
            <Card className="p-5">
              <SectionHeading title="Profile" />
              <div className="mt-3 flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 text-white text-sm flex items-center justify-center font-medium">
                  {(me.user.name || me.user.email)
                    .charAt(0)
                    .toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="font-medium truncate">
                    {me.user.name || me.user.email}
                  </div>
                  <div className="text-xs text-slate-500 truncate">
                    {me.user.email}
                  </div>
                </div>
              </div>
              <button
                onClick={logout}
                className="mt-4 w-full h-9 inline-flex items-center justify-center rounded-lg border border-slate-200 text-sm hover:bg-slate-50"
              >
                Sign out
              </button>
            </Card>

            <Card className="p-5">
              <SectionHeading title="Your workspaces" />
              <ul className="mt-3 divide-y divide-slate-100">
                {me.teams.map((t) => (
                  <li
                    key={t.id}
                    className="py-2 flex items-center justify-between text-sm"
                  >
                    <span className="truncate mr-2">{t.name}</span>
                    <span
                      className={
                        "text-xs px-2 py-0.5 rounded " +
                        (me.activeTeam?.id === t.id
                          ? "bg-indigo-100 text-indigo-700"
                          : "bg-slate-100 text-slate-600")
                      }
                    >
                      {me.activeTeam?.id === t.id ? "Active" : t.role}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function SectionHeading({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div>
      <div className="text-sm font-semibold">{title}</div>
      {subtitle && (
        <div className="text-xs text-slate-500 mt-0.5">{subtitle}</div>
      )}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-sm">
      <span className="block text-slate-600 mb-1.5">{label}</span>
      {children}
    </label>
  );
}
