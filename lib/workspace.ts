// =============================================================================
// lib/workspace.ts — helpers shared by every workspace-scoped API route.
//
// Every new domain (contacts, campaigns, forms, …) follows the same pattern:
//
//   const ws = await requireWorkspace();        // session + active team
//   const rows = await prisma.X.findMany({ where: { teamId: ws.teamId } });
//
// Pulling these helpers out of each route keeps the per-domain handlers
// small and consistent.
// =============================================================================

import { requireSession } from "./auth";

export interface WorkspaceContext {
  userId: string;
  teamId: string;
}

export async function requireWorkspace(): Promise<WorkspaceContext> {
  const session = await requireSession();
  if (!session.activeTeamId) {
    const err: any = new Error(
      "No active workspace — create or join one first."
    );
    err.status = 400;
    throw err;
  }
  return { userId: session.userId, teamId: session.activeTeamId };
}

/** Wraps a route handler so all errors come back as JSON. */
export function withJsonErrors<T>(
  fn: () => Promise<T>
): Promise<Response> {
  return fn().then(
    (data) =>
      new Response(JSON.stringify(data), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    (e: any) =>
      new Response(
        JSON.stringify({ error: e?.message || "Internal error" }),
        {
          status: e?.status || 500,
          headers: { "content-type": "application/json" },
        }
      )
  );
}

/** Parse a JSON-as-string column, swallowing parse errors. */
export function parseJson<T = unknown>(s: string | null | undefined): T | null {
  if (!s) return null;
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}
