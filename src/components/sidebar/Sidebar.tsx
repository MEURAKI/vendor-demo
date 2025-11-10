// components/sidebar/Sidebar.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, ChevronLeft, LogOut, Settings, HelpCircle } from "lucide-react";
import { StatusPill } from "./status-pill";
import type { SidebarConfig, SidebarItem, SidebarSection } from "./sidebar-types";

const STORAGE_KEYS = {
  collapsed: "mrx:sidebar:collapsed",
  openSections: "mrx:sidebar:openSections",
};

type Props = {
  config: SidebarConfig;
  /** Auto-collapse after you click a nav item (matches your note) */
  autoCollapseOnNavigate?: boolean;
};

export default function Sidebar({ config, autoCollapseOnNavigate = true }: Props) {
  const pathname = usePathname();
  const router = useRouter();

  // collapsed rail
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(STORAGE_KEYS.collapsed) === "1";
  });

  useEffect(() => localStorage.setItem(STORAGE_KEYS.collapsed, collapsed ? "1" : "0"), [collapsed]);

  // which sections are open
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    if (typeof window === "undefined") return {};
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.openSections) || "{}");
    } catch {
      return {};
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.openSections, JSON.stringify(openSections));
  }, [openSections]);

  const toggleSection = (id: string, forced?: boolean) =>
    setOpenSections(p => ({ ...p, [id]: forced ?? !p[id] }));

  const widthClass = collapsed ? "w-[76px]" : "w-[280px]";
  const labelClass = collapsed ? "opacity-0 pointer-events-none select-none" : "opacity-100";

  // When navigating, collapse if needed
  const onNavigate = (href?: string) => {
    if (!href) return;
    router.push(href);
    if (autoCollapseOnNavigate && !collapsed) setCollapsed(true);
  };

  return (
    <aside
      className={`flex h-screen flex-col bg-zinc-950 text-zinc-100 ${widthClass} transition-[width] duration-200 ease-out shadow-xl`}
      aria-label="Sidebar Navigation"
    >
      {/* Header profile */}
      <div className="p-3 pb-0">
        <div className="relative overflow-hidden rounded-xl bg-zinc-900 ring-1 ring-white/10">
          <div className="flex items-center gap-3 px-3 py-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-fuchsia-600 text-sm font-semibold">
              {config.profile.initials}
            </div>
            <div className={`min-w-0 ${labelClass} transition-opacity`}>
              <div className="truncate text-sm font-semibold">{config.profile.name}</div>
              {config.profile.role && (
                <div className="truncate text-xs text-zinc-400">{config.profile.role}</div>
              )}
            </div>
          </div>
          {!collapsed && (
            <div className="px-3 pb-3">
              <StatusPill status={config.profile.status} />
            </div>
          )}
          {/* Collapse Button */}
          <button
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            onClick={() => setCollapsed(c => !c)}
            className="absolute right-2 top-2 rounded-md p-1.5 text-zinc-300 hover:bg-zinc-800 hover:text-white"
          >
            <ChevronLeft
              className={`h-4 w-4 transition-transform ${collapsed ? "rotate-180" : ""}`}
            />
          </button>
        </div>
      </div>

      {/* Sections */}
      <nav className="mt-3 flex-1 space-y-4 overflow-y-auto px-3 pb-6">
        {config.sections.map(section => (
          <SectionBlock
            key={section.id}
            section={section}
            collapsed={collapsed}
            open={resolveOpen(section, openSections)}
            onToggle={() => toggleSection(section.id)}
            activePath={pathname}
            onNavigate={onNavigate}
          />
        ))}

        {/* Static bottom: Settings / Help / Logout */}
        <div className="mt-4 border-t border-white/10 pt-4 space-y-1">
          <SimpleItem
            icon={Settings}
            label="Settings"
            href="/settings"
            collapsed={collapsed}
            active={pathname?.startsWith("/settings")}
            onClick={() => onNavigate("/settings")}
          />
          <SimpleItem
            icon={HelpCircle}
            label="Help"
            href="/help"
            collapsed={collapsed}
            active={pathname?.startsWith("/help")}
            onClick={() => onNavigate("/help")}
          />
          <SimpleItem
            icon={LogOut}
            label="Logout Account"
            collapsed={collapsed}
            onClick={() => onNavigate("/logout")} // wire to your signOut
          />
        </div>
      </nav>
    </aside>
  );
}

/* ---------- helpers & pieces ---------- */

function resolveOpen(s: SidebarSection, map: Record<string, boolean>) {
  if (typeof s.defaultOpen === "boolean") return s.defaultOpen;
  return map[s.id] ?? true;
}

function SectionBlock({
  section,
  collapsed,
  open,
  onToggle,
  activePath,
  onNavigate,
}: {
  section: SidebarSection;
  collapsed: boolean;
  open: boolean;
  onToggle: () => void;
  activePath?: string | null;
  onNavigate: (href?: string) => void;
}) {
  const isCollapsible = section.collapsible !== false;

  return (
    <div className="select-none">
      <div className="flex items-center justify-between px-2 py-1.5 text-xs uppercase tracking-wide text-zinc-400">
        <span className={`${collapsed ? "opacity-0" : "opacity-100"} transition-opacity`}>
          {section.label}
        </span>
        {!collapsed && isCollapsible && (
          <button
            className="rounded p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white"
            onClick={onToggle}
            aria-label={open ? "Collapse section" : "Expand section"}
          >
            <ChevronDown className={`h-4 w-4 transition-transform ${open ? "" : "-rotate-90"}`} />
          </button>
        )}
      </div>

      {/* Items */}
      <div className={`${open ? "max-h-[1000px]" : "max-h-0"} overflow-hidden transition-[max-height] duration-300`}>
        <ul className="space-y-1">
          {section.items.map(item => {
            const active = item.href && activePath?.startsWith(item.href);
            return (
              <li key={item.id}>
                <SimpleItem
                  icon={item.icon}
                  label={item.label}
                  badge={item.countBadge}
                  href={item.href}
                  target={item.target}
                  collapsed={collapsed}
                  active={!!active}
                  onClick={() => onNavigate(item.href)}
                />
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function SimpleItem({
  icon: Icon,
  label,
  badge,
  href,
  target,
  collapsed,
  active,
  onClick,
}: {
  icon: any;
  label: string;
  badge?: number | string;
  href?: string;
  target?: "_blank";
  collapsed: boolean;
  active?: boolean;
  onClick?: () => void;
}) {
  const base =
    "group flex items-center gap-3 rounded-lg px-2 py-2 text-sm transition-colors";
  const colors = active
    ? "bg-zinc-800 text-white"
    : "text-zinc-300 hover:bg-zinc-800 hover:text-white";
  const content = (
    <div className={`${base} ${colors}`} onClick={onClick}>
      <Icon className="h-5 w-5 shrink-0" />
      <span className={`${collapsed ? "opacity-0" : "opacity-100"} transition-opacity grow`}>
        {label}
      </span>
      {!collapsed && badge != null && (
        <span className="ml-auto rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-200">
          {badge}
        </span>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} target={target} className="block">
        {content}
      </Link>
    );
  }
  return content;
}
