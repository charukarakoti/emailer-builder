"use client";

// =============================================================================
// /contacts — the reference vertical slice for every Phase-2 CRM feature.
//
// The page is intentionally plain HTML + Tailwind so it matches the existing
// /team page. The same building blocks (search bar, table, dialog, bulk
// action bar) will be reused for /lists, /tags, /campaigns once they're
// built.
// =============================================================================

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppShell, {
  GhostButton,
  PrimaryButton,
} from "@/components/AppShell";

interface ContactRow {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  status: string;
  createdAt: number;
  lists: { id: string; name: string }[];
  tags: { id: string; name: string; color: string | null }[];
}

interface ListRow {
  id: string;
  name: string;
  memberCount: number;
}

interface TagRow {
  id: string;
  name: string;
  color: string | null;
  usage: number;
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [total, setTotal] = useState(0);
  const [lists, setLists] = useState<ListRow[]>([]);
  const [tags, setTags] = useState<TagRow[]>([]);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [listFilter, setListFilter] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (statusFilter) params.set("status", statusFilter);
      if (listFilter) params.set("listId", listFilter);
      if (tagFilter) params.set("tagId", tagFilter);
      const [c, l, t] = await Promise.all([
        fetch(`/api/contacts?${params.toString()}`).then((r) => r.json()),
        fetch("/api/lists").then((r) => r.json()),
        fetch("/api/tags").then((r) => r.json()),
      ]);
      setContacts(c.contacts || []);
      setTotal(c.total || 0);
      setLists(l.lists || []);
      setTags(t.tags || []);
    } catch (e: any) {
      setError(e?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  // initial + re-fetch when filters change
  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, listFilter, tagFilter]);

  function toggleSelect(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  function toggleAll() {
    if (selected.size === contacts.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(contacts.map((c) => c.id)));
    }
  }

  async function bulkDelete() {
    if (selected.size === 0) return;
    if (!confirm(`Delete ${selected.size} contact(s)? This can't be undone.`))
      return;
    setError(null);
    const r = await fetch("/api/contacts/bulk", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ids: [...selected], action: "delete" }),
    });
    const data = await r.json();
    if (!r.ok) {
      setError(data.error || "Failed");
      return;
    }
    setStatus(`Deleted ${data.affected} contact(s).`);
    setSelected(new Set());
    await refresh();
  }

  const empty = contacts.length === 0 && !loading;

  return (
    <AppShell
      title="Contacts"
      actions={
        <>
          {/* CSV export — workspace-scoped; respects current filters by
              re-using the same query-string the list uses. */}
          <GhostButton
            onClick={() => {
              const params = new URLSearchParams();
              if (q) params.set("q", q);
              if (statusFilter) params.set("status", statusFilter);
              if (listFilter) params.set("listId", listFilter);
              if (tagFilter) params.set("tagId", tagFilter);
              window.location.href = `/api/contacts/export?${params}`;
            }}
          >
            Export CSV
          </GhostButton>
          <GhostButton onClick={() => setShowImport(true)}>
            Import CSV
          </GhostButton>
          <PrimaryButton onClick={() => setShowAdd(true)}>
            ＋ Add contact
          </PrimaryButton>
        </>
      }
    >
      <div className="space-y-4">
        <div className="text-sm text-slate-500">
          {total} contact{total === 1 ? "" : "s"} in this workspace
        </div>

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

        <section className="bg-white shadow rounded-lg p-4 space-y-3">
          <div className="flex flex-wrap gap-2 items-center">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && refresh()}
              placeholder="Search email or name…"
              className="flex-1 min-w-[200px] border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border border-gray-300 rounded px-2 py-1.5 text-sm"
            >
              <option value="">Any status</option>
              <option value="subscribed">Subscribed</option>
              <option value="unsubscribed">Unsubscribed</option>
              <option value="bounced">Bounced</option>
              <option value="complained">Complained</option>
              <option value="pending">Pending</option>
            </select>
            <select
              value={listFilter}
              onChange={(e) => setListFilter(e.target.value)}
              className="border border-gray-300 rounded px-2 py-1.5 text-sm"
            >
              <option value="">All lists</option>
              {lists.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} ({l.memberCount})
                </option>
              ))}
            </select>
            <select
              value={tagFilter}
              onChange={(e) => setTagFilter(e.target.value)}
              className="border border-gray-300 rounded px-2 py-1.5 text-sm"
            >
              <option value="">All tags</option>
              {tags.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <button
              onClick={refresh}
              className="border border-gray-300 rounded px-3 py-1.5 text-sm hover:bg-gray-100"
            >
              Search
            </button>
          </div>

          {selected.size > 0 && (
            <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded px-3 py-2 text-sm">
              <span className="text-blue-900 font-medium">
                {selected.size} selected
              </span>
              <button
                onClick={bulkDelete}
                className="text-red-600 hover:underline"
              >
                Delete
              </button>
              <button
                onClick={() => setSelected(new Set())}
                className="text-gray-500 hover:underline"
              >
                Clear
              </button>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left border-b border-gray-200">
                  <th className="py-2 w-8">
                    <input
                      type="checkbox"
                      checked={
                        selected.size > 0 && selected.size === contacts.length
                      }
                      onChange={toggleAll}
                    />
                  </th>
                  <th className="py-2">Email</th>
                  <th className="py-2">Name</th>
                  <th className="py-2">Status</th>
                  <th className="py-2">Lists</th>
                  <th className="py-2">Tags</th>
                  <th className="py-2 text-right">Added</th>
                </tr>
              </thead>
              <tbody>
                {contacts.map((c) => (
                  <tr key={c.id} className="border-b border-gray-100">
                    <td className="py-2">
                      <input
                        type="checkbox"
                        checked={selected.has(c.id)}
                        onChange={() => toggleSelect(c.id)}
                      />
                    </td>
                    <td className="py-2 font-medium text-gray-900">
                      {c.email}
                    </td>
                    <td className="py-2 text-gray-700">
                      {[c.firstName, c.lastName].filter(Boolean).join(" ") ||
                        "—"}
                    </td>
                    <td className="py-2">
                      <span
                        className={
                          c.status === "subscribed"
                            ? "text-green-700"
                            : c.status === "unsubscribed"
                            ? "text-gray-500"
                            : "text-amber-700"
                        }
                      >
                        {c.status}
                      </span>
                    </td>
                    <td className="py-2 text-gray-600">
                      {c.lists.map((l) => l.name).join(", ") || "—"}
                    </td>
                    <td className="py-2 text-gray-600">
                      {c.tags.map((t) => t.name).join(", ") || "—"}
                    </td>
                    <td className="py-2 text-right text-xs text-gray-500">
                      {new Date(c.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {empty && (
              <div className="text-center text-sm text-gray-500 py-10">
                No contacts yet. Click "Add contact" or "Import CSV".
              </div>
            )}
          </div>
        </section>
      </div>

      {showAdd && (
        <AddContactDialog
          lists={lists}
          tags={tags}
          onClose={() => setShowAdd(false)}
          onSaved={async (msg) => {
            setShowAdd(false);
            setStatus(msg);
            await refresh();
          }}
          onError={(e) => setError(e)}
        />
      )}
      {showImport && (
        <ImportCsvDialog
          lists={lists}
          tags={tags}
          onClose={() => setShowImport(false)}
          onImported={async (msg) => {
            setShowImport(false);
            setStatus(msg);
            await refresh();
          }}
          onError={(e) => setError(e)}
        />
      )}
    </AppShell>
  );
}

/* --------------------------- Add Contact Dialog --------------------------- */

function AddContactDialog({
  lists,
  tags,
  onClose,
  onSaved,
  onError,
}: {
  lists: ListRow[];
  tags: TagRow[];
  onClose: () => void;
  onSaved: (msg: string) => void;
  onError: (e: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [listIds, setListIds] = useState<string[]>([]);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const r = await fetch("/api/contacts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email,
        firstName,
        lastName,
        listIds,
        tagIds,
      }),
    });
    const data = await r.json();
    setSaving(false);
    if (!r.ok) {
      onError(data.error || "Failed");
      return;
    }
    onSaved(`Saved ${email}`);
  }

  return (
    <Modal title="Add contact" onClose={onClose}>
      <div className="space-y-3">
        <Field label="Email">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="First name">
            <input
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Last name">
            <input
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            />
          </Field>
        </div>
        <MultiPicker
          label="Lists"
          options={lists.map((l) => ({ id: l.id, label: l.name }))}
          selected={listIds}
          onChange={setListIds}
        />
        <MultiPicker
          label="Tags"
          options={tags.map((t) => ({ id: t.id, label: t.name }))}
          selected={tagIds}
          onChange={setTagIds}
        />
        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="text-sm border border-gray-300 rounded px-3 py-1.5 hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving || !email}
            className="text-sm bg-blue-600 text-white rounded px-3 py-1.5 hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* -------------------------- CSV Import Dialog ----------------------------- */

function ImportCsvDialog({
  lists,
  tags,
  onClose,
  onImported,
  onError,
}: {
  lists: ListRow[];
  tags: TagRow[];
  onClose: () => void;
  onImported: (msg: string) => void;
  onError: (e: string) => void;
}) {
  const [csv, setCsv] = useState("email,first_name,last_name\n");
  const [listId, setListId] = useState("");
  const [tagId, setTagId] = useState("");
  const [busy, setBusy] = useState(false);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setCsv(await f.text());
  }

  async function run() {
    setBusy(true);
    const params = new URLSearchParams();
    if (listId) params.set("listId", listId);
    if (tagId) params.set("tagId", tagId);
    const r = await fetch(`/api/contacts/import?${params}`, {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: csv,
    });
    const data = await r.json();
    setBusy(false);
    if (!r.ok) {
      onError(data.error || "Import failed");
      return;
    }
    onImported(
      `Imported: ${data.created} created, ${data.updated} updated, ${data.skipped} skipped`
    );
  }

  return (
    <Modal title="Import contacts from CSV" onClose={onClose}>
      <div className="space-y-3">
        <p className="text-xs text-gray-500">
          First row must be a header. Recognised columns:{" "}
          <code>email</code>, <code>first_name</code>, <code>last_name</code>,{" "}
          <code>status</code>. Extra columns are stored as custom attributes.
          Existing contacts (matched by email) are updated, not duplicated.
        </p>
        <input type="file" accept=".csv,text/csv" onChange={onFile} />
        <textarea
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
          rows={10}
          className="w-full font-mono text-xs border border-gray-300 rounded p-2"
        />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Add to list (optional)">
            <select
              value={listId}
              onChange={(e) => setListId(e.target.value)}
              className="w-full border border-gray-300 rounded px-2 py-2 text-sm"
            >
              <option value="">— none —</option>
              {lists.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Apply tag (optional)">
            <select
              value={tagId}
              onChange={(e) => setTagId(e.target.value)}
              className="w-full border border-gray-300 rounded px-2 py-2 text-sm"
            >
              <option value="">— none —</option>
              {tags.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="text-sm border border-gray-300 rounded px-3 py-1.5 hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            onClick={run}
            disabled={busy || !csv.trim()}
            className="text-sm bg-blue-600 text-white rounded px-3 py-1.5 hover:bg-blue-700 disabled:opacity-50"
          >
            {busy ? "Importing…" : "Import"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ------------------------------- shared ----------------------------------- */

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center px-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl p-5 w-full max-w-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="font-semibold mb-3">{title}</div>
        {children}
      </div>
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
      <span className="block text-gray-700 mb-1">{label}</span>
      {children}
    </label>
  );
}

function MultiPicker({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: { id: string; label: string }[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  function toggle(id: string) {
    if (selected.includes(id)) {
      onChange(selected.filter((x) => x !== id));
    } else {
      onChange([...selected, id]);
    }
  }
  if (!options.length) {
    return (
      <Field label={label}>
        <div className="text-xs text-gray-500">
          None created yet. Add them on /lists or /tags.
        </div>
      </Field>
    );
  }
  return (
    <Field label={label}>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button
            type="button"
            key={o.id}
            onClick={() => toggle(o.id)}
            className={
              "text-xs px-2 py-1 rounded border " +
              (selected.includes(o.id)
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50")
            }
          >
            {o.label}
          </button>
        ))}
      </div>
    </Field>
  );
}
