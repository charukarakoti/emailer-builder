// =============================================================================
// lib/auth.ts — password hashing + cookie sessions
// =============================================================================
// Auth is intentionally minimal:
//   - Passwords hashed with bcryptjs (no native deps; runs on any Node host).
//   - Sessions stored in the Session table. The cookie carries an opaque
//     random token; the DB stores only its SHA-256 hash, so a leaked DB
//     row alone can't impersonate a user.
//
// The session row also carries activeTeamId, so a user with multiple
// memberships can switch teams without re-logging-in.
// =============================================================================

import bcrypt from "bcryptjs";
import crypto from "crypto";
import { cookies } from "next/headers";
import { prisma } from "./prisma";

export const SESSION_COOKIE = "eb_session";
const SESSION_DAYS = 30;

// ---- password hashing -------------------------------------------------------

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

export async function verifyPassword(
  plain: string,
  hash: string
): Promise<boolean> {
  // bcryptjs throws on malformed hashes (e.g. when we hand it a placeholder).
  // Swallow that and return false so callers stay on the "wrong password"
  // path without crashing the request.
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    return false;
  }
}

// ---- tokens ----------------------------------------------------------------

function randomToken(): string {
  // 32 bytes base64url ≈ 256 bits of entropy.
  return crypto.randomBytes(32).toString("base64url");
}

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// ---- session lifecycle -----------------------------------------------------

export async function createSession(
  userId: string,
  activeTeamId: string | null
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await prisma.session.create({
    data: { tokenHash, userId, activeTeamId, expiresAt },
  });
  return { token, expiresAt };
}

export async function setSessionCookie(token: string, expiresAt: Date) {
  cookies().set({
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function clearSessionCookie() {
  cookies().delete(SESSION_COOKIE);
}

/** Reads the session cookie, validates it, returns the user + active team. */
export async function getCurrentSession() {
  const c = cookies().get(SESSION_COOKIE);
  if (!c?.value) return null;
  const tokenHash = hashToken(c.value);
  const session = await prisma.session.findUnique({
    where: { tokenHash },
    include: {
      user: true,
      activeTeam: true,
    },
  });
  if (!session) return null;
  if (session.expiresAt < new Date()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }
  return session;
}

export async function destroyCurrentSession() {
  const c = cookies().get(SESSION_COOKIE);
  if (!c?.value) return;
  const tokenHash = hashToken(c.value);
  await prisma.session.delete({ where: { tokenHash } }).catch(() => {});
  await clearSessionCookie();
}

/** Helper that throws a 401-style error if no session — for use in API routes. */
export async function requireSession() {
  const s = await getCurrentSession();
  if (!s) {
    const err: any = new Error("Unauthorized");
    err.status = 401;
    throw err;
  }
  return s;
}
