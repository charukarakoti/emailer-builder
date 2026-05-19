"use client";

// =============================================================================
// components/AppShell.tsx — SaaS chrome around every dashboard page.
//
// Sidebar (left, fixed-width on desktop, slide-over on mobile) hosts the
// module nav. Top bar carries the page title, a global search input, the
// workspace badge and the user menu (sign-out, switch workspace, open
// builder). The builder route at `/` is intentionally NOT wrapped — the
// existing editor UI stays unchanged.
//
// Usage in a page:
//
//   import AppShell from "@/components/AppShell";
//   export default function Page() {
//     return (
//       <AppShell title="Dashboard">
//         <div>…content…</div>
//       </AppShell>
//     );
//   }
// =============================================================================

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import NewTemplateModal from "./NewTemplateModal";

// ---------------------------------------------------------------------------
// BuilderChooser context
//
// Every page that mounts AppShell automatically gets the "Open builder?
// HTML or Visual?" chooser modal. Any descendant component can pop it open
// by calling `useBuilderChooser().open()` — no prop drilling required.
// Pages should prefer this over linking directly to "/" so users land on
// the right editor for the work they're starting.
// ---------------------------------------------------------------------------

interface BuilderChooserCtx {
  open: () => void;
}
const BuilderChooserContext = createContext<BuilderChooserCtx | null>(null);

export function useBuilderChooser(): BuilderChooserCtx {
  const ctx = useContext(BuilderChooserContext);
  if (ctx) return ctx;
  // Fallback for pages that render outside AppShell — just navigate.
  return {
    open: () => {
      if (typeof window !== "undefined") window.location.href = "/";
    },
  };
}

interface Me {
  user: { email: string; name: string | null } | null;
  activeTeam: { id: string; name: string } | null;
}

const NAV: { href: string; label: string; icon: string; soon?: boolean }[] = [
  { href: "/dashboard", label: "Dashboard", icon: "▦" },
  { href: "/campaigns", label: "Campaigns", icon: "✉" },
  { href: "/contacts", label: "Contacts", icon: "👤" },
  { href: "/companies", label: "Companies", icon: "🏢" },
  { href: "/designations", label: "Designations", icon: "🏷" },
  { href: "/cvs", label: "CVs", icon: "📄" },
  { href: "/templates", label: "Templates", icon: "▤" },
  { href: "/signatures", label: "Signatures", icon: "✍" },
  { href: "/html-editor", label: "HTML editor", icon: "</>" },
  { href: "/media", label: "Media", icon: "🖼" },
  { href: "/reports", label: "Reports", icon: "📊" },
  { href: "/settings", label: "Settings", icon: "⚙" },
];

