import { createPrismaClient, getPrismaClient } from "@/lib/db/prisma";
import { createServerSupabaseClient } from "@/lib/supabase/server";

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
  role: SessionUser["role"];
  status: "ACTIVE";
  workspaces: { name: string };
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

function isApplicationUserRow(value: unknown): value is ApplicationUserRow {
  if (!isRecord(value)) return false;
  const row = value;
  const workspace = row.workspaces;
  const isWorkspace = isRecord(workspace) && typeof workspace.name === "string";

  return isUuid(row.id)
    && isUuid(row.workspace_id)
    && typeof row.email === "string"
    && (row.name === null || typeof row.name === "string")
    && (row.role === "OWNER" || row.role === "ADMIN" || row.role === "MEMBER")
    && row.status === "ACTIVE"
    && isWorkspace;
}

const SUPABASE_AUTH_CUTOVER = "true";

export function isSupabaseAuthCutoverEnabled() {
  return process.env.SUPABASE_AUTH_CUTOVER === SUPABASE_AUTH_CUTOVER;
}

/** Validate the browser-safe Auth configuration before any Auth operation. */
export function validateSupabaseAuthConfig() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is required");
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    throw new Error("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is required");
  }
}

export async function getSession(
  supabase?: ClaimsClient,
  prisma?: UserLookup,
): Promise<SessionUser | null> {
  return getSupabaseSessionUser(supabase, prisma);
}

/** Resolve the verified Supabase identity to an active application user. */
export async function getSupabaseSessionUser(
  supabase?: ClaimsClient,
  prisma?: UserLookup,
): Promise<SessionUser | null> {
  try {
    if (!supabase) validateSupabaseAuthConfig();
    const client = supabase ?? (await createServerSupabaseClient());
    const { data, error } = await client.auth.getClaims();
    const userId = data?.claims && isUuid(data.claims.sub)
      ? data.claims.sub
      : null;

    if (error || !userId) return null;

    const db = prisma ?? getPrismaClient();
    const result = await db.users.findUnique({
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
    });

    if (!isApplicationUserRow(result)) return null;

    return {
      userId: result.id,
      workspaceId: result.workspace_id,
      email: result.email,
      name: result.name ?? result.email,
      role: result.role,
      workspaceName: result.workspaces.name,
    };
  } catch {
    return null;
  }
}

export async function requireSession(
  supabase?: ClaimsClient,
  prisma?: UserLookup,
): Promise<SessionUser> {
  const session = await getSession(supabase, prisma);
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
 * Controlled pre-cutover migration helper. Supabase Auth is the only active
 * production sign-in path; this function is retained only for local migration
 * verification while SUPABASE_AUTH_CUTOVER is false.
 */
export async function signInWithEmail(
  email: string,
  prisma?: ReturnType<typeof createPrismaClient>,
): Promise<SessionUser | null> {
  if (isSupabaseAuthCutoverEnabled()) return null;

  const db = prisma ?? getPrismaClient();
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

  const row = await db.users.findUnique({
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
