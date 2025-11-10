"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  CalendarDays,
  Package,
  Tag,       // 'Tags' icon is `Tag` in lucide-react
  ShoppingBasket,
  Users,
  PiggyBank,
  ChevronRight,
  ChevronDown,
  ChevronLeft,
  MoreHorizontal,
  Circle,
  Boxes,
} from "lucide-react";

/* ----------------------------- Types & Icons ----------------------------- */

const ICONS = {
  BarChart3,
  CalendarDays,
  Package,
  Tag,
  ShoppingBasket,
  Users,
  PiggyBank,
  Boxes,
} as const;

type IconName = keyof typeof ICONS;

export type SidebarLeaf = {
  id: string;
  label: string;
  href: string;
  badge?: number;
};

export type SidebarGroup = {
  id: string;
  label: string;
  icon: IconName;
  items: SidebarLeaf[];
};

export type SidebarSection = {
  id: string;
  label: string;
  groups: SidebarGroup[];
};

export type SidebarConfig = {
  profile: {
    initials: string;
    name: string;
    role: string;
    status?: string;
  };
  sections: SidebarSection[];
};

/* --------------------------------- Hook --------------------------------- */

function useLocalStorageFlag(key: string, initial = false) {
  const [val, setVal] = useState<boolean>(initial);
  useEffect(() => {
    const raw = window.localStorage.getItem(key);
    if (raw === "1") setVal(true);
    if (raw === "0") setVal(false);
  }, [key]);
  useEffect(() => {
    window.localStorage.setItem(key, val ? "1" : "0");
  }, [key, val]);
  return [val, setVal] as const;
}

/* ------------------------------ Flyout menu ----------------------------- */

function useClickAway<T extends HTMLElement>(onAway: () => void) {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) onAway();
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [onAway]);
  return ref;
}

/* -------------------------------- Sidebar -------------------------------- */

