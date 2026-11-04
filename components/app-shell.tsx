"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  BarChart3, Bell, BookOpen, Inbox, LayoutDashboard, Menu, PlayCircle, Radar, Search,
  Settings, Target, Workflow, X,
} from "lucide-react";
import { usePathname } from "next/navigation";
import type { NotificationItem, ShellUser } from "@/components/nav-meta";
import { NAV, SETTINGS_NAV, titleFor } from "@/components/nav-meta";

type NavItem = (typeof NAV)[number];

const NAV_ICONS: Record<string, typeof LayoutDashboard> = {
  LayoutDashboard, Target, Radar, PlayCircle, Workflow, Inbox, BookOpen, BarChart3,
};

export function AppShell({
  user,
  notifications,
  children,
}: {
  user: ShellUser;
  notifications: NotificationItem[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const unread = notifications.filter((n) => !n.readAt).length;
  const title = titleFor(pathname);

  const nav = useMemo(() => NAV, []);

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 top-0 z-40 hidden w-56 flex-col border-r border-border bg-card md:flex">
        <div className="flex h-14 items-center gap-2 border-b border-border px-4">
          <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Radar className="size-4" />
          </span>
          <span className="text-[15px] font-semibold tracking-tight">Outbound OS</span>
          <span className="ml-auto rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold text-muted-foreground uppercase">local</span>
        </div>
        <nav className="flex-1 overflow-y-auto p-2">
          {NAV.map((item) => (
            <NavLink key={item.href} item={item} pathname={pathname} onNavigate={() => setSidebarOpen(false)} />
          ))}
          <Link
            href={SETTINGS_NAV.href}
            onClick={() => setSidebarOpen(false)}
            className={`mt-1 flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors hover:bg-muted ${pathname.startsWith("/settings") ? "bg-muted text-foreground" : "text-muted-foreground"}`}
          >
            <SETTINGS_NAV.icon className="size-4" /> {SETTINGS_NAV.label}
          </Link>
        </nav>
        <div className="border-t border-border p-3">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-full bg-accent text-[11px] font-bold text-accent-foreground">
              {user.name.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("")}
            </span>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold">{user.name}</p>
              <p className="truncate text-[11px] text-muted-foreground capitalize">{user.role}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile sidebar drawer */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/45" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col border-r border-border bg-card shadow-2xl">
            <div className="flex h-14 items-center justify-between border-b border-border px-4">
              <span className="text-[15px] font-semibold tracking-tight">Outbound OS</span>
              <button className="rounded-md p-1 text-muted-foreground hover:bg-muted" onClick={() => setSidebarOpen(false)} aria-label="Close menu">
                <X className="size-4" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto p-2">
              {nav.map((item) => (
                <MobileLink key={item.href} item={item} pathname={pathname} onNavigate={() => setSidebarOpen(false)} />
              ))}
            </nav>
          </aside>
        </div>
      )}

      <div className="flex min-h-screen flex-1 flex-col md:pl-56">
        {/* Topbar */}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-card/90 px-4 backdrop-blur md:px-6">
          <button className="rounded-md p-2 text-muted-foreground hover:bg-muted md:hidden" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
            <Menu className="size-5" />
          </button>
          <h1 className="text-[15px] font-semibold tracking-tight">{title}</h1>
          <div className="ml-auto flex items-center gap-2">
            <Link
              href="/dashboard"
              className="hidden items-center gap-1.5 rounded-lg border border-border px-3 h-8 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:flex"
            >
              <Search className="size-3.5" /> Search prospects…
            </Link>
            <div className="relative">
              <button
                onClick={() => setNotifOpen((v) => !v)}
                className="relative rounded-lg border border-border p-2 text-muted-foreground transition-colors hover:bg-muted"
                aria-label="Notifications"
              >
                <Bell className="size-4" />
                {unread > 0 && <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-white">{unread}</span>}
              </button>
              {notifOpen && <NotificationPanel onClose={() => setNotifOpen(false)} />}
            </div>
            <Link
              href="/settings"
              className="flex items-center gap-2 rounded-lg border border-border py-1.5 pl-1.5 pr-3 transition-colors hover:bg-muted"
            >
              <span className="flex size-6 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-accent-foreground">
                {user.name.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("")}
              </span>
              <span className="hidden text-[13px] font-medium sm:block">{user.name}</span>
              <Settings className="size-3.5 text-muted-foreground" />
            </Link>
          </div>
        </header>

        <main className="flex-1 px-4 py-6 pb-24 md:px-6 md:pb-10">{children}</main>
      </div>

      {/* Mobile bottom tabs */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 flex items-stretch border-t border-border bg-card md:hidden">
        {NAV.slice(0, 4).map((item) => (
          <MobileTab key={item.href} item={item} pathname={pathname} />
        ))}
        <Link
          href={SETTINGS_NAV.href}
          className={`flex flex-1 items-center justify-center py-2.5 text-muted-foreground ${pathname.startsWith("/settings") ? "text-primary" : ""}`}
        >
          <Settings className="size-5" />
        </Link>
      </nav>
    </div>
  );
}

function NavLink({ item, pathname, onNavigate }: { item: NavItem; pathname: string; onNavigate: () => void }) {
  const Icon = item.icon;
  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors ${
        active ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
      }`}
    >
      <Icon className="size-4" /> {item.label}
    </Link>
  );
}

function MobileLink({ item, pathname, onNavigate }: { item: NavItem; pathname: string; onNavigate: () => void }) {
  const Icon = item.icon;
  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium ${active ? "bg-muted text-foreground" : "text-muted-foreground"}`}
    >
      <Icon className="size-4" /> {item.label}
    </Link>
  );
}

function MobileTab({ item, pathname }: { item: NavItem; pathname: string }) {
  const Icon = item.icon;
  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
  return (
    <Link
      href={item.href}
      className={`flex flex-1 items-center justify-center py-2.5 ${active ? "text-primary" : "text-muted-foreground"}`}
    >
      <Icon className="size-5" />
    </Link>
  );
}

function NotificationPanel({ onClose }: { onClose: () => void }) {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let on = true;
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then((data) => {
        if (!on) return;
        setItems(data.notifications ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
    return () => {
      on = false;
    };
  }, []);

  return (
    <div className="absolute right-0 top-12 z-50 w-80 rounded-xl border border-border bg-card p-2 shadow-lg">
      <div className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Notifications</div>
      {loading ? (
        <p className="px-2 py-4 text-[13px] text-muted-foreground">Loading…</p>
      ) : items.length === 0 ? (
        <p className="px-2 py-4 text-[13px] text-muted-foreground">All quiet for now.</p>
      ) : (
        items.slice(0, 10).map((n) => (
          <Link
            key={n.id}
            href={n.href ?? "/dashboard"}
            onClick={onClose}
            className="block rounded-lg px-2 py-2 hover:bg-muted"
          >
            <p className="text-[13px] font-medium">{n.title}</p>
            {n.body && <p className="mt-0.5 text-[12px] text-muted-foreground">{n.body}</p>}
          </Link>
        ))
      )}
    </div>
  );
}
