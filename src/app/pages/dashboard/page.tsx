"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  CalendarDays,
  Package,
  Tags,
  ShoppingBasket,
  Users,
  PiggyBank,
} from "lucide-react";
import { supabase } from "../../../lib/supabase/client";

/* ---------- Sidebar (inline + reusable) ---------- */

const ICONS = {
  BarChart3,
  CalendarDays,
  Package,
  Tags,
  ShoppingBasket,
  Users,
  PiggyBank,
};
type IconName = keyof typeof ICONS;

type SidebarItem = {
  id: string;
  label: string;
  href: string;
  icon?: IconName;
};

type SidebarSection = {
  id: string;
  label: string;
  items: SidebarItem[];
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

function Sidebar({ config }: { config: SidebarConfig }) {
  return (
    <aside className="w-[300px] shrink-0 bg-ink-800 text-neu-200 shadow-panel rounded-2xl p-16 pb-8
                      border border-ink-line">
      {/* Profile */}
      <div className="mb-5">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-accent-600 text-white grid place-items-center
                          text-sm font-semibold">
            {config.profile.initials}
          </div>
          <div className="leading-tight">
            <div className="font-semibold text-neu-50">{config.profile.name}</div>
            <div className="text-xs text-neu-500 uppercase tracking-wide">{config.profile.role}</div>
          </div>
        </div>

        {/* Status pill: Incomplete Registration */}
        <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-[#2A1212] text-danger
                        px-3 py-1 text-xs font-medium border border-danger/20">
          <span className="inline-block h-2 w-2 rounded-full bg-danger" />
          Incomplete Registration
        </div>

        {/* Purple CTA card */}
        <div className="mt-4 rounded-2xl p-4 text-neu-50
                        bg-gradient-to-b from-accent-500 to-accent-600">
          <div className="font-semibold leading-snug">Complete Your{" "}
            <br/>Business Setup</div>
          <p className="mt-2 text-[13px] text-white/80">
            Fill out the onboarding form with your business details to activate your shop.
          </p>
          <button
            className="mt-3 inline-flex items-center rounded-full bg-black/80 hover:bg-black
                       text-white text-sm px-4 py-2 transition">
            Open Form
          </button>
        </div>
      </div>

      {/* Sections */}
      <nav className="pt-2">
        {config.sections.map((section) => (
          <div key={section.id} className="mb-3">
            <div className="px-2 mb-2 text-[11px] font-semibold uppercase tracking-wider text-neu-600">
              {section.label}
            </div>

            <ul className="space-y-1.5">
              {section.items.map((item) => {
                const Icon = item.icon ? ICONS[item.icon] : undefined;
                const active = false; // wire with router
                return (
                  <li key={item.id}>
                    <Link
                      href={item.href}
                      className={[
                        "flex items-center gap-3 rounded-xl px-3 py-2.5 border",
                        active
                          ? "bg-accent-600/10 border-accent-600/30 text-neu-50"
                          : "bg-transparent border-transparent hover:bg-ink-700 text-neu-200 hover:text-neu-50",
                      ].join(" ")}
                    >
                      {Icon ? (
                        <Icon className={active ? "h-4 w-4 text-accent-400"
                                                : "h-4 w-4 text-neu-500"} />
                      ) : null}
                      <span className="text-[14px]">{item.label}</span>
                      {/* Right chevron for expandable groups – optional */}
                      {/* <ChevronDown className="ml-auto h-4 w-4 text-neu-600" /> */}
                    </Link>
                  </li>
                );
              })}
            </ul>

            {/* Divider */}
            <div className="my-4 h-px bg-ink-line" />
          </div>
        ))}

        {/* Settings & Help */}
        <div className="space-y-1.5">
          <Link href="/settings"
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-ink-700 text-neu-200">
            <span className="h-4 w-4 rounded border border-neu-600" />
            <span>Settings</span>
          </Link>

          <Link href="/help"
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-ink-700 text-neu-200">
            <span className="h-4 w-4 rounded-full border border-neu-600" />
            <span>Help</span>
          </Link>
        </div>

        {/* Logout */}
        <button
          className="mt-6 inline-flex items-center gap-2 text-accent-400 hover:text-accent-300
                     px-3 py-2 rounded-lg"
        >
          <span className="h-4 w-4 rounded-sm border border-accent-400" />
          Logout Account
        </button>
      </nav>
    </aside>
  );
}


/* ---------- Dashboard page (client) ---------- */

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
  const name = nameOrEmail.includes("@")
    ? nameOrEmail.split("@")[0]
    : nameOrEmail;
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);

  // Determine redirect
  const redirectPath = useMemo(() => {
    if (!profile) return null;
    if (profile.status === "pending_admin_approval") return "/pages/auth/pending";
    if (profile.status === "approved" && !profile.onboarding_completed)
      return "/pages/onboarding/start";
    return null;
  }, [profile]);

  // Load user + profile and subscribe
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

  // Perform redirect when needed
  useEffect(() => {
    if (!loading && redirectPath) router.replace(redirectPath);
  }, [loading, redirectPath, router]);

  // Build sidebar config from profile (after load)
  const sidebarConfig = useMemo<SidebarConfig>(() => {
    const displayName = profile?.full_name || profile?.email || "User";
    return {
      profile: {
        initials: getInitials(profile?.full_name || profile?.email),
        name: displayName,
        role: "Vendor", // or map from your roles table/claims
        status: profile?.status ?? "active",
      },
      sections: [
        {
          id: "quick",
          label: "Overview",
          items: [
            { id: "dashboard", label: "Dashboard", href: "/pages/dashboard", icon: "BarChart3" },
            { id: "calendar", label: "Calendar", href: "/pages/calendar", icon: "CalendarDays" },
          ],
        },
        {
          id: "listings",
          label: "Shop Listings",
          items: [
            { id: "products", label: "Products", href: "/pages/products", icon: "Package" },
            { id: "services", label: "Services", href: "/pages/services", icon: "ShoppingBasket" },
            { id: "discounts", label: "Discounts", href: "/pages/discounts", icon: "Tags" },
          ],
        },
        {
          id: "orders",
          label: "Orders & Bookings",
          items: [
            { id: "orders", label: "Orders", href: "/pages/orders", icon: "ShoppingBasket" },
            { id: "bookings", label: "Bookings", href: "/pages/bookings", icon: "CalendarDays" },
            { id: "customers", label: "Customers", href: "/pages/customers", icon: "Users" },
          ],
        },
        {
          id: "finance",
          label: "Finance",
          items: [{ id: "income", label: "Income", href: "/pages/income", icon: "PiggyBank" }],
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
