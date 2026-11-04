import { listOffers, listRules, listTemplates } from "@/lib/services/library";
import { getSession } from "@/lib/auth/session";
import { PageHeader } from "@/components/page-header";
import { plainMarkdown } from "@/lib/format";

export const metadata = { title: "Offers" };

export default async function LibraryPage() {
  const user = await getSession();
  if (!user) return null;
  const [offers, templates, rules] = await Promise.all([
    listOffers({ user }),
    listTemplates({ user }),
    listRules({ user }),
  ]);

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <PageHeader
        title="Offers"
        description="Offers and email templates used by outreach."
      />

      <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <h3 className="text-[13px] font-semibold tracking-tight">Offers</h3>
        {offers.length === 0 && (
          <p className="mt-2 text-[12.5px] text-muted-foreground">
            No offers yet.
          </p>
        )}
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {offers.map((o) => (
            <div key={o.id} className="rounded-lg border border-border p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[13px] font-semibold">{o.name}</p>
                <span
                  className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${o.isActive ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-border text-muted-foreground"}`}
                >
                  {o.isActive ? "active" : "draft"}
                </span>
              </div>
              <p className="mt-1 text-[12px] text-muted-foreground">
                {o.summary}
              </p>
              <p className="mt-1 text-[12px] text-muted-foreground">
                Value prop: {plainMarkdown(o.valuePropMd)}
              </p>
              {o.priceText && (
                <p className="mt-0.5 text-[12px] text-muted-foreground">
                  Price: {o.priceText}
                </p>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <h3 className="text-[13px] font-semibold tracking-tight">Templates</h3>
        {templates.length === 0 && (
          <p className="mt-2 text-[12.5px] text-muted-foreground">
            No templates yet.
          </p>
        )}
        <div className="mt-3 flex flex-col gap-2">
          {templates.map((t) => (
            <div key={t.id} className="rounded-lg border border-border p-3">
              <p className="text-[13px] font-semibold">{t.name}</p>
              <p className="text-[12px] text-muted-foreground">
                Subject: {t.subject}
              </p>
              <p className="mt-1 text-[12.5px] whitespace-pre-wrap text-muted-foreground">
                {plainMarkdown(t.bodyMd)}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <h3 className="text-[13px] font-semibold tracking-tight">
          Qualification rules
        </h3>
        {rules.length === 0 && (
          <p className="mt-2 text-[12.5px] text-muted-foreground">
            No qualification rules yet.
          </p>
        )}
        <div className="mt-3 flex flex-col gap-2">
          {rules.map((r) => (
            <div key={r.id} className="rounded-lg border border-border p-3">
              <p className="text-[13px] font-semibold">{r.name}</p>
              <p className="text-[12px] text-muted-foreground">
                {r.description}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
