import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { handleUnsubscribe, readUnsubscribeToken } from "@/lib/services/replies";

type Props = { params: Promise<{ token: string }> };

export const metadata: Metadata = {
  title: "Unsubscribe · Outbound OS",
  robots: { index: false, follow: false },
};

export default async function UnsubscribePage({ params }: Props) {
  const { token } = await params;
  const parsed = readUnsubscribeToken(token);
  if (!parsed) notFound();

  return (
    <main style={{ maxWidth: 460, margin: "48px auto", padding: 24, fontFamily: "system-ui, sans-serif" }}>
      <div style={{ border: "1px solid #e4e4e7", borderRadius: 12, background: "#fff", padding: 24, boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}>
        <h1 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Unsubscribe</h1>
        <p style={{ fontSize: 14, color: "#52525b", marginTop: 12 }}>
          Remove <strong>{parsed.email}</strong> from outbound follow-ups for this workspace?
        </p>
        <form method="POST" action="/api/unsubscribe">
          <input type="hidden" name="token" value={token} />
          <button
            type="submit"
            style={{ width: "100%", height: 40, borderRadius: 8, border: "none", background: "#7c3aed", color: "#fff", fontWeight: 600, fontSize: 14, cursor: "pointer" }}
          >
            Yes, unsubscribe me
          </button>
        </form>
        <p style={{ marginTop: 16, fontSize: 12, color: "#a1a1aa" }}>
          You can also <a href="/dashboard">return to the app</a>.
        </p>
      </div>
    </main>
  );
}
