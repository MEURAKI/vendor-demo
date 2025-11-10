"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import {
  BarChart3,
  CalendarDays,
  Package,
  Tags,           // <- use Tags (plural)
  ShoppingBasket,
  Users,
  PiggyBank,
  Boxes,          // <- for Orders
  ChevronDown,
  MoreHorizontal,
} from "lucide-react";
import { supabase } from "../../../lib/supabase/client";

/* ----------------------------- Types & Icons ----------------------------- */

const ICONS = {
  BarChart3,
  CalendarDays,
  Package,
  Tags,
  ShoppingBasket,
  Users,
  PiggyBank,
  Boxes,
};
type IconName = keyof typeof ICONS;

type SidebarItem = {
  id: string;
  label: string;
  href: string;
  badge?: number;
};

type SidebarGroup = {
  id: string;
  label: string;
  icon: IconName;
  items: SidebarItem[];
};

type SidebarSection = {
  id: string;
  label: string;
  groups: SidebarGroup[];
};

type SidebarConfig = {
  profile: {
    initials: string;
    name: string;
    role: string;
    status: string;
  };
  sections: SidebarSection[];
};

/* ------------------------------ Utilities -------------------------------- */

type UserStatus =
  | "pending_admin_approval"
  | "approved"
  | "active"
  | "rejected"
  | "suspended";

type Profile = {
  id: string;
  email: string | null;
  status: UserStatus;
  onboarding_completed: boolean;
  full_name: string | null;
};

