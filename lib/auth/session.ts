import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { users, workspaces } from "@/lib/db/schema";

export const SESSION_COOKIE = "oos_session";
const MAX_AGE = 60 * 60 * 24 * 30;

export type SessionUser = {
  userId: string;
  workspaceId: string;
  email: string;
  name: string;
  role: "OWNER" | "ADMIN" | "MEMBER";
  workspaceName: string;
};

const secret = () =>
  process.env.APP_ENCRYPTION_KEY ?? "dev-only-insecure-key-please-change-me";

const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64url");
const unb64 = (s: string) => Buffer.from(s, "base64url").toString("utf8");

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function encodeSession(user: SessionUser, exp = Date.now() + MAX_AGE * 1000) {
  const payload = b64(JSON.stringify({ ...user, exp }));
  return `${payload}.${sign(payload)}`;
}

export function decodeSession(token?: string | null): SessionUser | null {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = sign(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(unb64(payload));
    if (!data.exp || data.exp < Date.now()) return null;
    return {
      userId: data.userId,
      workspaceId: data.workspaceId,
      email: data.email,
      name: data.name,
      role: data.role,
      workspaceName: data.workspaceName,
    };
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionUser | null> {
  const store = await cookies();
  return decodeSession(store.get(SESSION_COOKIE)?.value);
}

export async function requireSession(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) throw new Error("UNAUTHORIZED");
  return session;
}

export function can(role: string, action: "write" | "admin" | "owner" | "override") {
  if (role === "OWNER") return true;
  if (action === "owner") return false;
  if (role === "ADMIN") return true;
  return action === "write";
}

/**
 * Local-only sign-in: any address on ALLOWED_EMAILS (and present in users)
 * gets a session. In production this is where Auth.js magic-link / Google
 * would sit — the rest of the app only depends on SessionUser.
 */
export async function signInWithEmail(email: string): Promise<SessionUser | null> {
  const normalized = email.trim().toLowerCase();
  const allowlist = (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (allowlist.length && !allowlist.includes(normalized) && process.env.MOCK_PROVIDERS !== "true") {
    return null;
  }

  const [row] = await db
    .select({
      userId: users.id,
      workspaceId: users.workspaceId,
      email: users.email,
      name: users.name,
      role: users.role,
      status: users.status,
      workspaceName: workspaces.name,
    })
    .from(users)
    .innerJoin(workspaces, eq(users.workspaceId, workspaces.id))
    .where(eq(users.email, normalized))
    .limit(1);

  if (!row || row.status === "DISABLED") return null;

  return {
    userId: row.userId,
    workspaceId: row.workspaceId,
    email: row.email,
    name: row.name,
    role: row.role as SessionUser["role"],
    workspaceName: row.workspaceName,
  };
}

export async function setSessionCookie(session: SessionUser) {
  const store = await cookies();
  store.set(SESSION_COOKIE, encodeSession(session), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}
