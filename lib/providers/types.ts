/**
 * Provider contracts. Every integration the app talks to sits behind one of
 * these interfaces, so `lib/providers/mock.ts` can stand in for the real
 * service during local development.
 */

export type ApifyRunState = "RUNNING" | "SUCCEEDED" | "FAILED";

export interface ApifyProvider {
  readonly mode: "mock" | "live";
  testConnection(): Promise<{ ok: boolean; message: string }>;
  startRun(actorId: string, input: Record<string, unknown>): Promise<{ runId: string }>;
  getRun(runId: string): Promise<{
    status: ApifyRunState;
    datasetId?: string;
    error?: string;
    itemCount?: number;
  }>;
  getDatasetItems(datasetId: string, offset: number, limit: number): Promise<Record<string, unknown>[]>;
}

export interface SendEmailInput {
  to: string;
  from: string;
  fromName: string;
  replyTo: string;
  subject: string;
  html: string;
  text: string;
  headers: Record<string, string>;
}

export interface ResendProvider {
  readonly mode: "mock" | "live";
  sendEmail(input: SendEmailInput): Promise<{ id: string; messageId: string }>;
  verifyDomain(domain: string): Promise<{ ok: boolean; message: string }>;
}

export interface ImapMessage {
  uid: number;
  uidvalidity: number;
  folder: string;
  from: string;
  to: string;
  subject: string;
  bodyText: string;
  inReplyTo?: string;
  references?: string[];
  receivedAt: Date;
}

export interface ImapProvider {
  readonly mode: "mock" | "live";
  testConnection(): Promise<{ ok: boolean; message: string }>;
  fetchSince(cursor: { uid: number; uidvalidity: number } | null): Promise<ImapMessage[]>;
}

export type Providers = {
  apify: ApifyProvider;
  resend: ResendProvider;
  imap: ImapProvider;
};
