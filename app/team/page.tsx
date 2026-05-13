"use client";

// =============================================================================
// /team — minimal account screen. Shows the signed-in user and a sign-out
// button, nothing else. The wider workspace / invite / member / SaaS-nav UI
// is intentionally hidden; the underlying APIs still exist and can be
// re-surfaced later by reverting this file.
// =============================================================================

import { useEffect, useState } from "react";
import Link from "next/link";

interface Me {
  user: { id: string; email: string; name: string | null } | null;
}

export default function AccountPage() {
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then(setMe)
      .catch(() => setMe({ user: null }));
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  if (!me) {
    return (
      <main className="min-h-screen flex items-center justify-center text-gray-500">
        Loading…
      </main>
    );
  }

  if (!me.user) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <Link href="/login" className="text-blue-600 underline">
          Sign in
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm bg-white shadow rounded-lg p-6 text-center">
        <p className="text-sm text-gray-500">Signed in as</p>
        <p className="text-base font-medium text-gray-900 mb-4">
          {me.user.email}
        </p>
        <button
          onClick={logout}
          className="w-full bg-gray-900 text-white rounded px-3 py-2 text-sm font-medium hover:bg-black"
        >
          Sign out
        </button>
        <p className="mt-4 text-xs text-gray-500">
          <Link href="/" className="hover:underline">
            ← Back to builder
          </Link>
        </p>
      </div>
    </main>
  );
}
