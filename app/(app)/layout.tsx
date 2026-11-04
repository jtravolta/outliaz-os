import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { notifications, users, workspaces } from "@/lib/db/schema";
import { AppShell } from "@/components/app-shell";
import { CommandPalette } from "@/components/command-palette";
import type { NotificationItem, ShellUser } from "@/components/nav-meta";
import { getSession } from "@/lib/auth/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSession();
  if (!user) redirect("/login");

  const sessionUser: ShellUser = {
    userId: user.userId,
    workspaceId: user.workspaceId,
    email: user.email,
    name: user.name,
    role: user.role,
    workspaceName: user.workspaceName,
  };

  const notifs = await db
    .select({
      id: notifications.id, kind: notifications.kind, title: notifications.title, body: notifications.body,
      href: notifications.href, readAt: notifications.readAt,
    })
    .from(notifications)
    .where(eq(notifications.workspaceId, user.workspaceId))
    .orderBy(notifications.createdAt)
    .limit(8);

  const items: NotificationItem[] = notifs.map((n) => ({
    id: n.id, kind: n.kind, title: n.title, body: n.body, href: n.href, readAt: n.readAt,
  }));

  return (
    <AppShell user={sessionUser} notifications={items}>
      {children}
      <CommandPalette />
    </AppShell>
  );
}
