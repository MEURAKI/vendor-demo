"use client";

import React, { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ICONS, SidebarConfig } from "./sidebar.config";
import { supabase } from "../../lib/supabase/client";
import {
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Settings,
  LogOut,
} from "lucide-react";
import clsx from "clsx";

export default function Sidebar({
  config,
  initialCollapsed = true,
}: {
  config: SidebarConfig;
  initialCollapsed?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return initialCollapsed;
    try {
      const stored = localStorage.getItem("vendor:sidebar-collapsed");
      if (stored !== null) return stored === "true";
    } catch {}
    return initialCollapsed;
  });
  const [transitioning, setTransitioning] = useState(false);
  const [flyout, setFlyout] = useState<string | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const sidebarRef = useRef<HTMLDivElement>(null);

  const handleToggle = useCallback(() => {
    setTransitioning(true);
    setFlyout(null);
    const newVal = !collapsed;
    setCollapsed(newVal);
    try { localStorage.setItem("vendor:sidebar-collapsed", String(newVal)); } catch {}
  }, [collapsed]);

  const toggle = (id: string) =>
    setOpen((prev) => ({ ...prev, [id]: !prev[id] }));

  const active = (href: string) => pathname?.startsWith(href);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    try { localStorage.removeItem("vendor:isLoggedIn"); localStorage.setItem("vendor:logout", Date.now().toString()); } catch {}
    router.replace("/pages/auth/login");
  };

  return (
    <aside
      ref={sidebarRef}
      onTransitionEnd={() => setTransitioning(false)}
      className={clsx(
        "relative z-[60] shrink-0 flex flex-col bg-ink-800 text-neu-200 transition-[width] duration-300 ease-in-out",
        collapsed ? "w-[60px]" : "w-[250px]",
        // During transition: clip overflow. After: visible for flyouts (collapsed) or hidden for scroll (expanded)
        transitioning ? "overflow-hidden" : collapsed ? "overflow-visible" : "overflow-hidden"
      )}
    >
      {/* Toggle button — always outside scroll, always on top */}
      <button
        onClick={handleToggle}
        className="absolute -right-5 top-5 z-[100] grid h-9 w-9 place-items-center rounded-full border border-gray-700 bg-gray-800 text-gray-400 shadow-xl hover:text-white hover:bg-gray-700 transition-all"
      >
        {collapsed ? (
          <ChevronRight className="h-4 w-4" />
        ) : (
          <ChevronLeft className="h-4 w-4" />
        )}
      </button>

      {/* ============================================================ */}
      {/* Collapsed view — icon-only                                   */}
      {/* ============================================================ */}
      {collapsed ? (
        <div className="flex flex-1 flex-col py-5">
          {/* Avatar */}
          <div className="flex justify-center mb-5">
            <div
              className="grid h-8 w-8 place-items-center rounded-full bg-accent-600 text-[10px] font-bold text-white"
              title={config.profile.name}
            >
              {config.profile.initials}
            </div>
          </div>

          {/* Nav icons */}
          <nav className="flex-1 space-y-1.5 px-2">
            {config.sections.map((section) =>
              section.groups.map((group) => {
                const Icon = ICONS[group.icon] ?? ICONS.Boxes;
                const isSingle = group.items.length === 1;
                const isGroupActive = group.items.some((it) => active(it.href));

                if (isSingle) {
                  const item = group.items[0];
                  return (
                    <Link
                      key={group.id}
                      href={item.href}
                      className={clsx(
                        "group relative flex w-full items-center justify-center rounded-xl py-2.5 transition-colors",
                        active(item.href)
                          ? "bg-accent-600/20 text-accent-400"
                          : "text-neu-400 hover:bg-ink-700 hover:text-white"
                      )}
                      title={group.label}
                    >
                      <Icon className="h-5 w-5" />
                    </Link>
                  );
                }

                return (
                  <div
                    key={group.id}
                    className="relative"
                    onMouseEnter={() => setFlyout(group.id)}
                    onMouseLeave={() => setFlyout(null)}
                  >
                    <button
                      className={clsx(
                        "group relative flex w-full items-center justify-center rounded-xl py-2.5 transition-colors",
                        isGroupActive
                          ? "bg-accent-600/20 text-accent-400"
                          : "text-neu-400 hover:bg-ink-700 hover:text-white"
                      )}
                      title={group.label}
                    >
                      <Icon className="h-5 w-5" />
                    </button>

                    {flyout === group.id && (
                      <div
                        className="absolute left-[52px] top-0 z-50 min-w-[200px] rounded-xl border border-ink-line bg-ink-700 p-2 text-neu-200 shadow-xl"
                        onMouseEnter={() => setFlyout(group.id)}
                        onMouseLeave={() => setFlyout(null)}
                      >
                        <div className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-neu-500">
                          {group.label}
                        </div>
                        <ul className="space-y-0.5">
                          {group.items.map((it) => (
                            <li key={it.id}>
                              <Link
                                href={it.href}
                                className={clsx(
                                  "flex items-center justify-between rounded-lg px-3 py-1.5 text-xs transition-colors",
                                  active(it.href) ? "bg-ink-600 text-neu-50" : "hover:bg-ink-600 hover:text-neu-50"
                                )}
                                onClick={() => setFlyout(null)}
                              >
                                <span>{it.label}</span>
                                {!!it.badge && (
                                  <span className="grid h-4 min-w-[16px] place-items-center rounded-full bg-accent-600 px-1 text-[9px] font-semibold text-white">
                                    {it.badge}
                                  </span>
                                )}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </nav>

          {/* Bottom icons */}
          <div className="mt-auto space-y-1.5 border-t border-ink-line pt-4 px-2">
            <Link
              href="/pages/setting/profile"
              className="flex items-center justify-center rounded-xl py-2.5 text-neu-400 hover:bg-ink-700 hover:text-white transition-colors"
              title="Settings"
            >
              <Settings className="h-5 w-5" />
            </Link>
            <button
              onClick={handleLogout}
              className="flex w-full items-center justify-center rounded-xl py-2.5 text-accent-400 hover:text-accent-300 transition-colors"
              title="Logout"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
      ) : (
        /* ============================================================ */
        /* Expanded view                                                 */
        /* ============================================================ */
        <div className="flex-1 overflow-y-auto no-scrollbar px-5 py-6">
          {/* Profile */}
          <div className="flex items-center gap-3 mb-6">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent-600 text-[11px] font-bold text-white">
              {config.profile.initials}
            </div>
            <div className="min-w-0 leading-tight">
              <div className="text-sm font-semibold text-neu-50 truncate">{config.profile.name}</div>
              <div className="mt-1 flex items-center gap-1.5">
                <span className="inline-flex items-center rounded-full bg-ink-700 px-2 py-0.5 text-[9px] font-medium uppercase tracking-wide text-neu-400">
                  {config.profile.role}
                </span>
                <span className="inline-flex items-center rounded-full bg-emerald-500 px-2 py-0.5 text-[9px] font-medium text-white">
                  {config.profile.status}
                </span>
              </div>
            </div>
          </div>

          {/* Sections */}
          <nav className="flex-1 space-y-6">
            {config.sections.map((section) => (
              <div key={section.id}>
                <div className="mb-2.5 px-1 text-[10px] font-bold uppercase tracking-widest text-neu-600">
                  {section.label}
                </div>
                <ul className="space-y-1">
                  {section.groups.map((group) => {
                    const Icon = ICONS[group.icon] ?? ICONS.Boxes;
                    const isSingle = group.items.length === 1;
                    const isGroupActive = group.items.some((it) => active(it.href));
                    const isOpen = open[group.id] ?? isGroupActive;

                    if (isSingle) {
                      const item = group.items[0];
                      return (
                        <li key={group.id}>
                          <Link
                            href={item.href}
                            className={clsx(
                              "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] transition-colors",
                              active(item.href)
                                ? "bg-accent-600/20 text-accent-400 font-medium"
                                : "text-neu-300 hover:bg-ink-700 hover:text-neu-50"
                            )}
                          >
                            <Icon className="h-5 w-5 shrink-0" />
                            <span className="flex-1 text-left">{group.label}</span>
                          </Link>
                        </li>
                      );
                    }

                    return (
                      <li key={group.id}>
                        <button
                          onClick={() => toggle(group.id)}
                          className={clsx(
                            "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] transition-colors",
                            isGroupActive
                              ? "bg-accent-600/20 text-accent-400 font-medium"
                              : "text-neu-300 hover:bg-ink-700 hover:text-neu-50"
                          )}
                        >
                          <Icon className="h-5 w-5 shrink-0" />
                          <span className="flex-1 text-left">{group.label}</span>
                          <ChevronDown
                            className={clsx(
                              "h-3.5 w-3.5 shrink-0 transition-transform duration-200",
                              isOpen && "rotate-180"
                            )}
                          />
                        </button>

                        {isOpen && (
                          <ul className="mt-1 ml-7 space-y-0.5 border-l-2 border-neu-600 pl-3">
                            {group.items.map((it) => (
                              <li key={it.id}>
                                <Link
                                  href={it.href}
                                  className={clsx(
                                    "flex items-center justify-between rounded-lg px-3 py-2 text-[12px] transition-colors",
                                    active(it.href)
                                      ? "bg-ink-700 text-neu-50 font-medium"
                                      : "text-neu-400 hover:bg-ink-700/50 hover:text-neu-200"
                                  )}
                                >
                                  <span>{it.label}</span>
                                  {!!it.badge && (
                                    <span className="grid h-5 min-w-[20px] place-items-center rounded-full bg-accent-600 px-1.5 text-[10px] font-semibold text-white">
                                      {it.badge}
                                    </span>
                                  )}
                                </Link>
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>

          {/* Bottom */}
          <div className="mt-auto space-y-1 border-t border-ink-line pt-4">
            <Link
              href="/pages/setting/profile"
              className={clsx(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] transition-colors",
                active("/pages/setting") ? "bg-ink-700 text-neu-50" : "text-neu-300 hover:bg-ink-700 hover:text-neu-50"
              )}
            >
              <Settings className="h-5 w-5 shrink-0" />
              <span>Settings</span>
            </Link>
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] text-accent-400 hover:text-accent-300 transition-colors"
            >
              <LogOut className="h-5 w-5 shrink-0" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
