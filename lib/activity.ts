// =============================================================================
// lib/activity.ts — write a row to ActivityLog.
//
// Every workspace-mutating route should fire-and-forget a call to logActivity
// after a successful write. The helper never throws; logging failures must
// never break the user's action.
// =============================================================================

import { prisma } from "./prisma";

export interface LogActivityInput {
  teamId: string;
  userId: string | null;
  action: string;
  target?: string | null;
  meta?: Record<string, unknown> | null;
}

export async function logActivity(input: LogActivityInput): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: {
        teamId: input.teamId,
        userId: input.userId,
        action: input.action,
        target: input.target ?? null,
        meta: input.meta ? JSON.stringify(input.meta) : null,
      },
    });
  } catch {
    // intentionally swallowed — logging must not break the request
  }
}