export default function AppShell({
  title,
  actions,
  children,
}: {
  title: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [search, setSearch] = useState("");
  // Builder-chooser modal — controlled here so any AppShell page can open
  // it via the context below.
  const [chooserOpen, setChooserOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then(setMe)
      .catch(() => setMe({ user: null, activeTeam: null }));
  }, []);

  // Close the profile menu when the user clicks elsewhere.
  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [menuOpen]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  // Lightweight global search — keywords route to the most relevant module.
  function runSearch(q: string) {
    const term = q.trim();
    if (!term) return;
    const lower = term.toLowerCase();
    const target = (() => {
      if (/campaign/.test(lower)) return "/campaigns";
      if (/contact|subscriber|list/.test(lower)) return "/contacts";
      if (/compan/.test(lower)) return "/companies";
      if (/template/.test(lower)) return "/templates";
      if (/report|analytic|open|deliver/.test(lower)) return "/reports";
      if (/cv|resume/.test(lower)) return "/cvs";
      if (/design/.test(lower)) return "/designations";
      if (/setting/.test(lower)) return "/settings";
      // Default: search inside contacts (the most likely target by volume).
      return `/contacts?q=${encodeURIComponent(term)}`;
    })();
    router.push(target);
  }

  return (
    <BuilderChooserContext.Provider
      value={{ open: () => setChooserOpen(true) }}
    >
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* ----- Mobile sidebar backdrop ----- */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* ----- Sidebar ----- */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200 transform transition-transform lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="h-16 flex items-center px-5 border-b border-slate-200">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 font-semibold tracking-tight"
          >
            <span className="inline-flex items-center justify-center h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500 to-blue-600 text-white text-sm">
              ✉
            </span>
            <span>Mailcraft</span>
          </Link>
        </div>
        <nav className="px-3 py-4 space-y-0.5">
          {NAV.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition " +
                  (active
                    ? "bg-indigo-50 text-indigo-700 font-medium"
                    : "text-slate-600 hover:bg-slate-100")
                }
              >
                <span
                  className={
                    "inline-flex items-center justify-center w-5 text-base " +
                    (active ? "text-indigo-600" : "text-slate-400")
                  }
                >
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="absolute left-3 right-3 bottom-3">
          {/* "Open builder" — opens the HTML / Visual chooser instead of
              jumping straight to /. The chooser routes to /?fresh=1 or
              /html-editor?fresh=1 depending on the picked editor. */}
          <button
            onClick={() => {
              setOpen(false);
              setChooserOpen(true);
            }}
            className="flex items-center justify-center gap-2 w-full bg-slate-900 text-white text-sm px-3 py-2 rounded-lg hover:bg-black transition"
          >
            <span>＋</span> Open builder
          </button>
          <div className="mt-3 px-2 text-xs text-slate-500">
            <div className="font-medium text-slate-700 truncate">
              {me?.activeTeam?.name || "—"}
            </div>
            <div className="truncate">{me?.user?.email || "Signed out"}</div>
          </div>
        </div>
      </aside>

      {/* ----- Main column ----- */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-white/80 backdrop-blur border-b border-slate-200">
          <div className="h-16 flex items-center gap-3 px-4 sm:px-6">
            <button
              onClick={() => setOpen(true)}
              className="lg:hidden inline-flex items-center justify-center h-9 w-9 rounded-lg border border-slate-200 hover:bg-slate-100"
              aria-label="Open menu"
            >
              ☰
            </button>
            <h1 className="text-lg font-semibold truncate">{title}</h1>
            <div className="hidden md:flex flex-1 max-w-md ml-4">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  runSearch(search);
                }}
                className="relative w-full"
              >
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  🔍
                </span>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search campaigns, contacts, templates…"
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </form>
            </div>
            <div className="ml-auto flex items-center gap-2">
              {actions}
              {/* Profile dropdown — replaces the previous standalone Sign-out
                  button. Anchored to the avatar, opens on click, closes on
                  outside-click (see useEffect above). */}
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setMenuOpen((v) => !v)}
                  className="h-9 inline-flex items-center gap-2 pl-1.5 pr-2 rounded-full border border-slate-200 bg-white hover:bg-slate-50 transition"
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                >
                  <span className="h-7 w-7 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 text-white text-xs font-medium flex items-center justify-center">
                    {(me?.user?.name || me?.user?.email || "?")
                      .charAt(0)
                      .toUpperCase()}
                  </span>
                  <span className="hidden sm:inline text-xs text-slate-500">
                    ▾
                  </span>
                </button>
                {menuOpen && (
                  <div className="absolute right-0 mt-2 w-64 bg-white border border-slate-200 rounded-xl shadow-lg z-40 overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-100">
                      <div className="text-sm font-medium truncate">
                        {me?.user?.name || me?.user?.email || "Signed out"}
                      </div>
                      <div className="text-xs text-slate-500 truncate">
                        {me?.activeTeam?.name || "—"}
                      </div>
                    </div>
                    <Link
                      href="/settings"
                      onClick={() => setMenuOpen(false)}
                      className="block px-4 py-2 text-sm hover:bg-slate-50"
                    >
                      ⚙ Settings
                    </Link>
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        setChooserOpen(true);
                      }}
                      className="block w-full text-left px-4 py-2 text-sm hover:bg-slate-50"
                    >
                      ✉ Open builder
                    </button>
                    <div className="h-px bg-slate-100" />
                    <button
                      onClick={logout}
                      className="block w-full text-left px-4 py-2 text-sm text-rose-600 hover:bg-rose-50"
                    >
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="px-4 sm:px-6 py-6 max-w-7xl mx-auto">{children}</main>
      </div>

      {/* Builder-chooser modal — globally available to every AppShell page
          via useBuilderChooser().open(). Closing it doesn't navigate; the
          modal itself routes to /?fresh=1 or /html-editor?fresh=1 when the
          user picks an editor. */}
      <NewTemplateModal
        open={chooserOpen}
        onClose={() => setChooserOpen(false)}
      />
    </div>
    </BuilderChooserContext.Provider>
  );
}

// -----------------------------------------------------------------------------
// Reusable building blocks. Kept in this file so they live with the shell.
// -----------------------------------------------------------------------------

export function PageActions({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center gap-2">{children}</div>;
}

export function PrimaryButton({
  children,
  onClick,
  href,
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
}) {
  const cls =
    "inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition";
  if (href) {
    return (
      <Link href={href} className={cls}>
        {children}
      </Link>
    );
  }
  return (
    <button onClick={onClick} disabled={disabled} className={cls}>
      {children}
    </button>
  );
}

export function GhostButton({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 hover:bg-slate-50"
    >
      {children}
    </button>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={
        "bg-white border border-slate-200 rounded-xl shadow-sm " + className
      }
    >
      {children}
    </div>
  );
}

export function StatCard({
  label,
  value,
  delta,
  tone = "indigo",
}: {
  label: string;
  value: string | number;
  delta?: string;
  tone?: "indigo" | "emerald" | "amber" | "rose";
}) {
  const tones: Record<string, string> = {
    indigo: "from-indigo-500 to-blue-600",
    emerald: "from-emerald-500 to-teal-600",
    amber: "from-amber-500 to-orange-500",
    rose: "from-rose-500 to-pink-600",
  };
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-wide text-slate-500">
          {label}
        </div>
        <div
          className={`h-8 w-8 rounded-lg bg-gradient-to-br ${tones[tone]} opacity-80`}
        />
      </div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
      {delta && (
        <div className="mt-1 text-xs text-slate-500">{delta}</div>
      )}
    </Card>
  );
}

export function EmptyState({
  title,
  description,
  cta,
}: {
  title: string;
  description: string;
  cta?: React.ReactNode;
}) {
  return (
    <Card className="p-12 text-center">
      <div className="text-3xl mb-3">✨</div>
      <div className="text-base font-semibold">{title}</div>
      <div className="mt-1 text-sm text-slate-500 max-w-md mx-auto">
        {description}
      </div>
      {cta && <div className="mt-5">{cta}</div>}
    </Card>
  );
}
