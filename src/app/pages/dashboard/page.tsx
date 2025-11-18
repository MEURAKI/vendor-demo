"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "../../../components/sidebar/Sidebar";
import type { SidebarConfig } from "../../../components/sidebar/sidebar.config";
import { supabase } from "../../../lib/supabase/client";
import ClipLoader from "react-spinners/ClipLoader";
import Link from "next/link";


/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */

type UserStatus =
  | "pending_admin_approval"
  | "approved"
  | "active"
  | "rejected"
  | "suspended"
  | "incomplete_registration";

type Profile = {
  id: string;
  email: string | null;
  status: UserStatus;
  onboarding_completed: boolean;
  full_name: string | null;
  email_verified: boolean;
};

type Stats = {
  products: number;
  services: number;
  listings: number;
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

/* ------------------------------------------------------------------ */
/* Page                                                               */
/* ------------------------------------------------------------------ */

export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);

  const redirectPath = useMemo(() => {
    if (!profile) return null;

    // 1) Email not verified → pending screen
    if (!profile.email_verified) {
      return "/pages/auth/pending";
    }

    // 2) Verified but onboarding not completed → onboarding flow
    if (
      profile.status === "incomplete_registration" &&
      !profile.onboarding_completed
    ) {
      return "/pages/onboarding/start";
    }

    // 3) Otherwise, they can stay on dashboard
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

      // Load profile
      const { data: prof, error } = await supabase
        .from("profiles")
        .select(
          "id, email, status, onboarding_completed, full_name, email_verified"
        )
        .eq("id", user.id)
        .single();

      if (error) {
        console.error("Error loading profile:", error);
      } else {
        setProfile(prof as Profile);
      }

      // Subscribe to profile changes
      const channel = supabase
        .channel(`profiles:${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "profiles",
            filter: `id=eq.${user.id}`,
          },
          (payload) => setProfile(payload.new as Profile)
        )
        .subscribe();

      unsub = () => supabase.removeChannel(channel);

      // Load simple stats (adjust table/filters to your schema)
      try {
        const [{ count: productsCount }, { count: servicesCount }] =
          await Promise.all([
            supabase
              .from("products")
              .select("*", { count: "exact", head: true })
              .eq("vendor_id", user.id),
            supabase
              .from("services")
              .select("*", { count: "exact", head: true })
              .eq("vendor_id", user.id),
          ]);

        setStats({
          products: productsCount ?? 0,
          services: servicesCount ?? 0,
          listings: (productsCount ?? 0) + (servicesCount ?? 0),
        });
      } catch (e) {
        console.error("Error loading stats:", e);
        setStats({ products: 0, services: 0, listings: 0 });
      }

      setLoading(false);
    })();

    return () => unsub?.();
  }, [router]);

  useEffect(() => {
    if (!loading && redirectPath) {
      router.replace(redirectPath);
    }
  }, [loading, redirectPath, router]);

  const sidebarConfig: SidebarConfig | null = useMemo(() => {
    if (!profile) return null;
    const displayName = profile.full_name || profile.email || "User";

    return {
      profile: {
        initials: getInitials(profile.full_name || profile.email),
        name: displayName,
        role: "Vendor",
       status: profile?.status ?? "active"
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
              items: [
                {
                  id: "dash-home",
                  label: "Home",
                  href: "/pages/dashboard",
                },
              ],
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
          ],
        },
      ],
    };
  }, [profile]);

  // Loader
  if (loading || !profile || redirectPath || !sidebarConfig) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <ClipLoader size={55} color="#6B46C1" />
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

        {/* Simple stats row */}
        <div className="mb-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl bg-white p-5 shadow-sm border border-gray-100">
            <p className="text-sm text-gray-500">Products</p>
            <p className="mt-2 text-2xl font-semibold">
              {stats?.products ?? 0}
            </p>
            <p className="mt-1 text-xs text-gray-400">
              Total products in your catalog
            </p>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm border border-gray-100">
            <p className="text-sm text-gray-500">Services</p>
            <p className="mt-2 text-2xl font-semibold">
              {stats?.services ?? 0}
            </p>
            <p className="mt-1 text-xs text-gray-400">
              Active wellness services & sessions
            </p>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm border border-gray-100">
            <p className="text-sm text-gray-500">Total Listings</p>
            <p className="mt-2 text-2xl font-semibold">
              {stats?.listings ?? 0}
            </p>
            <p className="mt-1 text-xs text-gray-400">
              Combined products & services
            </p>
          </div>
        </div>

        {/* Simple “getting started” + account info */}
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100">
            <h2 className="mb-2 font-semibold">Account</h2>
            <div className="text-sm text-gray-600 space-y-1">
              <div>Email: {profile.email ?? "—"}</div>
              <div>
                Status:{" "}
                <span className="uppercase tracking-wide text-xs">
                  {profile.status}
                </span>
              </div>
              <div>
                Email verified:{" "}
                <span className={profile.email_verified ? "text-green-600" : "text-red-500"}>
                  {profile.email_verified ? "Yes" : "No"}
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100">
            <h2 className="mb-2 font-semibold">Getting started</h2>
            <p className="text-sm text-gray-600 mb-3">
              Complete your business profile and start adding products and
              services to your shop.
            </p>
            <div className="flex flex-wrap gap-2 text-sm">
              <Link
                href="/pages/setting/business"
                className="rounded-full bg-black px-4 py-2 text-white hover:bg-gray-900"
              >
                Business setup
              </Link>
              <Link
                href="/pages/products/new"
                className="rounded-full border border-gray-300 px-4 py-2 text-gray-800 hover:bg-gray-50"
              >
                Add a product
              </Link>
              <Link
                href="/pages/services/new"
                className="rounded-full border border-gray-300 px-4 py-2 text-gray-800 hover:bg-gray-50"
              >
                Add a service
              </Link>
            </div>
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