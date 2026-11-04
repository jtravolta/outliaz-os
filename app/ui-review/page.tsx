import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { CommandPalette } from "@/components/command-palette";

export const metadata = {
  title: "UI review",
  robots: { index: false, follow: false },
};

// Deliberately no DB or auth imports: this is a synthetic shell review, not a
// second login path or a preview of somebody's private workspace.
export default function UiReviewPage() {
  return (
    <AppShell
      preview
      user={{
        userId: "ui-review",
        workspaceId: "ui-review",
        email: "",
        name: "Swiss",
        role: "OWNER",
        workspaceName: "Personal workspace",
      }}
      notifications={[]}
    >
      <div className="review-title">
        <div>
          <h1>Today, Swiss.</h1>
          <p>Your prospect work, one clear next action at a time.</p>
        </div>
        <Button asChild>
          <Link href="/sources">Import prospects</Link>
        </Button>
      </div>
      <div className="review-metrics" aria-label="Preview workspace counts">
        <div>
          <span>Ready for research</span>
          <strong>0</strong>
        </div>
        <div>
          <span>Saved drafts</span>
          <strong>0</strong>
        </div>
        <div>
          <span>Follow-ups due</span>
          <strong>0</strong>
        </div>
      </div>
      <div className="review-grid">
        <section className="review-panel">
          <h2>Your next actions</h2>
          <div className="review-task">
            <div>
              <h3>Bring in your prospects</h3>
              <p>
                Review locations and fields before adding businesses for
                research.
              </p>
            </div>
            <Button variant="outline" asChild>
              <Link href="/prospects/import">Import file</Link>
            </Button>
          </div>
          <div className="review-task">
            <div>
              <h3>Research before outreach</h3>
              <p>
                Keep source facts, your observations and missing details
                distinct.
              </p>
            </div>
            <Button variant="ghost" asChild>
              <Link href="/prospects">Open prospects</Link>
            </Button>
          </div>
          <div className="review-task">
            <div>
              <h3>Shape the offer</h3>
              <p>
                Keep the service, value and scope beside your first email draft.
              </p>
            </div>
            <Button variant="ghost" asChild>
              <Link href="/library">Open offers</Link>
            </Button>
          </div>
        </section>
        <aside className="review-panel review-context">
          <h2>A focused first session</h2>
          <p>
            Import a file, research a business, choose an offer, then prepare a
            first email draft.
          </p>
          <p className="muted-copy">
            This screen uses an empty sample workspace to review the interface.
            It does not read or change your prospects.
          </p>
          <div className="review-safety">
            <span>Drafts only</span>
            <p>
              No email sending, scraping or database actions run in this
              preview.
            </p>
          </div>
        </aside>
      </div>
      <p className="review-footer">
        UI review. Navigation opens the existing app, where sign-in may be
        required. Import and draft functionality will be reviewed separately.
      </p>
      <CommandPalette />
    </AppShell>
  );
}
