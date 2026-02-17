"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { ColorModeToggle } from "./ColorModeToggle";
import { Button } from "@/components/ui/button";

const nav = [
  {
    label: "Active",
    href: "/",
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="1" y="1" width="4" height="14" rx="1" />
        <rect x="6" y="1" width="4" height="9" rx="1" />
        <rect x="11" y="1" width="4" height="11" rx="1" />
      </svg>
    ),
  },
  {
    label: "Backlog",
    href: "/backlog",
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M2 4h12M2 8h12M2 12h12" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: "Past",
    href: "/past",
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M2 3h12v10H2z" />
        <path d="M5 6h6M5 9h4" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: "Timeline",
    href: "/timeline",
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M8 1v14M3 4h4M9 7h4M3 10h4M9 13h4" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: "Inbox",
    href: "/inbox",
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M2 3h12v10H2z" />
        <path d="M2 9h3l1.5 2h3L11 9h3" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: "Policies",
    href: "/policies",
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="8" cy="8" r="2.5" />
        <path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.2 3.2l1.4 1.4M11.4 11.4l1.4 1.4M12.8 3.2l-1.4 1.4M4.6 11.4l-1.4 1.4" />
      </svg>
    ),
  },
];

export function AppSidebar() {
  const pathname = usePathname();
  const settingsActive = pathname === "/settings";

  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-56 flex-col border-r border-edge bg-surface">
      {/* Brand */}
      <div className="px-5 pt-5 pb-6">
        <Link href="/" className="block">
          <h1 className="text-lg font-bold tracking-tight text-ink font-heading">
            ClawPilot
          </h1>
          <p className="mt-0.5 text-[11px] text-ink-3 font-mono tracking-wide uppercase">
            Control Plane
          </p>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 space-y-0.5">
        {nav.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 rounded-themed px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? "bg-accent/10 text-accent"
                  : "text-ink-2 hover:bg-surface-hover hover:text-ink"
              }`}
            >
              {item.icon}
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Bottom controls */}
      <div className="border-t border-edge px-3 py-3 space-y-2">
        <Button
          asChild
          variant={settingsActive ? "secondary" : "ghost"}
          className="w-full justify-start gap-2.5 px-3"
        >
          <Link href="/settings">
            <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M6.7 1.5h2.6l.4 1.8 1.4.8 1.7-.7 1.8 1.8-.7 1.7.8 1.4 1.8.4v2.6l-1.8.4-.8 1.4.7 1.7-1.8 1.8-1.7-.7-1.4.8-.4 1.8H6.7l-.4-1.8-1.4-.8-1.7.7-1.8-1.8.7-1.7-.8-1.4-1.8-.4V7.3l1.8-.4.8-1.4-.7-1.7 1.8-1.8 1.7.7 1.4-.8z" />
              <circle cx="8" cy="8" r="2" />
            </svg>
            Settings
          </Link>
        </Button>
        <ColorModeToggle />
      </div>
    </aside>
  );
}