function getInitials(nameOrEmail?: string | null) {
  if (!nameOrEmail) return "U";
  const name = nameOrEmail.includes("@") ? nameOrEmail.split("@")[0] : nameOrEmail;
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/* ----------------------------- Sidebar UI -------------------------------- */

function Sidebar({ config }: { config: SidebarConfig }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [flyoutFor, setFlyoutFor] = useState<string | null>(null);
  const flyoutAnchorRef = useRef<Record<string, HTMLButtonElement | null>>({});

  const toggleGroup = (id: string) =>
    setOpenGroups((p) => ({ ...p, [id]: !p[id] }));

  const isActiveHref = (href: string) => pathname?.startsWith(href);

  return (
    <aside
      className={[
        "relative shrink-0 border border-ink-line bg-ink-800 text-neu-200 shadow-panel",
        "rounded-2xl transition-[width,padding] duration-200",
        collapsed ? "w-[68px] p-3" : "w-[300px] p-5",
      ].join(" ")}
    >
      {/* Collapse toggle */}
      <button
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        onClick={() => {
          setFlyoutFor(null);
          setCollapsed((v) => !v);
        }}
        className="absolute -right-3 top-4 grid h-7 w-7 place-items-center rounded-full
                   bg-ink-700 text-neu-300 hover:text-neu-50 shadow border border-ink-line"
        title={collapsed ? "Expand" : "Collapse"}
      >
        <ChevronDown
          className={[
            "h-4 w-4 transition-transform",
            collapsed ? "-rotate-90" : "rotate-0",
          ].join(" ")}
        />
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
              <div className="text-xs uppercase tracking-wide text-neu-500">
                {config.profile.role}
              </div>
            </div>
          )}
        </div>

        {!collapsed && (
          <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-[#2A1212] text-danger
                          px-3 py-1 text-xs font-medium border border-danger/20">
            <span className="inline-block h-2 w-2 rounded-full bg-danger" />
            {config.profile.status}
          </div>
        )}

        {!collapsed && (
          <div className="mt-4 rounded-2xl bg-gradient-to-b from-accent-500 to-accent-600 p-4 text-neu-50">
            <div className="font-semibold leading-snug">
              Complete Your <br />
              Business Setup
            </div>
            <p className="mt-2 text-[13px] text-white/80">
              Fill out the onboarding form with your business details to activate your shop.
            </p>
            <button className="mt-3 inline-flex items-center rounded-full bg-black/80 px-4 py-2 text-sm text-white transition hover:bg-black">
              Open Form
            </button>
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
                const Icon = ICONS[group.icon];
                const expanded = !!openGroups[group.id];

                return (
                  <li key={group.id} className="relative">
                    {/* Group button */}
                    <button
                      ref={(el) => {
                        flyoutAnchorRef.current[group.id] = el;
                      }}
                      onClick={() => {
                        if (collapsed) {
                          setFlyoutFor((cur) => (cur === group.id ? null : group.id));
                        } else {
                          toggleGroup(group.id);
                        }
                      }}
                      title={collapsed ? group.label : undefined}
                      className={[
                        "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left",
                        "transition-colors",
                        collapsed
                          ? "justify-center border-transparent hover:bg-ink-700"
                          : expanded
                          ? "border-accent-600/30 bg-accent-600/10 text-neu-50"
                          : "border-transparent bg-transparent text-neu-200 hover:bg-ink-700 hover:text-neu-50",
                      ].join(" ")}
                    >
                      <Icon className={collapsed ? "h-5 w-5" : "h-4 w-4 text-neu-400"} />
                      {!collapsed && (
                        <>
                          <span className="text-[14px]">{group.label}</span>
                          <ChevronDown
                            className={[
                              "ml-auto h-4 w-4 text-neu-600 transition-transform",
                              expanded ? "rotate-180" : "rotate-0",
                            ].join(" ")}
                          />
                        </>
                      )}
                    </button>

                    {/* Items: expanded (full) */}
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
                                  isActiveHref(it.href)
                                    ? "bg-ink-700 text-neu-50"
                                    : "text-neu-300 hover:bg-ink-700 hover:text-neu-50",
                                ].join(" ")}
                              >
                                <span>{it.label}</span>
                                <div className="flex items-center gap-2">
                                  {typeof it.badge === "number" && it.badge > 0 && (
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

                    {/* Items: flyout (collapsed) */}
                    {collapsed && flyoutFor === group.id && (
                      <div
                        className="absolute left-[60px] top-0 z-50 min-w-[240px] translate-x-2 rounded-2xl border border-ink-line bg-ink-700 p-2 text-neu-200 shadow-xl"
                        onMouseLeave={() => setFlyoutFor(null)}
                      >
                        {!collapsed && (
                          <div className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-wider text-neu-600">
                            {section.label}
                          </div>
                        )}
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
                                  isActiveHref(it.href)
                                    ? "bg-ink-600 text-neu-50"
                                    : "hover:bg-ink-600 hover:text-neu-50",
                                ].join(" ")}
                                onClick={() => setFlyoutFor(null)}
                              >
                                <span>{it.label}</span>
                                {typeof it.badge === "number" && it.badge > 0 && (
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

            {/* Divider */}
            <div className="my-4 h-px bg-ink-line" />
          </div>
        ))}

        {/* Footer items */}
        <div className="space-y-1.5">
          <Link
            href="/settings"
            className={[
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-neu-200 hover:bg-ink-700",
              collapsed ? "justify-center" : "",
            ].join(" ")}
            title={collapsed ? "Settings" : undefined}
          >
            <span className="h-4 w-4 rounded border border-neu-600" />
            {!collapsed && <span>Settings</span>}
          </Link>

          <Link
            href="/help"
            className={[
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-neu-200 hover:bg-ink-700",
              collapsed ? "justify-center" : "",
            ].join(" ")}
            title={collapsed ? "Help" : undefined}
          >
            <span className="h-4 w-4 rounded-full border border-neu-600" />
            {!collapsed && <span>Help</span>}
          </Link>

          <button
            onClick={() => supabase.auth.signOut()}
            className={[
              "mt-4 inline-flex items-center gap-2 rounded-lg px-3 py-2 text-accent-400 hover:text-accent-300",
              collapsed ? "mx-auto" : "",
            ].join(" ")}
            title={collapsed ? "Logout" : undefined}
          >
            <span className="h-4 w-4 rounded-sm border border-accent-400" />
            {!collapsed && <span>Logout Account</span>}
          </button>
        </div>
      </nav>
    </aside>
  );
}

/* ------------------------------ Page Logic ------------------------------- */

export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);

  const redirectPath = useMemo(() => {
    if (!profile) return null;
    if (profile.status === "pending_admin_approval") return "/pages/auth/pending";
    if (profile.status === "approved" && !profile.onboarding_completed)
      return "/pages/onboarding/start";
    return null;
  }, [profile]);

  useEffect(() => {
    let unsub: (() => void) | undefined;

    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth.user;
      if (!user) {
        router.replace("/pages/auth/login");
        return;
      }

      const { data: prof, error } = await supabase
        .from("profiles")
        .select("id, email, status, onboarding_completed, full_name")
        .eq("id", user.id)
        .single();

      if (!error) setProfile(prof as Profile);

      const channel = supabase
        .channel(`profiles:${user.id}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "profiles", filter: `id=eq.${user.id}` },
          (payload) => setProfile(payload.new as Profile)
        )
        .subscribe();

      unsub = () => supabase.removeChannel(channel);
      setLoading(false);
    })();

    return () => unsub?.();
  }, [router]);

  useEffect(() => {
    if (!loading && redirectPath) router.replace(redirectPath);
  }, [loading, redirectPath, router]);

  const sidebarConfig = useMemo<SidebarConfig>(() => {
    const displayName = profile?.full_name || profile?.email || "User";
    return {
      profile: {
        initials: getInitials(profile?.full_name || profile?.email),
        name: displayName,
        role: "Vendor",
        status: "Incomplete Registration",
      },
      sections: [
        {
          id: "overview",
          label: "Overview",
          groups: [
            {
              id: "dashboard",
              label: "Dashboard",
              icon: "BarChart3",
              items: [{ id: "dash-home", label: "Home", href: "/pages/dashboard" }],
            },
            {
              id: "calendar",
              label: "Calendar",
              icon: "CalendarDays",
              items: [{ id: "cal-home", label: "View Calendar", href: "/pages/calendar" }],
            },
          ],
        },
        {
          id: "listings",
          label: "Shop Listings",
          groups: [
            {
              id: "products",
              label: "Products",
              icon: "Package",
              items: [
                { id: "p-all", label: "All Products", href: "/pages/products" },
                { id: "p-add", label: "Add Product", href: "/pages/products/new" },
                { id: "p-inv", label: "Inventory", href: "/pages/products/inventory" },
                { id: "p-bundles", label: "Bundles", href: "/pages/products/bundles" },
                { id: "p-cats", label: "Categories", href: "/pages/products/categories" },
              ],
            },
            {
              id: "services",
              label: "Services",
              icon: "ShoppingBasket",
              items: [
                { id: "s-all", label: "All Services", href: "/pages/services" },
                { id: "s-add", label: "Add Service", href: "/pages/services/new" },
                { id: "s-providers", label: "Wellness Providers", href: "/pages/services/providers" },
                { id: "s-spaces", label: "Wellness Spaces", href: "/pages/services/spaces" },
              ],
            },
            {
              id: "discounts",
              label: "Discounts",
              icon: "Tags", // <- correct icon name
              items: [
                { id: "d-store", label: "Store Discounts", href: "/pages/discounts/store" },
                { id: "d-item", label: "Item Discounts", href: "/pages/discounts/item" },
              ],
            },
          ],
        },
        {
          id: "orders-bookings",
          label: "Orders & Bookings",
          groups: [
            {
              id: "orders",
              label: "Orders",
              icon: "Boxes",
              items: [
                { id: "o-all", label: "All Orders", href: "/pages/orders" },
                { id: "o-pending", label: "Pending", href: "/pages/orders/pending", badge: 1 },
                { id: "o-delivery", label: "Delivery Orders", href: "/pages/orders/delivery", badge: 2 },
                { id: "o-pickup", label: "Pickup Orders", href: "/pages/orders/pickup" },
              ],
            },
            {
              id: "bookings",
              label: "Bookings",
              icon: "CalendarDays",
              items: [
                { id: "b-all", label: "All Bookings", href: "/pages/bookings" },
                { id: "b-upcoming", label: "Upcoming", href: "/pages/bookings/upcoming" },
                { id: "b-reschedules", label: "Reschedules", href: "/pages/bookings/reschedules" },
                { id: "b-cancelled", label: "Cancelled", href: "/pages/bookings/cancelled" },
              ],
            },
            {
              id: "customers",
              label: "Customers",
              icon: "Users",
              items: [{ id: "c-all", label: "Customers", href: "/pages/customers" }],
            },
          ],
        },
        {
          id: "finance",
          label: "Finance",
          groups: [
            {
              id: "income",
              label: "Income",
              icon: "PiggyBank",
              items: [
                { id: "i-trans", label: "Transactions", href: "/pages/income/transactions", badge: 1 },
                { id: "i-payouts", label: "Payouts", href: "/pages/income/payouts" },
                { id: "i-reports", label: "Reports", href: "/pages/income/reports" },
              ],
            },
          ],
        },
      ],
    };
  }, [profile]);

  if (loading || !profile || redirectPath) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <p className="text-gray-600">Loading your dashboard…</p>
      </div>
    );
  }

  return (
    <div className="flex">
      <Sidebar config={sidebarConfig} />

      <main className="min-h-screen flex-1 bg-zinc-50 p-10 text-gray-900">
        <h1 className="mb-2 text-3xl font-bold">
          Welcome{profile.full_name ? `, ${profile.full_name}` : ""} 👋
        </h1>
        <p className="mb-8 text-gray-600">
          You’re successfully logged in to the Meuraki Vendor Portal.
        </p>

        <div className="grid gap-6 sm:grid-cols-2">
          <div className="rounded-2xl bg-white p-6 shadow">
            <h2 className="mb-2 font-semibold">Account</h2>
            <div className="text-sm text-gray-600">
              <div>Email: {profile.email ?? "—"}</div>
              <div>
                Status: <span className="uppercase">{profile.status}</span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow">
            <h2 className="mb-2 font-semibold">Getting started</h2>
            <p className="text-sm text-gray-600">
              Explore your vendor tools and manage your listings.
            </p>
          </div>
        </div>

        <button
          onClick={async () => {
            await supabase.auth.signOut();
            router.replace("/pages/auth/login");
          }}
          className="mt-10 rounded-full bg-black px-6 py-3 text-white transition hover:bg-gray-900"
        >
          Sign out
        </button>
      </main>
    </div>
  );
}
