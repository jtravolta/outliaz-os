import { createHmac } from "node:crypto";

import type { ProspectLike } from "@/lib/taxonomy/gates";
import { normalizeEmail } from "@/lib/taxonomy/enums";

export type TemplateProspect = ProspectLike & {
  business_name?: string;
  contact_first_name?: string | null;
  contact_last_name?: string | null;
  city?: string | null;
  region?: string | null;
  country_code?: string | null;
  market?: string | null;
  website?: string | null;
  industry_slug?: string | null;
  business_type_label?: string | null;
  company_size?: string | null;
  custom_fields?: Record<string, unknown>;
};

const FALLBACKS: Record<string, string> = {
  first_name: "there",
  contact_name: "there",
};

const valueFor = (p: TemplateProspect, key: string): string => {
  const custom = key.startsWith("custom.") ? p.custom_fields?.[key.slice(7)] : undefined;
  if (custom != null) return String(custom);
  const map: Record<string, unknown> = {
    business_name: p.business_name,
    first_name: p.contact_first_name,
    last_name: p.contact_last_name,
    contact_name: p.contact_name,
    role: p.contact_role ? p.contact_role.replaceAll("_", " ").toLowerCase() : "",
    city: p.city,
    region: p.region,
    country: p.country_code,
    industry: p.industry_slug ? p.industry_slug.replaceAll("_", " ").toLowerCase() : "",
    business_type: p.business_type_label,
    company_size: (p.company_size ?? "").replaceAll("_", " ").toLowerCase(),
    market: p.market,
    website: p.website,
  };
  return String(map[key] ?? "");
};

export function renderMergeFields(text: string, p: TemplateProspect) {
  const unknown: string[] = [];
  const out = text.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_, key: string) => {
    const value = valueFor(p, key);
    if (value) return value;
    if (FALLBACKS[key] !== undefined) return FALLBACKS[key];
    if (!key.startsWith("custom.")) unknown.push(key);
    return "";
  });
  return { text: out, unknown: [...new Set(unknown)] };
}

/** Tiny, safe markdown subset — no raw HTML passes through. */
export function markdownToHtml(md: string) {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const inline = (s: string) =>
    esc(s)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2">$1</a>')
      .replace(/\n/g, "<br />");
  return md
    .split(/\n{2,}/)
    .map((block) => {
      const t = block.trim();
      if (!t) return "";
      if (/^###\s/.test(t)) return `<h3>${inline(t.replace(/^###\s/, ""))}</h3>`;
      if (/^##\s/.test(t)) return `<h3>${inline(t.replace(/^##\s/, ""))}</h3>`;
      if (/^[-*]\s/m.test(t)) {
        const items = t.split("\n").filter(Boolean).map((li) => `<li>${inline(li.replace(/^[-*]\s/, ""))}</li>`).join("");
        return `<ul>${items}</ul>`;
      }
      if (/^>\s/.test(t)) return `<blockquote>${inline(t.replace(/^>\s?/gm, ""))}</blockquote>`;
      return `<p>${inline(t)}</p>`;
    })
    .join("\n");
}

export function wrapEmailHtml(bodyHtml: string, opts: { footer?: string; unsubscribeUrl?: string; pixelUrl?: string }) {
  return `<!doctype html><html><body style="margin:0;padding:0;background:#ffffff;color:#18181b;font:14px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">
  <div style="max-width:560px;margin:0 auto;padding:24px 20px">
    ${bodyHtml}
    <hr style="border:none;border-top:1px solid #e4e4e7;margin:28px 0 12px" />
    <p style="font-size:11px;line-height:1.6;color:#71717a;margin:0">
      ${opts.footer ?? ""}
      ${opts.unsubscribeUrl ? `<br /><a href="${opts.unsubscribeUrl}" style="color:#71717a">Unsubscribe</a>` : ""}
    </p>
    ${opts.pixelUrl ? `<img src="${opts.pixelUrl}" width="1" height="1" alt="" style="display:none" />` : ""}
  </div>
</body></html>`;
}

export function textFromMarkdown(md: string) {
  return md
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, "$1 ($2)")
    .replace(/[*_`>#]/g, "")
    .trim();
}

/* ── tracking tokens ────────────────────────────────────────────────────── */

const secret = () => process.env.TRACKING_SECRET ?? "local-tracking-secret";

export function trackToken(messageId: string, type: "o" | "c", target?: string) {
  const payload = target ? `${messageId}:${type}:${target}` : `${messageId}:${type}`;
  const sig = createHmac("sha256", secret()).update(payload).digest("base64url").slice(0, 24);
  return Buffer.from(payload).toString("base64url") + "." + sig;
}

export function readTrackToken(token: string): { messageId: string; type: "o" | "c"; target?: string } | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const payload = Buffer.from(body, "base64url").toString("utf8");
  const expected = createHmac("sha256", secret()).update(payload).digest("base64url").slice(0, 24);
  if (sig !== expected) return null;
  const [messageId, type, target] = payload.split(":");
  if (!messageId || (type !== "o" && type !== "c")) return null;
  return { messageId, type, target };
}

export function rewriteLinks(html: string, messageId: string, appUrl: string) {
  return html.replace(/href="(https?:\/\/[^"]+)"/g, (_, url: string) => {
    if (url.startsWith(appUrl)) return `href="${url}"`;
    const token = trackToken(messageId, "c", url);
    return `href="${appUrl}/api/track/c/${token}"`;
  });
}

export const isValidEmail = (email?: string | null) => !!normalizeEmail(email);
