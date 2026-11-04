import { mockApify, mockImap, mockResend } from "./mock";
import type { ApifyProvider, ImapProvider, Providers, ResendProvider } from "./types";

const useMock =
  process.env.MOCK_PROVIDERS === "true" ||
  (!process.env.APIFY_TOKEN && !process.env.RESEND_API_KEY && !process.env.IMAP_HOST);

/* ── live Apify (fetch API, no SDK) ─────────────────────────────────────── */

const liveApify: ApifyProvider = {
  mode: "live",
  async testConnection() {
    const res = await fetch("https://api.apify.com/v2/users/me", {
      headers: { Authorization: `Bearer ${process.env.APIFY_TOKEN}` },
    });
    if (!res.ok) return { ok: false, message: `Apify returned ${res.status}` };
    const json = await res.json();
    return { ok: true, message: `Connected as ${json?.data?.username ?? "actor owner"}` };
  },
  async startRun(actorId, input) {
    const res = await fetch(
      `https://api.apify.com/v2/acts/${encodeURIComponent(actorId)}/runs?token=${process.env.APIFY_TOKEN}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) },
    );
    if (!res.ok) throw new Error(`Apify start failed: ${res.status}`);
    const json = await res.json();
    return { runId: json.data.id };
  },
  async getRun(runId) {
    const res = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${process.env.APIFY_TOKEN}`);
    if (!res.ok) throw new Error(`Apify status failed: ${res.status}`);
    const json = await res.json();
    const status = json.data.status as string;
    if (["SUCCEEDED", "FAILED", "ABORTED", "TIMED-OUT"].includes(status)) {
      return {
        status: status === "SUCCEEDED" ? "SUCCEEDED" : "FAILED",
        datasetId: json.data.defaultDatasetId,
        error: status === "SUCCEEDED" ? undefined : status,
      };
    }
    return { status: "RUNNING" };
  },
  async getDatasetItems(datasetId, offset, limit) {
    const res = await fetch(
      `https://api.apify.com/v2/datasets/${datasetId}/items?token=${process.env.APIFY_TOKEN}&offset=${offset}&limit=${limit}&clean=true`,
    );
    if (!res.ok) throw new Error(`Apify dataset failed: ${res.status}`);
    return res.json();
  },
};

/* ── live Resend ────────────────────────────────────────────────────────── */

const liveResend: ResendProvider = {
  mode: "live",
  async sendEmail(input) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${input.fromName} <${input.from}>`,
        to: [input.to],
        reply_to: input.replyTo,
        subject: input.subject,
        html: input.html,
        text: input.text,
        headers: input.headers,
      }),
    });
    if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
    const json = await res.json();
    return { id: json.id, messageId: `<${json.id}@resend.dev>` };
  },
  async verifyDomain(domain) {
    const res = await fetch("https://api.resend.com/domains", {
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
    });
    if (!res.ok) return { ok: false, message: `Resend returned ${res.status}` };
    const json = await res.json();
    const found = json.data?.find((d: { name: string; status: string }) => d.name === domain);
    if (!found) return { ok: false, message: `${domain} is not added in Resend` };
    return found.status === "verified"
      ? { ok: true, message: `${domain} verified` }
      : { ok: false, message: `${domain} is ${found.status}` };
  },
};

/* ── live IMAP (requires imapflow in production) ────────────────────────── */

const liveImap: ImapProvider = {
  mode: "live",
  async testConnection() {
    return { ok: false, message: "IMAP live driver is not bundled in the local build" };
  },
  async fetchSince() {
    throw new Error("IMAP live driver is not bundled in the local build");
  },
};

export const providers: Providers = useMock
  ? { apify: mockApify, resend: mockResend, imap: mockImap }
  : { apify: liveApify, resend: liveResend, imap: liveImap };

export const providerMode = useMock ? "mock" : "live";
export * from "./types";
