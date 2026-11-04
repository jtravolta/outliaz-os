/**
 * Deterministic-ish mock providers.
 *
 * These stand in for Apify / Resend / IMAP so the whole product can be driven
 * end to end locally without keys, network calls, or spending money. Every
 * response shape matches the live client in ./live.ts and ./index.ts chooses
 * between them via MOCK_PROVIDERS.
 */

import type {
  ApifyProvider, ImapMessage, ImapProvider, ResendProvider, SendEmailInput,
} from "./types";
import { randomUUID } from "node:crypto";
import { normalizeDomain, normalizeEmail } from "@/lib/taxonomy/enums";

/* ── Apify ──────────────────────────────────────────────────────────────── */

type MockRun = {
  actorId: string;
  input: Record<string, unknown>;
  createdAt: number;
  itemCount: number;
  datasetId: string;
  failed: boolean;
};

const globalForMock = globalThis as unknown as {
  __mockRuns?: Map<string, MockRun>;
  __mockImap?: ImapMessage[];
  __mockSent?: SendEmailInput[];
  __mockUid?: number;
};

const runs = (globalForMock.__mockRuns ??= new Map());
const imapQueue = (globalForMock.__mockImap ??= []);
const sentBox = (globalForMock.__mockSent ??= []);

const FIRST = ["Ellie", "Marek", "Sanne", "Amelia", "Cian", "Lotte", "Jonas", "Tom", "Priya", "Dave",
  "Helen", "Ruth", "Noah", "Maya", "Oliver", "Sofia", "Liam", "Nina", "Ethan", "Clara"];
const LAST = ["Harper", "Nowak", "de Vries", "Blake", "Murphy", "Bakker", "Weber", "Fenwick", "Shah",
  "Pritchard", "Finch", "Ainsley", "Keller", "Rossi", "Bennett", "Marin", "Okafor", "Lindqvist"];
const SUFFIX = ["Dental", "Roofing", "Legal", "Physio", "Design", "Motors", "Catering", "Clinic",
  "Studio", "Vets", "Accounting", "Fitness", "Bakeries", "Interiors", "Landscapes"];
const CITIES: [string, string, string, string][] = [
  ["Manchester", "Greater Manchester", "GB", "UK"],
  ["Leeds", "West Yorkshire", "GB", "UK"],
  ["Bristol", "South West", "GB", "UK"],
  ["Brighton", "South East", "GB", "UK"],
  ["Glasgow", "Scotland", "GB", "UK"],
  ["Dublin", "Leinster", "IE", "IE"],
  ["Utrecht", "Utrecht", "NL", "Benelux"],
  ["Rotterdam", "South Holland", "NL", "Benelux"],
  ["Berlin", "Berlin", "DE", "DACH"],
  ["Munich", "Bavaria", "DE", "DACH"],
  ["Zurich", "Zurich", "CH", "DACH"],
  ["Copenhagen", "Capital Region", "DK", "Nordics"],
];
const INDUSTRY_POOL: [string, string[]][] = [
  ["HEALTHCARE", ["Dentist", "Physiotherapy Clinic", "Medical Clinic", "Optician"]],
  ["CONSTRUCTION_TRADES", ["Building Contractor", "Roofer", "Renovation Company"]],
  ["PROFESSIONAL_SERVICES", ["Law Firm", "Accounting Firm", "Consultancy"]],
  ["HOSPITALITY_FOOD", ["Restaurant", "Café", "Catering Company"]],
  ["BEAUTY_WELLNESS", ["Hair Salon", "Spa", "Gym"]],
  ["HOME_SERVICES", ["Plumbing Company", "Electrical Contractor", "Landscaper"]],
  ["AUTOMOTIVE", ["Auto Repair Shop", "Car Dealership", "Detailing Studio"]],
  ["CREATIVE_MEDIA", ["Marketing Agency", "Design Studio", "Photography Studio"]],
  ["PROPERTY_REAL_ESTATE", ["Estate Agency", "Property Manager"]],
  ["TECHNOLOGY", ["SaaS Company", "IT Services"]],
];
const OPP_POOL = ["NO_WEBSITE", "OUTDATED_WEBSITE", "POOR_MOBILE_EXPERIENCE", "WEAK_CONVERSION",
  "NO_LEAD_CAPTURE", "NO_ONLINE_BOOKING", "WEAK_BRANDING", "SEO_DISCOVERABILITY"];

function pick<T>(arr: T[], seed: number): T {
  return arr[Math.abs(seed) % arr.length];
}

