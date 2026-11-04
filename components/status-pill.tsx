import { Badge } from "@/components/ui/primitives";

export function StatusPill({ status }: { status: string }) {
  const tone = status === "SUCCEEDED" || status === "DELIVERED" ? "green" : status === "FAILED" || status === "BOUNCED" ? "red" : status === "RUNNING" ? "blue" : "neutral";
  const labelText = status.replace(/_/g, " ");
  return <Badge tone={tone as never}>{labelText}</Badge>;
}
