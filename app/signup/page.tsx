"use client";

// =============================================================================
// /signup — create account + a default team in one step.
// =============================================================================

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

// useSearchParams must live inside a Suspense boundary for Next.js 14's
// static prerender to succeed. The actual form is split into <SignupForm>
// below.
export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupForm />
    </Suspense>
  );
}

function SignupForm() {
  const router = useRouter();
  const search = useSearchParams();
  const inviteCode = search.get("invite") || "";

  const [name, setName] = useState("");
  const [teamName, setTeamName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const r = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password, name, teamName }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error || "Sign-up failed");

      // If they arrived from an invite link, redeem it right after signup.
      if (inviteCode) {
        await fetch("/api/teams/join", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ code: inviteCode }),
        });
      }
      // Land newly signed-up users in the dashboard, not the builder.
      router.replace("/dashboard");
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Sign-up failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm bg-white shadow rounded-lg p-6">
        <h1 className="text-xl font-semibold mb-1">Create your account</h1>
        <p className="text-sm text-gray-500 mb-6">
          {inviteCode
            ? "You'll be added to the inviting team once you sign up."
            : "We'll create a personal workspace for your templates."}
        </p>
        <form onSubmit={onSubmit} className="space-y-4">
          <label className="block text-sm">
            <span className="block text-gray-700 mb-1">Your name</span>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>
          <label className="block text-sm">
            <span className="block text-gray-700 mb-1">
              Workspace name{" "}
              <span className="text-gray-400">(optional)</span>
            </span>
            <input
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder={
                name ? `${name}'s workspace` : "My workspace"
              }
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>
          <label className="block text-sm">
            <span className="block text-gray-700 mb-1">Email</span>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>
          <label className="block text-sm">
            <span className="block text-gray-700 mb-1">
              Password{" "}
              <span className="text-gray-400">(min 8 chars)</span>
            </span>
            <input
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>
          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white rounded px-3 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Creating account…" : "Create account"}
          </button>
        </form>
        <p className="text-sm text-gray-600 mt-4">
          Already have an account?{" "}
          <Link href="/login" className="text-blue-600 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
