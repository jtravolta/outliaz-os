import {
  BarChart3,
  CalendarDays,
  Database,
  Inbox,
  PlayCircle,
  Send,
  Tag,
  UsersRound,
  Workflow,
  Settings,
  type LucideIcon,
} from "lucide-react";

export type ShellUser = {
  userId: string;
  workspaceId: string;
  email: string;
  name: string;
  role: "OWNER" | "ADMIN" | "MEMBER";
  workspaceName: string;
};

export type NotificationItem = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  href: string | null;
  readAt: Date | null;
};

export const NAV: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/dashboard", label: "Today", icon: CalendarDays },
  { href: "/prospects", label: "Prospects", icon: UsersRound },
  { href: "/sources", label: "Sources", icon: Database },
  { href: "/outreach", label: "Outreach", icon: Send },
  { href: "/inbox", label: "Inbox", icon: Inbox },
  { href: "/library", label: "Offers", icon: Tag },
  { href: "/reports", label: "Reports", icon: BarChart3 },
];

export const SECONDARY_NAV = [
  { href: "/runs", label: "Runs", icon: PlayCircle },
  { href: "/sequences", label: "Sequences", icon: Workflow },
] satisfies { href: string; label: string; icon: LucideIcon }[];

export const SETTINGS_NAV = {
  href: "/settings",
  label: "Settings",
  icon: Settings,
} as const;
export function titleFor(path: string) {
  const base = path.split("?")[0] || "/dashboard";
  const hit = [...NAV, ...SECONDARY_NAV].find((n) => base === n.href);
  if (hit) return hit.label;
  if (base.startsWith("/prospects/")) return "Prospect";
  if (base.startsWith("/sources/")) return "Source";
  if (base.startsWith("/runs/")) return "Run";
  if (base.startsWith("/sequences/")) return "Sequence";
  if (base.startsWith("/inbox/")) return "Reply";
  if (base.startsWith("/library/")) return "Offers";
  if (base === "/settings" || base.startsWith("/settings/")) return "Settings";
  if (base === "/ui-review") return "Today";
  return "Outliaz OS";
}
