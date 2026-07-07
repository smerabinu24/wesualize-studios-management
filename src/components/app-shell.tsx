"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useState } from "react";
import {
  LayoutDashboard, Users, Briefcase, FolderKanban, CheckSquare,
  BarChart3, Settings, LogOut, Menu, X, UserCog,
} from "lucide-react";
import { Logo } from "./logo";
import { cn } from "@/lib/utils";
import type { Role } from "@prisma/client";
import { can, type Permission, ROLE_LABELS } from "@/lib/rbac";
import { ThemeToggle } from "./theme-toggle";
import { Avatar, Button } from "./ui/primitives";

type NavItem = { href: string; label: string; icon: React.ElementType; perm: Permission | null };
type NavSection = { heading: string; items: NavItem[] };

const NAV_SECTIONS: NavSection[] = [
  {
    heading: "Overview",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, perm: null },
      { href: "/tasks", label: "My Tasks", icon: CheckSquare, perm: "task:update-own" },
    ],
  },
  {
    heading: "Workspace",
    items: [
      { href: "/projects", label: "Projects", icon: FolderKanban, perm: "analytics:view-team" },
      { href: "/employees", label: "Employees", icon: Users, perm: "analytics:view-team" },
      { href: "/clients", label: "Clients", icon: Briefcase, perm: "analytics:view-team" },
    ],
  },
  {
    heading: "Insights",
    items: [
      { href: "/reports", label: "Reports", icon: BarChart3, perm: "report:export" },
      { href: "/settings", label: "Settings", icon: Settings, perm: "settings:manage" },
    ],
  },
  {
    heading: "Account",
    items: [
      { href: "/account", label: "My Account", icon: UserCog, perm: null },
    ],
  },
];

export function AppShell({
  children,
  user,
}: {
  children: React.ReactNode;
  user: { name?: string | null; role: Role; avatarUrl: string | null; email?: string | null };
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const sections = NAV_SECTIONS.map((s) => ({
    ...s,
    items: s.items.filter((i) => i.perm === null || can(user.role, i.perm)),
  })).filter((s) => s.items.length > 0);

  return (
    <div className="flex min-h-dvh bg-background">
      {/* Sidebar (persistent ≥1024px; drawer on mobile) */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 transform border-r border-border bg-card transition-transform duration-200 lg:static lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-16 items-center gap-2.5 px-5">
          <Logo size={34} />
          <div className="leading-none">
            <div className="text-[15px] font-semibold tracking-tight">Wesualize</div>
            <div className="mt-0.5 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Studios</div>
          </div>
        </div>
        <nav className="flex flex-col gap-5 px-3 py-2" aria-label="Primary">
          {sections.map((section) => (
            <div key={section.heading}>
              <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                {section.heading}
              </p>
              <div className="flex flex-col gap-0.5">
                {section.items.map((item) => {
                  const active = pathname === item.href || pathname.startsWith(item.href + "/");
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                        active
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      {active && <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-primary" />}
                      <item.icon className="h-4 w-4 shrink-0" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      {open && <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setOpen(false)} />}

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border bg-card/80 px-4 backdrop-blur lg:px-6">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Toggle navigation" onClick={() => setOpen((o) => !o)}>
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
            <h1 className="text-sm font-medium text-muted-foreground">Studio Management System</h1>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <div className="flex items-center gap-2">
              <Avatar name={user.name ?? "User"} src={user.avatarUrl} size={32} />
              <div className="hidden text-right sm:block">
                <div className="text-sm font-medium leading-tight">{user.name}</div>
                <div className="text-xs text-muted-foreground">{ROLE_LABELS[user.role]}</div>
              </div>
            </div>
            <Button variant="ghost" size="icon" aria-label="Sign out" onClick={() => signOut({ callbackUrl: "/login" })}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
