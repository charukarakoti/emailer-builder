"use client";

import { useEffect, useState } from "react";
import AppShell, { Card, GhostButton, PrimaryButton } from "@/components/AppShell";

interface Member {
  id: string;
  email: string;
  name: string | null;
  role: string;
  joinedAt: string;
}

interface Activity {
  id: string;
  action: string;
  target: string | null;
  meta: Record<string, unknown> | null;
  user: { id: string; email: string; name: string | null } | null;
  createdAt: number;
}

interface Invite {
  id: string;
  code: string;
  email: string | null;
  createdAt: string;
  expiresAt: string;
  redeemedAt: string | null;
}

interface Me {
  user: { id: string; email: string; name: string | null } | null;
  activeTeam: { id: string; name: string } | null;
  teams: { id: string; name: string; role: "OWNER" | "MEMBER" }[];
}

export default function AdminPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [revoking, setRevoking] = useState<Record<string, boolean>>({});
  const [passwords, setPasswords] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    refresh();
  }, []);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const [meRes, membersRes, activityRes, invitesRes] = await Promise.all([
        fetch("/api/auth/me"),
        fetch("/api/teams/members"),
        fetch("/api/activity"),
        fetch("/api/teams/invite"),
      ]);
      const meData = await meRes.json();
      const membersData = await membersRes.json();
      const activityData = await activityRes.json();
      const invitesData = await invitesRes.json();
      setMe(meData);
      setMembers(membersData.members || []);
      setActivity(activityData.activity || []);
      setInvites(invitesData.invites || []);
    } catch (err) {
      setError("Failed to load admin data.");
    } finally {
      setLoading(false);
    }
  }

  const isOwner = me?.teams.some(
    (t) => t.id === me?.activeTeam?.id && t.role === "OWNER"
  );

  const loginActivity = activity.filter((item) => item.action === "user.logged_in");

  async function createInvite() {
    setInviteLoading(true);
    setError(null);
    setStatus(null);
    setInviteLink(null);

    try {
      const res = await fetch("/api/teams/invite", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: inviteEmail.trim() ? inviteEmail.trim().toLowerCase() : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create invite");
      }
      const url = `${window.location.origin}/signup?invite=${encodeURIComponent(
        data.invite.code
      )}`;
      setInviteLink(url);
      setInviteEmail("");
      setStatus("Invite created successfully.");
      await refresh();
    } catch (err: any) {
      setError(err?.message || "Failed to create invite.");
    } finally {
      setInviteLoading(false);
    }
  }

  async function revokeInvite(inviteId: string) {
    setRevoking((prev) => ({ ...prev, [inviteId]: true }));
    setError(null);
    setStatus(null);
    try {
      const res = await fetch("/api/teams/invite", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: inviteId }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to revoke invite");
      }
      setInvites((prev) => prev.filter((invite) => invite.id !== inviteId));
      setStatus("Invite revoked successfully.");
    } catch (err: any) {
      setError(err?.message || "Failed to revoke invite.");
    } finally {
      setRevoking((prev) => ({ ...prev, [inviteId]: false }));
    }
  }

  async function resetPassword(userId: string) {
    const password = passwords[userId] || "";
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setSaving((prev) => ({ ...prev, [userId]: true }));
    setError(null);
    setStatus(null);
    try {
      const res = await fetch("/api/admin/password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update password");
      }
      setPasswords((prev) => ({ ...prev, [userId]: "" }));
      setStatus("Password updated successfully.");
    } catch (err: any) {
      setError(err?.message || "Failed to update password.");
    } finally {
      setSaving((prev) => ({ ...prev, [userId]: false }));
    }
  }

  return (
    <AppShell title="Admin">
      {loading ? (
        <div className="text-sm text-slate-500">Loading…</div>
      ) : !me?.user ? (
        <div className="text-sm">
          <a href="/login" className="text-indigo-600 underline">
            Sign in
          </a>{" "}
          to access admin tools.
        </div>
      ) : !isOwner ? (
        <Card className="p-5">
          <div className="text-lg font-semibold mb-3">Admin access required</div>
          <div className="text-sm text-slate-600">
            Only workspace owners can manage team users and passwords.
          </div>
        </Card>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-xl font-semibold">Workspace admin</h2>
              <p className="text-sm text-slate-500 mt-1">
                Manage team membership, review sign-ins, and reset passwords.
              </p>
            </div>
            <GhostButton onClick={refresh}>Refresh</GhostButton>
          </div>

          {status && (
            <div className="text-sm bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg px-4 py-3">
              {status}
            </div>
          )}
          {error && (
            <div className="text-sm bg-rose-50 border border-rose-200 text-rose-700 rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          <Card className="p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-4">
              <div>
                <div className="text-sm font-semibold">Invite teammates</div>
                <div className="text-xs text-slate-500">
                  Create a new invite code for the current workspace.
                </div>
              </div>
              <div className="text-xs text-slate-400">
                Leave email blank for an open invite.
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="Optional email address"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <PrimaryButton onClick={createInvite} disabled={inviteLoading}>
                {inviteLoading ? "Creating…" : "Create invite"}
              </PrimaryButton>
            </div>
            {inviteLink && (
              <div className="mt-4 rounded-xl bg-slate-50 border border-slate-200 p-4 text-sm text-slate-700">
                <div className="font-medium text-slate-900">Invite link</div>
                <div className="mt-2 break-all">
                  <a
                    href={inviteLink}
                    className="text-indigo-600 underline"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {inviteLink}
                  </a>
                </div>
              </div>
            )}
            {invites.length > 0 ? (
              <div className="mt-6 overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="text-slate-500 text-left">
                    <tr>
                      <th className="py-2 pr-4">Code</th>
                      <th className="py-2 pr-4">Email</th>
                      <th className="py-2 pr-4">Status</th>
                      <th className="py-2 pr-4">Expires</th>
                      <th className="py-2 pr-4">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invites.map((invite) => (
                      <tr key={invite.id} className="border-t border-slate-100 hover:bg-slate-50">
                        <td className="py-3 pr-4 text-slate-900 font-medium">
                          <code className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-600">
                            {invite.code}
                          </code>
                        </td>
                        <td className="py-3 pr-4 text-slate-600">
                          {invite.email || "Open"}
                        </td>
                        <td className="py-3 pr-4 text-slate-600">
                          {invite.redeemedAt ? "Redeemed" : "Pending"}
                        </td>
                        <td className="py-3 pr-4 text-slate-600 text-xs">
                          {new Date(invite.expiresAt).toLocaleDateString()}
                        </td>
                        <td className="py-3 pr-4">
                          {!invite.redeemedAt ? (
                            <PrimaryButton
                              onClick={() => revokeInvite(invite.id)}
                              disabled={revoking[invite.id]}
                            >
                              {revoking[invite.id] ? "Revoking…" : "Revoke"}
                            </PrimaryButton>
                          ) : (
                            <span className="text-xs text-slate-500">Locked</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="mt-6 text-sm text-slate-500">
                No outstanding invites yet.
              </div>
            )}
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-sm font-semibold">Team members</div>
                <div className="text-xs text-slate-500">
                  Users on your current workspace.
                </div>
              </div>
              <div className="text-xs text-slate-400">Passwords are hidden.</div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-slate-500 text-left">
                  <tr>
                    <th className="py-2 pr-4">Name</th>
                    <th className="py-2 pr-4">Email</th>
                    <th className="py-2 pr-4">Role</th>
                    <th className="py-2 pr-4">Joined</th>
                    <th className="py-2 pr-4">Reset password</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((member) => (
                    <tr
                      key={member.id}
                      className="border-t border-slate-100 hover:bg-slate-50"
                    >
                      <td className="py-3 pr-4">
                        <div className="font-medium">
                          {member.name || member.email}
                        </div>
                      </td>
                      <td className="py-3 pr-4 text-slate-600">
                        {member.email}
                      </td>
                      <td className="py-3 pr-4">
                        <span className="inline-flex rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">
                          {member.role}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-slate-600 text-xs">
                        {new Date(member.joinedAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 pr-4">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                          <input
                            type="password"
                            value={passwords[member.id] || ""}
                            onChange={(e) =>
                              setPasswords((prev) => ({
                                ...prev,
                                [member.id]: e.target.value,
                              }))
                            }
                            placeholder="New password"
                            className="min-w-[180px] border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                          <PrimaryButton
                            onClick={() => resetPassword(member.id)}
                            disabled={
                              saving[member.id] ||
                              !(passwords[member.id] || "").trim().length
                            }
                          >
                            {saving[member.id] ? "Saving…" : "Save"}
                          </PrimaryButton>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="p-5">
              <div className="text-sm font-semibold mb-3">Recent sign-ins</div>
              {loginActivity.length > 0 ? (
                <ul className="space-y-3 text-sm text-slate-700">
                  {loginActivity.slice(0, 12).map((item) => (
                    <li key={item.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="font-medium">
                            {item.user?.name || item.user?.email || "Unknown user"}
                          </div>
                          <div className="text-xs text-slate-500">
                            {item.user?.email || ""}
                          </div>
                        </div>
                        <div className="text-xs text-slate-500">
                          {new Date(item.createdAt).toLocaleString()}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-sm text-slate-500 py-10 text-center">
                  No sign-in activity yet.
                </div>
              )}
            </Card>

            <Card className="p-5">
              <div className="text-sm font-semibold mb-3">Workspace activity</div>
              {activity.length > 0 ? (
                <ul className="space-y-3 text-sm text-slate-700">
                  {activity.slice(0, 12).map((item) => (
                    <li key={item.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-medium">{item.action}</div>
                          <div className="text-xs text-slate-500">
                            {item.user?.email || "System"}
                            {item.target ? ` · ${item.target}` : ""}
                          </div>
                        </div>
                        <div className="text-xs text-slate-500">
                          {new Date(item.createdAt).toLocaleString()}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-sm text-slate-500 py-10 text-center">
                  No activity yet.
                </div>
              )}
            </Card>
          </div>
        </div>
      )}
    </AppShell>
  );
}
