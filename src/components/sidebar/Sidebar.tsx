"use client";

import React, { useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ICONS, SidebarConfig } from "./sidebar.config"; // <- your file
import { supabase } from "../../lib/supabase/client";
import {
  ChevronDown,
  MoreHorizontal,
  Settings,
  HelpCircle,
  LogOut,
} from "lucide-react";
import clsx from "clsx";

export default function Sidebar({
  config,
  initialCollapsed = false,
}: {
  config: SidebarConfig;
  initialCollapsed?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [flyout, setFlyout] = useState<string | null>(null);
  const anchorRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const active = (href: string) => pathname?.startsWith(href);

  return (
    <aside
      className={[
        "relative shrink-0 rounded-2xl border border-ink-line bg-ink-800 text-neu-200 shadow-panel",
        "transition-[width,padding] duration-200",
        collapsed ? "w-[68px] p-3" : "w-[300px] p-5",
      ].join(" ")}
    >
      {/* Collapse */}
      <button
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        onClick={() => {
          setFlyout(null);
          setCollapsed((v) => !v);
        }}
        className="absolute -right-3 top-4 grid h-7 w-7 place-items-center rounded-full border border-ink-line bg-ink-700 text-neu-300 shadow hover:text-neu-50"
        title={collapsed ? "Expand" : "Collapse"}
      >
        <ChevronDown className={["h-4 w-4 transition-transform", collapsed ? "-rotate-90" : ""].join(" ")} />
      </button>

      {/* Profile */}
      <div className="mb-5">
        <div className="flex items-center gap-3">
          <div
            className={[
              "grid place-items-center rounded-full bg-accent-600 text-white",
              collapsed ? "h-9 w-9 text-xs" : "h-10 w-10 text-sm",
            ].join(" ")}
            title={collapsed ? config.profile.name : undefined}
          >
            {config.profile.initials}
          </div>
          {!collapsed && (
            <div className="leading-tight">
              <div className="font-semibold text-neu-50">{config.profile.name}</div>
              <div className="text-xs uppercase tracking-wide text-neu-500">{config.profile.role}</div>
            </div>
          )}
        </div>

       {!collapsed && config.profile.status && (
  <div
    className={clsx(
      "mt-3 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium",
      {
        // ACTIVE → GREEN
        "border-green-600/20 bg-green-50 text-green-700": config.profile.status === "active",

        // INACTIVE / PENDING / ANYTHING ELSE → RED
        "border-danger/20 bg-[#2A1212] text-danger": config.profile.status !== "active",
      }
    )}
  >
    <span
      className={clsx("inline-block h-2 w-2 rounded-full", {
        "bg-green-600": config.profile.status === "active",
        "bg-danger": config.profile.status !== "active",
      })}
    />
    {config.profile.status}
  </div>
)}
      </div>

      {/* Sections */}
      <nav className="pt-2">
        {config.sections.map((section) => (
          <div key={section.id} className="mb-3">
            {!collapsed && (
              <div className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wider text-neu-600">
                {section.label}
              </div>
            )}

            <ul className="space-y-1.5">
              {section.groups.map((group) => {
                const Icon = ICONS[group.icon] ?? ICONS.Boxes;
                const expanded = !!open[group.id];

                return (
                  <li key={group.id} className="relative">
                    <button
                      // ref={(el) => (anchorRefs.current[group.id] = el)}
                      onClick={() => {
                        if (collapsed) setFlyout((f) => (f === group.id ? null : group.id));
                        else setOpen((o) => ({ ...o, [group.id]: !o[group.id] }));
                      }}
                      onMouseEnter={() => collapsed && setFlyout(group.id)}
                      onMouseLeave={() => collapsed && setFlyout(null)}
                      title={collapsed ? group.label : undefined}
                      className={[
                        "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors",
                        collapsed
                          ? "justify-center border-transparent hover:bg-ink-700"
                          : expanded
                          ? "border-accent-600/30 bg-accent-600/10 text-neu-50"
                          : "border-transparent bg-transparent text-neu-200 hover:bg-ink-700 hover:text-neu-50",
                      ].join(" ")}
                    >
                      {/* 👇 force bright icon in collapsed rail so it’s always visible */}
                      <Icon className={collapsed ? "h-5 w-5 text-white/90" : "h-4 w-4 text-neu-400"} />
                      {!collapsed && (
                        <>
                          <span className="text-[14px]">{group.label}</span>
                          <ChevronDown
                            className={[
                              "ml-auto h-4 w-4 text-neu-600 transition-transform",
                              expanded ? "rotate-180" : "",
                            ].join(" ")}
                          />
                        </>
                      )}
                    </button>

                    {/* Expanded list */}
                    {!collapsed && expanded && (
                      <div className="mt-2 pl-4">
                        <div className="ml-2 h-px w-[1px] bg-ink-line" />
                        <ul className="mt-2 space-y-1.5">
                          {group.items.map((it) => (
                            <li key={it.id}>
                              <Link
                                href={it.href}
                                className={[
                                  "flex items-center justify-between rounded-lg px-3 py-2 text-[14px]",
                                  active(it.href) ? "bg-ink-700 text-neu-50" : "text-neu-300 hover:bg-ink-700 hover:text-neu-50",
                                ].join(" ")}
                              >
                                <span>{it.label}</span>
                                <div className="flex items-center gap-2">
                                  {!!it.badge && (
                                    <span className="grid h-5 min-w-[20px] place-items-center rounded-full bg-accent-600 px-1.5 text-[11px] font-semibold text-white">
                                      {it.badge}
                                    </span>
                                  )}
                                  <MoreHorizontal className="h-4 w-4 text-neu-600" />
                                </div>
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Flyout when collapsed */}
                    {collapsed && flyout === group.id && (
                      <div
                        className="absolute left-[60px] top-0 z-50 min-w-[240px] translate-x-2 rounded-2xl border border-ink-line bg-ink-700 p-2 text-neu-200 shadow-xl"
                        onMouseLeave={() => setFlyout(null)}
                      >
                        <div className="px-2 pb-1 text-[12px] font-semibold uppercase tracking-wider text-neu-500">
                          {group.label}
                        </div>
                        <ul className="space-y-1">
                          {group.items.map((it) => (
                            <li key={it.id}>
                              <Link
                                href={it.href}
                                className={[
                                  "flex items-center justify-between rounded-lg px-3 py-2 text-sm",
                                  active(it.href) ? "bg-ink-600 text-neu-50" : "hover:bg-ink-600 hover:text-neu-50",
                                ].join(" ")}
                                onClick={() => setFlyout(null)}
                              >
                                <span>{it.label}</span>
                                {!!it.badge && (
                                  <span className="grid h-5 min-w-[20px] place-items-center rounded-full bg-accent-600 px-1.5 text-[11px] font-semibold text-white">
                                    {it.badge}
                                  </span>
                                )}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>

          </div>
        ))}

        <div className="mt-auto space-y-1.5 pt-4 border-t border-ink-line">
  {/* SETTINGS */}
  <Link
    href="/pages/setting/profile"
    className={[
      "flex items-center gap-3 rounded-lg px-2.5 py-2 text-neu-200 hover:bg-ink-700",
      collapsed ? "justify-center" : "",
    ].join(" ")}
    title="Settings"
  >
    <Settings className="h-5 w-5 text-neu-300" />
    {!collapsed && <span className="text-sm">Settings</span>}
  </Link>

  {/* HELP */}
  {/* <Link
    href="/help"
    className={[
      "flex items-center gap-3 rounded-lg px-2.5 py-2 text-neu-200 hover:bg-ink-700",
      collapsed ? "justify-center" : "",
    ].join(" ")}
    title="Help"
  >
    <HelpCircle className="h-5 w-5 text-neu-300" />
    {!collapsed && <span className="text-sm">Help</span>}
  </Link> */}

  {/* LOGOUT */}
  <button
    onClick={async () => {
      await supabase.auth.signOut();
      try {
    localStorage.removeItem("vendor:isLoggedIn");
    // tell other tabs
    localStorage.setItem("vendor:logout", Date.now().toString());
  } catch (e) {
    console.error("logout storage error", e);
  }

  router.replace("/pages/auth/login");
    }}
    className={[
      "flex items-center gap-3 rounded-lg px-2.5 py-2 text-accent-400 hover:text-accent-300",
      collapsed ? "justify-center" : "",
    ].join(" ")}
    title="Logout"
  >
    <LogOut className="h-5 w-5" />
    {!collapsed && <span className="text-sm">Logout</span>}
  </button>
</div>
      </nav>
    </aside>
  );
}