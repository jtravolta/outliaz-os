import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

import { createPrismaClient, getPrismaClient } from "@/lib/db/prisma";
import { createServerSupabaseClient } from "@/lib/supabase/server";

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

type ClaimsClient = {
  auth: {
    getClaims: () => Promise<{
      data: { claims: Record<string, unknown> } | null;
      error: unknown;
    }>;
  };
};

type UserLookup = {
  users: {
    findUnique: (args: {
      where: { id: string };
      select: {
        id: true;
        workspace_id: true;
        email: true;
        name: true;
        role: true;
        status: true;
        workspaces: { select: { name: true } };
      };
    }) => Promise<unknown>;
  };
};

type ApplicationUserRow = {
  id: string;
  workspace_id: string;
  email: string;
  name: string | null;
  role: string;
  status: string;
  workspaces: { name: string };
};

const secret = () =>
  process.env.APP_ENCRYPTION_KEY ?? "dev-only-insecure-key-please-change-me";

const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64url");
const unb64 = (s: string) => Buffer.from(s, "base64url").toString("utf8");

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function encodeSession(
  user: SessionUser,
  exp = Date.now() + MAX_AGE * 1000,
) {
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
  return getSupabaseSessionUser();
}

/** Resolve the verified Supabase identity to an active application user. */
export async function getSupabaseSessionUser(
  supabase?: ClaimsClient,
  prisma?: UserLookup,
): Promise<SessionUser | null> {
  const client = supabase ?? (await createServerSupabaseClient());
  const { data, error } = await client.auth.getClaims();
  const userId = data?.claims && typeof data.claims.sub === "string"
    ? data.claims.sub
    : null;

  if (error || !userId) return null;

  const db = prisma ?? getPrismaClient();
  const row = (await db.users.findUnique({
    where: { id: userId },
    select: {
      id: true,
      workspace_id: true,
      email: true,
      name: true,
      role: true,
      status: true,
      workspaces: { select: { name: true } },
    },
  })) as ApplicationUserRow | null;

  if (!row || row.status !== "ACTIVE") return null;

  return {
    userId: row.id,
    workspaceId: row.workspace_id,
    email: row.email,
    name: row.name ?? row.email,
    role: row.role as SessionUser["role"],
    workspaceName: row.workspaces.name,
  };
}

export async function requireSession(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) throw new Error("UNAUTHORIZED");
  return session;
}

export function can(
  role: string,
  action: "write" | "admin" | "owner" | "override",
) {
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
export async function signInWithEmail(
  email: string,
  prisma: ReturnType<typeof createPrismaClient> = getPrismaClient(),
): Promise<SessionUser | null> {
  const normalized = email.trim().toLowerCase();
  const allowlist = (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (
    allowlist.length &&
    !allowlist.includes(normalized) &&
    process.env.MOCK_PROVIDERS !== "true"
  ) {
    return null;
  }

  const row = await prisma.users.findUnique({
    where: { email: normalized },
    select: {
      id: true,
      workspace_id: true,
      email: true,
      name: true,
      role: true,
      status: true,
      workspaces: { select: { name: true } },
    },
  });

  if (!row || row.status !== "ACTIVE") return null;

  return {
    userId: row.id,
    workspaceId: row.workspace_id,
    email: row.email,
    name: row.name ?? row.email,
    role: row.role as SessionUser["role"],
    workspaceName: row.workspaces.name,
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
