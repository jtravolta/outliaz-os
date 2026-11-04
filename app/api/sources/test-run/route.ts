import { json, route } from "@/lib/api";
import { providers } from "@/lib/providers";
import { mockApifyItems } from "@/lib/providers/mock";

/**
 * Dry-run an actor with a 1-item input and return up to five sample rows.
 * In mock mode this is instant; live mode still respects the actor contract.
 */
export const POST = route(async (req) => {
  const body = await json<{ actorId?: string; input?: Record<string, unknown> }>(req);
  const actorId = body.actorId?.trim();
  if (!actorId) throw new Error("Pick an actor first");

  if (providers.apify.mode === "mock") {
    return {
      ok: true,
      mode: "mock",
      items: mockApifyItems(5, 4242),
      message: "Mock actor returned 5 sample rows.",
    };
  }

  const { runId } = await providers.apify.startRun(actorId, { ...(body.input ?? {}), maxItems: 1 });
  for (let i = 0; i < 30; i++) {
    const state = await providers.apify.getRun(runId);
    if (state.status === "FAILED") return { ok: false, mode: "live", items: [], message: state.error ?? "Actor failed" };
    if (state.status === "SUCCEEDED" && state.datasetId) {
      const items = await providers.apify.getDatasetItems(state.datasetId, 0, 5);
      return { ok: true, mode: "live", items, message: `Actor returned ${items.length} sample rows.` };
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
  return { ok: false, mode: "live", items: [], message: "Timed out waiting for the actor (90s)." };
});
