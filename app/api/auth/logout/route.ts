// =============================================================================
// POST /api/auth/logout — destroys the current session row + clears cookie.
// =============================================================================

import { NextResponse } from "next/server";
import { destroyCurrentSession } from "@/lib/auth";

export async function POST() {
  await destroyCurrentSession();
  return NextResponse.json({ ok: true });
}
