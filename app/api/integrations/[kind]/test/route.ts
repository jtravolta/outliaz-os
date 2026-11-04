import { route, type RouteContext } from "@/lib/api";
import { testIntegration } from "@/lib/services/settings";

type P = { kind: string };

export const POST = route<P>(async (_req, context: RouteContext<P>, ctx) => {
  const { kind } = await context.params;
  const normalized = kind.toUpperCase();
  if (normalized !== "APIFY" && normalized !== "RESEND" && normalized !== "IMAP") {
    throw new Error("Unknown integration");
  }
  return testIntegration(ctx, normalized);
});
