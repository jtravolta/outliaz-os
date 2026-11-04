import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Outreach" };

export default function OutreachPage() {
  return (
    <section className="review-panel">
      <h1>Outreach</h1>
      <p>
        The prospect draft editor is the next workflow slice. No sending is
        available here.
      </p>
      <Button variant="outline" asChild>
        <Link href="/prospects">Review prospects</Link>
      </Button>
    </section>
  );
}
