// =============================================================================
// app/not-found.tsx — 404 page.
// Next.js renders this for any unmatched route. Light, on-brand layout that
// keeps users one click from the dashboard or the builder.
// =============================================================================

import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50 flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 text-white text-xl mb-5 shadow-sm">
          ✉
        </div>
        <div className="text-sm font-medium tracking-wide text-indigo-600 mb-2">
          404 · Page not found
        </div>
        <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900 mb-2">
          That email got returned.
        </h1>
        <p className="text-sm text-slate-500 mb-6">
          We couldn't find the page you were looking for. It may have been
          moved, or you might be following a stale link.
        </p>
        <div className="flex items-center justify-center gap-2">
          <Link
            href="/dashboard"
            className="inline-flex items-center h-10 px-4 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition"
          >
            Go to Dashboard
          </Link>
          <Link
            href="/"
            className="inline-flex items-center h-10 px-4 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 hover:bg-slate-50 transition"
          >
            Open builder
          </Link>
        </div>
      </div>
    </main>
  );
}