export function mockApifyItems(count: number, seed = Date.now()): Record<string, unknown>[] {
  const items: Record<string, unknown>[] = [];
  for (let i = 0; i < count; i++) {
    const n = seed + i * 37;
    const first = pick(FIRST, n);
    const last = pick(LAST, n * 3 + 1);
    const suffix = pick(SUFFIX, n * 7 + 5);
    const city = pick(CITIES, n * 11 + 3);
    const [industry, types] = pick(INDUSTRY_POOL, n * 13 + 2);
    const type = pick(types, n * 17 + 4);
    const business = `${last} ${suffix}`;
    const domain = `${business.toLowerCase().replace(/[^a-z0-9]+/g, "")}.${city[2] === "GB" ? "co.uk" : city[2] === "DE" ? "de" : city[2] === "NL" ? "nl" : "com"}`;
    const employees = pick([1, 3, 8, 12, 18, 26, 44, 75, 140], n * 19 + 6);
    items.push({
      title: business,
      website: `https://${domain}`,
      email: `${first.toLowerCase().replace(/[^a-z]/g, "")}@${domain}`,
      contactName: `${first} ${last}`,
      jobTitle: pick(["Owner", "Founder", "Managing Director", "Marketing Manager", "Operations Manager"], n * 23 + 7),
      phone: `+44 161 ${String(100 + (n % 800))} ${String(1000 + (n % 9000))}`,
      city: city[0],
      region: city[1],
      countryCode: city[2],
      category: type,
      industrySlug: industry,
      employees,
      opportunities: [pick(OPP_POOL, n * 29 + 8), pick(OPP_POOL, n * 31 + 9)].filter((v, idx, a) => a.indexOf(v) === idx),
      rating: Number((3.6 + ((n % 14) / 10)).toFixed(1)),
      reviews: 12 + (n % 240),
    });
  }
  return items;
}

export const mockApify: ApifyProvider = {
  mode: "mock",
  async testConnection() {
    return { ok: true, message: "Mock Apify workspace · 4 actors available" };
  },
  async startRun(actorId, input) {
    const runId = `mock_run_${randomUUID().slice(0, 8)}`;
    const requested = Number(input.maxItems ?? input.limit ?? 25);
    runs.set(runId, {
      actorId,
      input,
      createdAt: Date.now(),
      itemCount: Math.max(1, Math.min(Number.isFinite(requested) ? requested : 25, 200)),
      datasetId: `mock_ds_${randomUUID().slice(0, 8)}`,
      failed: false,
    });
    return { runId };
  },
  async getRun(runId) {
    const run = runs.get(runId);
    if (!run) return { status: "FAILED", error: "Unknown mock run" };
    const elapsed = Date.now() - run.createdAt;
    // Simulate a scrape that takes a few seconds.
    if (elapsed < 2500) return { status: "RUNNING" };
    return { status: "SUCCEEDED", datasetId: run.datasetId, itemCount: run.itemCount };
  },
  async getDatasetItems(datasetId, offset, limit) {
    const run = [...runs.values()].find((r) => r.datasetId === datasetId);
    if (!run) return [];
    const all = mockApifyItems(run.itemCount, 1000 + (run.createdAt % 90000));
    return all.slice(offset, offset + limit);
  },
};

/* ── Resend ─────────────────────────────────────────────────────────────── */

export const mockResend: ResendProvider = {
  mode: "mock",
  async sendEmail(input) {
    const id = `mock_em_${randomUUID().slice(0, 10)}`;
    if (!normalizeEmail(input.to)) throw new Error("Invalid recipient");
    sentBox.push(input);
    return { id, messageId: `<${id}@mock.resend.dev>` };
  },
  async verifyDomain(domain) {
    const d = normalizeDomain(domain);
    return d
      ? { ok: true, message: `${d} verified (mock) · DKIM + SPF present` }
      : { ok: false, message: "Enter a valid sending domain" };
  },
};

/* ── IMAP ───────────────────────────────────────────────────────────────── */

export const mockImap: ImapProvider = {
  mode: "mock",
  async testConnection() {
    return { ok: true, message: "Mock IMAP · INBOX reachable, 0 unread" };
  },
  async fetchSince() {
    const queued = imapQueue.splice(0, imapQueue.length);
    return queued;
  },
};

/** Test helper: queue a synthetic inbound reply for the next IMAP sync. */
export function queueMockReply(msg: Omit<ImapMessage, "uid" | "uidvalidity" | "folder" | "receivedAt">) {
  const uid = (globalForMock.__mockUid ?? 1000) + 1;
  globalForMock.__mockUid = uid;
  imapQueue.push({ ...msg, uid, uidvalidity: 777, folder: "INBOX", receivedAt: new Date() });
}

export function mockSentMessages() {
  return sentBox.slice();
}

export const MOCK_REPLY_BODIES = [
  "Thanks for reaching out — this is actually good timing. Can you send a couple of examples and rough pricing?",
  "Interesting. We're reviewing our site in Q1. Happy to jump on a short call next week.",
  "Not for us right now, but I'll keep your details on file. Thanks.",
  "Please remove me from your list.",
  "I'm out of the office until Monday — I'll reply when I'm back.",
  "Who are you and why are you emailing me?",
];
