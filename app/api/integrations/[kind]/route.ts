import { json, route, type RouteContext } from "@/lib/api";
import { deleteIntegration, saveIntegration } from "@/lib/services/settings";

type P = { kind: string };

const kindOf = (value: string) => {
  const kind = value.toUpperCase();
  if (kind !== "APIFY" && kind !== "RESEND" && kind !== "IMAP") throw new Error("Unknown integration");
  return kind;
};

export const PUT = route<P>(async (req, context: RouteContext<P>, ctx) => {
  const { kind } = await context.params;
  const body = await json<{ label?: string; config?: Record<string, unknown>; secret?: string }>(req);
  return saveIntegration(ctx, kindOf(kind), body);
});

export const DELETE = route<P>(async (_req, context: RouteContext<P>, ctx) => {
  const { kind } = await context.params;
  return deleteIntegration(ctx, kindOf(kind));
});