export default function Sidebar({ config }: { config: SidebarConfig }) {
  const pathname = usePathname();

  // collapsed rail state
  const [collapsed, setCollapsed] = useLocalStorageFlag("sidebar:collapsed", false);

  // which groups are open (expanded mode)
  const [open, setOpen] = useState<Record<string, boolean>>({});

  // which rail icon is showing a flyout (collapsed mode)
  const [flyout, setFlyout] = useState<string | null>(null);

  // close flyout on route change
  useEffect(() => setFlyout(null), [pathname]);

  // remember open group that contains current route (expanded mode)
  useEffect(() => {
    if (collapsed) return;
    const next: Record<string, boolean> = {};
    config.sections.forEach((s) =>
      s.groups.forEach((g) => {
        next[g.id] = g.items.some((i) => pathname?.startsWith(i.href));
      }),
    );
    setOpen((prev) => ({ ...prev, ...next }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, collapsed]);

  const railWidth = collapsed ? "w-16" : "w-[300px]";
  const textHide = collapsed ? "opacity-0 pointer-events-none select-none" : "opacity-100";

  return (
    <aside
      className={[
        "relative shrink-0 transition-all duration-200",
        railWidth,
      ].join(" ")}
    >
      {/* Panel */}
      <div
        className={[
          "h-screen sticky top-0",
          "bg-ink-800 text-neu-200 shadow-panel",
          "border border-ink-line",
          "rounded-2xl",
          collapsed ? "px-2 pt-4 pb-6" : "px-4 pt-5 pb-6",
        ].join(" ")}
      >
        {/* Header / Profile */}
        <div className={["flex items-center", collapsed ? "justify-center" : "justify-between", "mb-4"].join(" ")}>
          {!collapsed && (
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full grid place-items-center text-sm font-semibold text-white bg-accent-600">
                {config.profile.initials}
              </div>
              <div className="leading-tight">
                <div className="font-semibold text-neu-50">{config.profile.name}</div>
                <div className="text-[11px] text-neu-500 uppercase tracking-wider">{config.profile.role}</div>
              </div>
            </div>
          )}
          <button
            onClick={() => setCollapsed((v) => !v)}
            className={[
              "rounded-full border border-ink-line/80 bg-ink-700 hover:bg-ink-600",
              "p-2 text-neu-300 hover:text-neu-50 transition",
            ].join(" ")}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand" : "Collapse"}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>

        {/* Status pill (optional) */}
        {!collapsed && config.profile.status && (
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-[#2A1212] text-danger px-3 py-1 text-xs font-medium border border-danger/20">
            <span className="inline-block h-2 w-2 rounded-full bg-danger" />
            {config.profile.status}
          </div>
        )}

        {/* Sections */}
        <nav className="mt-2 space-y-6">
          {config.sections.map((section) => (
            <div key={section.id}>
              <div
                className={[
                  "px-3 mb-2 text-[11px] font-semibold uppercase tracking-wider text-neu-600",
                  collapsed && "sr-only",
                ].join(" ")}
              >
                {section.label}
              </div>

              <ul className="space-y-1">
                {section.groups.map((group) => {
                  const Icon = ICONS[group.icon];
                  const isOpen = !!open[group.id];
                  const inGroup = group.items.some((i) => pathname?.startsWith(i.href));
                  return (
                    <li key={group.id} className="relative">
                      {/* Group Row */}
                      <button
                        onClick={() => {
                          if (collapsed) {
                            // open flyout
                            setFlyout((f) => (f === group.id ? null : group.id));
                          } else {
                            setOpen((o) => ({ ...o, [group.id]: !o[group.id] }));
                          }
                        }}
                        onMouseEnter={() => collapsed && setFlyout(group.id)}
                        onMouseLeave={() => collapsed && setFlyout(null)}
                        className={[
                          "w-full flex items-center gap-3 rounded-xl border",
                          "px-3 py-2.5 transition",
                          inGroup
                            ? "bg-accent-600/10 border-accent-600/30 text-neu-50"
                            : "bg-transparent border-transparent hover:bg-ink-700 text-neu-200 hover:text-neu-50",
                        ].join(" ")}
                      >
                        <Icon className={["h-4 w-4", inGroup ? "text-accent-400" : "text-neu-500"].join(" ")} />
                        <span className={["text-[14px] transition", textHide].join(" ")}>{group.label}</span>
                        {!collapsed && (
                          <span className="ml-auto text-neu-500">
                            {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </span>
                        )}
                      </button>

                      {/* Expanded submenu (expanded mode) */}
                      {!collapsed && isOpen && (
                        <ul className="mt-2 pl-4 border-l border-ink-line/60 space-y-1">
                          {group.items.map((item) => {
                            const active = pathname?.startsWith(item.href);
                            return (
                              <li key={item.id}>
                                <Link
                                  href={item.href}
                                  className={[
                                    "flex items-center gap-3 rounded-lg px-3 py-2 transition",
                                    active
                                      ? "bg-ink-700 text-neu-50"
                                      : "text-neu-300 hover:text-neu-50 hover:bg-ink-700",
                                  ].join(" ")}
                                >
                                  <Circle className="h-2.5 w-2.5 text-neu-600" />
                                  <span className="text-[14px]">{item.label}</span>
                                  {!!item.badge && (
                                    <span className="ml-auto inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-accent-600/20 text-accent-300 text-[11px] px-1">
                                      {item.badge}
                                    </span>
                                  )}
                                  {/* Example trailing action (three dots) */}
                                  <MoreHorizontal className="ml-2 h-4 w-4 text-neu-600" />
                                </Link>
                              </li>
                            );
                          })}
                        </ul>
                      )}

                      {/* Flyout (collapsed mode) */}
                      {collapsed && flyout === group.id && (
                        <FlyoutMenu
                          title={group.label}
                          items={group.items}
                          onClose={() => setFlyout(null)}
                        />
                      )}
                    </li>
                  );
                })}
              </ul>

              {/* Divider */}
              <div className="my-4 h-px bg-ink-line" />
            </div>
          ))}

          {/* Settings & Help */}
          <div className="space-y-1">
            <Link
              href="/settings"
              className={[
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-neu-200 hover:text-neu-50 hover:bg-ink-700 transition",
                collapsed && "justify-center",
              ].join(" ")}
            >
              <Boxes className="h-4 w-4 text-neu-500" />
              <span className={textHide}>Settings</span>
            </Link>

            <Link
              href="/help"
              className={[
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-neu-200 hover:text-neu-50 hover:bg-ink-700 transition",
                collapsed && "justify-center",
              ].join(" ")}
            >
              <Circle className="h-4 w-4 text-neu-500" />
              <span className={textHide}>Help</span>
            </Link>
          </div>

          {/* Logout */}
          <button
            className={[
              "mt-6 inline-flex items-center gap-2 text-accent-400 hover:text-accent-300 px-3 py-2 rounded-lg transition",
              collapsed && "justify-center w-full",
            ].join(" ")}
            onClick={() => {
              // hook up to your sign out flow if you want from here
              document.dispatchEvent(new CustomEvent("sidebar:logout"));
            }}
          >
            <span className="h-4 w-4 rounded-sm border border-accent-400" />
            <span className={textHide}>Logout Account</span>
          </button>
        </nav>
      </div>
    </aside>
  );
}

/* -------------------------------- Flyout UI ------------------------------- */

function FlyoutMenu({
  title,
  items,
  onClose,
}: {
  title: string;
  items: SidebarLeaf[];
  onClose: () => void;
}) {
  const ref = useClickAway<HTMLDivElement>(onClose);
  const pathname = usePathname();

  return (
    <div
      ref={ref}
      className="absolute left-[68px] top-0 z-50 w-72 rounded-2xl border border-ink-line bg-ink-800 shadow-panel p-3"
    >
      <div className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-wider text-neu-600">{title}</div>
      <ul className="space-y-1">
        {items.map((it) => {
          const active = pathname?.startsWith(it.href);
          return (
            <li key={it.id}>
              <Link
                href={it.href}
                className={[
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 transition",
                  active ? "bg-ink-700 text-neu-50" : "text-neu-300 hover:text-neu-50 hover:bg-ink-700",
                ].join(" ")}
              >
                <span className="text-[14px]">{it.label}</span>
                {!!it.badge && (
                  <span className="ml-auto inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-accent-600/20 text-accent-300 text-[11px] px-1">
                    {it.badge}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
