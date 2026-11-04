"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  Bell,
  Ellipsis,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Sun,
} from "lucide-react";
import {
  NAV,
  SECONDARY_NAV,
  SETTINGS_NAV,
  titleFor,
  type NotificationItem,
  type ShellUser,
} from "@/components/nav-meta";
import { useShellPreferences } from "@/components/shell-preferences";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type NavItem = (typeof NAV)[number];

export function AppShell({
  user,
  notifications,
  children,
  preview = false,
}: {
  user: ShellUser;
  notifications: NotificationItem[];
  children: ReactNode;
  preview?: boolean;
}) {
  const pathname = usePathname();
  const { theme, collapsed, toggleTheme, toggleSidebar } =
    useShellPreferences();
  const [moreOpen, setMoreOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const title = titleFor(pathname);
  const unread = notifications.filter((item) => !item.readAt).length;
  const themeLabel =
    theme === "dark" ? "Switch to light theme" : "Switch to dark theme";
  const collapseLabel = collapsed ? "Expand sidebar" : "Collapse sidebar";
  const mobileItems = [NAV[0], NAV[1], NAV[4]];

  return (
    <div className="outliaz-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <aside
        id="workspace-sidebar"
        className="workspace-sidebar"
        aria-label="Workspace sidebar"
      >
        <Link
          href="/dashboard"
          className="wordmark"
          aria-label="outliaz Outliaz OS home"
        >
          <span className="wordmark-full" aria-hidden="true">
            outliaz{" "}
          </span>
          <span className="wordmark-short" aria-hidden="true">
            o
          </span>
          <span className="wordmark-caption" aria-hidden="true">
            Outliaz OS
          </span>
        </Link>
        <nav className="workspace-nav" aria-label="Main navigation">
          {NAV.map((item) => (
            <WorkspaceLink
              key={item.href}
              item={item}
              pathname={preview ? "/dashboard" : pathname}
              collapsed={collapsed}
            />
          ))}
        </nav>
        <nav className="secondary-nav" aria-label="More tools">
          {SECONDARY_NAV.map((item) => (
            <WorkspaceLink
              key={item.href}
              item={item}
              pathname={pathname}
              collapsed={collapsed}
            />
          ))}
        </nav>
        <footer className="sidebar-footer">
          <div className="workspace-identity">
            <span className="identity-name">{user.name}</span>
            <span className="identity-scope">{user.workspaceName}</span>
          </div>
          <WorkspaceLink
            item={SETTINGS_NAV}
            pathname={pathname}
            collapsed={collapsed}
          />
        </footer>
      </aside>

      <div className="workspace-frame">
        <header className="workspace-topbar">
          <div className="workspace-location">
            <div className="desktop-control">
              <IconAction
                label={collapseLabel}
                onClick={toggleSidebar}
                aria-controls="workspace-sidebar"
                aria-expanded={!collapsed}
              >
                {collapsed ? (
                  <PanelLeftOpen aria-hidden="true" />
                ) : (
                  <PanelLeftClose aria-hidden="true" />
                )}
              </IconAction>
            </div>
            <span className="workspace-crumb">
              Workspace <span aria-hidden="true">/</span> <span>{title}</span>
            </span>
          </div>
          <div className="topbar-actions">
            <span className="workspace-mode">
              {preview ? "UI preview" : "Local workspace"}
            </span>
            <Sheet open={notificationsOpen} onOpenChange={setNotificationsOpen}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <SheetTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={
                        unread
                          ? `Notifications, ${unread} unread`
                          : "Notifications"
                      }
                    >
                      <Bell aria-hidden="true" />
                      {unread > 0 && (
                        <span className="notification-dot" aria-hidden="true" />
                      )}
                    </Button>
                  </SheetTrigger>
                </TooltipTrigger>
                <TooltipContent>Notifications</TooltipContent>
              </Tooltip>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>Notifications</SheetTitle>
                  <SheetDescription>
                    {preview
                      ? "No account data is connected to this preview."
                      : "Updates from your workspace."}
                  </SheetDescription>
                </SheetHeader>
                <div className="notification-list">
                  {notifications.length === 0 ? (
                    <p className="muted-copy">No notifications.</p>
                  ) : (
                    notifications.map((item) => (
                      <Link
                        key={item.id}
                        href={item.href ?? "/dashboard"}
                        className="notification-item"
                        onClick={() => setNotificationsOpen(false)}
                      >
                        <strong>{item.title}</strong>
                        {item.body && <span>{item.body}</span>}
                        {!item.readAt && (
                          <span className="notification-unread">Unread</span>
                        )}
                      </Link>
                    ))
                  )}
                </div>
              </SheetContent>
            </Sheet>
            <IconAction label={themeLabel} onClick={toggleTheme}>
              {theme === "dark" ? (
                <Sun aria-hidden="true" />
              ) : (
                <Moon aria-hidden="true" />
              )}
            </IconAction>
          </div>
        </header>
        <main id="main-content" className="workspace-content" tabIndex={-1}>
          {children}
        </main>
      </div>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <nav className="mobile-navigation" aria-label="Mobile navigation">
          {mobileItems.map((item) => {
            const Icon = item.icon;
            const active =
              (preview && item.href === "/dashboard") ||
              isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn("mobile-destination", active && "is-active")}
                aria-current={active ? "page" : undefined}
              >
                <Icon aria-hidden="true" className="shell-icon" />
                <span>{item.label}</span>
              </Link>
            );
          })}
          <SheetTrigger asChild>
            <button
              className={cn("mobile-destination", moreOpen && "is-active")}
              type="button"
            >
              <Ellipsis aria-hidden="true" className="shell-icon" />
              <span>More</span>
            </button>
          </SheetTrigger>
        </nav>
        <SheetContent side="bottom">
          <SheetHeader>
            <SheetTitle>Workspace</SheetTitle>
            <SheetDescription>
              Tools and preferences for {user.name}.
            </SheetDescription>
          </SheetHeader>
          <nav className="mobile-more-links" aria-label="More destinations">
            {[
              NAV[2],
              NAV[3],
              NAV[5],
              NAV[6],
              ...SECONDARY_NAV,
              SETTINGS_NAV,
            ].map((item) => (
              <WorkspaceLink
                key={item.href}
                item={item}
                pathname={pathname}
                collapsed={false}
                onNavigate={() => setMoreOpen(false)}
              />
            ))}
          </nav>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function WorkspaceLink({
  item,
  pathname,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  pathname: string;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  const active = isActive(pathname, item.href);
  return (
    <Tooltip open={collapsed ? undefined : false}>
      <TooltipTrigger asChild>
        <Link
          href={item.href}
          onClick={onNavigate}
          className={cn("workspace-nav-link", active && "is-active")}
          aria-label={item.label}
          aria-current={active ? "page" : undefined}
        >
          <Icon aria-hidden="true" className="shell-icon" />
          <span className="nav-label">{item.label}</span>
        </Link>
      </TooltipTrigger>
      <TooltipContent side="right">{item.label}</TooltipContent>
    </Tooltip>
  );
}

function IconAction({
  label,
  children,
  ...props
}: {
  label: string;
  children: ReactNode;
} & Omit<React.ComponentProps<typeof Button>, "children">) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={label} {...props}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
