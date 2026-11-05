import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { CommandPalette } from "@/components/command-palette";
import type { ShellUser } from "@/components/nav-meta";
import { getSession } from "@/lib/auth/session";
import { listShellNotifications } from "@/lib/services/shell-notifications";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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

  const items = await listShellNotifications();

  return (
    <AppShell
      user={sessionUser}
      notifications={items}
      command={<CommandPalette />}
    >
      {children}
    </AppShell>
  );
}
