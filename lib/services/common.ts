import { db } from "@/lib/db/client";
import { auditLogs, notifications, prospectEvents } from "@/lib/db/schema";
import type { SessionUser } from "@/lib/auth/session";

export type Ctx = { user: SessionUser };

export class AppError extends Error {
  constructor(public code: string, message: string, public status = 400, public details?: unknown) {
    super(message);
  }
}

export const fail = (code: string, message: string, status = 400, details?: unknown) =>
  new AppError(code, message, status, details);

export const requireRole = (ctx: Ctx, roles: string[]) => {
  if (!roles.includes(ctx.user.role)) {
    throw fail("FORBIDDEN", "Your role does not allow this action", 403);
  }
};

export async function audit(
  ctx: Ctx,
  action: string,
  targetType?: string,
  targetId?: string,
  meta: Record<string, unknown> = {},
) {
  await db.insert(auditLogs).values({
    workspaceId: ctx.user.workspaceId,
    userId: ctx.user.userId,
    action,
    targetType,
    targetId,
    meta,
  });
}

export async function event(
  prospectId: string,
  type: string,
  payload: Record<string, unknown> = {},
  actorUserId?: string,
) {
  await db.insert(prospectEvents).values({ prospectId, type, payload, actorUserId });
}

export async function notify(
  workspaceId: string,
  userId: string | null,
  kind: string,
  title: string,
  body?: string,
  href?: string,
) {
  await db.insert(notifications).values({ workspaceId, userId, kind, title, body, href });
}

/** Wrap a handler so thrown AppErrors become JSON responses. */
export function errorResponse(err: unknown) {
  if (err instanceof AppError) {
    return Response.json({ error: { code: err.code, message: err.message, details: err.details } }, { status: err.status });
  }
  const message = err instanceof Error ? err.message : "Unexpected error";
  if (message === "UNAUTHORIZED") {
    return Response.json({ error: { code: "UNAUTHORIZED", message: "Sign in required" } }, { status: 401 });
  }
  console.error("[api]", err);
  return Response.json({ error: { code: "INTERNAL", message } }, { status: 500 });
}
