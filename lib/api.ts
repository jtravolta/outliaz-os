import type { NextRequest } from "next/server";

import { requireSession, type SessionUser } from "@/lib/auth/session";
import { errorResponse, type Ctx } from "@/lib/services/common";

export type RouteContext<P = Record<string, string>> = {
  params: Promise<P>;
};

/** Session guard for route handlers. */
export async function session(): Promise<SessionUser> {
  return requireSession();
}

export async function ctx(): Promise<Ctx> {
  return { user: await session() };
}

/** Wrap a handler so auth + errors become consistent JSON. */
export function route<P = Record<string, string>>(
  fn: (req: NextRequest, context: RouteContext<P>, user: Ctx) => Promise<Response | unknown>,
) {
  return async (req: NextRequest, context: RouteContext<P>) => {
    try {
      const user = await ctx();
      const result = await fn(req, context, user);
      if (result instanceof Response) return result;
      return Response.json(result ?? { ok: true });
    } catch (err) {
      return errorResponse(err);
    }
  };
}

/** Public route (no session) with the same error mapping. */
export function publicRoute<P = Record<string, string>>(
  fn: (req: NextRequest, context: RouteContext<P>) => Promise<Response | unknown>,
) {
  return async (req: NextRequest, context: RouteContext<P>) => {
    try {
      const result = await fn(req, context);
      if (result instanceof Response) return result;
      return Response.json(result ?? { ok: true });
    } catch (err) {
      return errorResponse(err);
    }
  };
}

export async function json<T>(req: NextRequest): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    return {} as T;
  }
}

export const q = (req: NextRequest, key: string) => req.nextUrl.searchParams.get(key) ?? undefined;

export const qList = (req: NextRequest, key: string) =>
  req.nextUrl.searchParams.getAll(key).flatMap((v) => v.split(",")).filter(Boolean);

export const qBool = (req: NextRequest, key: string) => {
  const v = req.nextUrl.searchParams.get(key);
  if (v == null || v === "") return undefined;
  return v === "true" || v === "1";
};

export const qNum = (req: NextRequest, key: string) => {
  const v = Number(req.nextUrl.searchParams.get(key));
  return Number.isFinite(v) && v > 0 ? v : undefined;
};
