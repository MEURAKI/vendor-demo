"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../../lib/supabase/client";
import Sidebar from "../../../../components/sidebar/Sidebar";
import SettingsNav from "../../../../components/settings/SettingsNav";
import { buildSidebarConfig } from "../../../../components/sidebar/sidebar.config";
import Link from "next/link";

function LockedCard() {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-purple-200/40 bg-gradient-to-br from-violet-50 via-purple-50 to-white p-10 shadow-sm">
      <div className="pointer-events-none absolute -top-24 -right-28 h-64 w-64 rounded-full bg-fuchsia-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-28 -left-20 h-72 w-72 rounded-full bg-purple-500/20 blur-3xl" />

      <div className="mx-auto max-w-2xl text-center">
        <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-purple-600 text-white shadow-lg">
          {/* receipt icon */}
          <svg width="24" height="24" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M7 2h10a1 1 0 0 1 1 1v18l-3-2l-3 2l-3-2l-3 2V3a1 1 0 0 1 1-1m2 4v2h6V6zm0 4v2h6v-2z"
            />
          </svg>
        </div>

        <h2 className="text-2xl font-semibold text-gray-900">Invoices &amp; Statements</h2>
        <p className="mt-2 text-sm text-gray-600">
          Downloadable invoices and monthly statements are on the way. You’ll be able to filter by date
          range and export in CSV/PDF.
        </p>

        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            disabled
            className="cursor-not-allowed rounded-full bg-purple-600 px-6 py-2.5 text-sm font-medium text-white opacity-70"
          >
            Under Development
          </button>
          <Link
            href="/pages/setting/payouts"
            className="rounded-full border border-purple-200 bg-white px-5 py-2.5 text-sm text-purple-700 hover:bg-purple-50"
          >
            Go to Payout Details
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function InvoicesLockedPage() {
  const [me, setMe] = useState<{ id: string; email: string | null; full_name: string | null } | null>(null);

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      const { data } = await supabase
        .from("profiles")
        .select("id,email,full_name")
        .eq("id", auth.user.id)
        .maybeSingle();
      setMe(data || null);
    })();
  }, []);

  const sidebarConfig = useMemo(
    () =>
      buildSidebarConfig({
        fullName: me?.full_name || me?.email || "User",
        email: me?.email || "",
        role: "Vendor",
        status: "Incomplete Registration",
      }),
    [me]
  );

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar config={sidebarConfig} />
      <SettingsNav />

      <main className="flex-1">
        <div className="mx-auto max-w-5xl px-8 py-10">
          <h1 className="text-[28px] font-semibold text-gray-900">Billing &amp; Payment Settings</h1>

          {/* Tabs */}
          <div className="mt-6 flex gap-8 border-b border-gray-200 text-sm">
            <Link href="/pages/setting/payouts" className="pb-3 text-gray-600 hover:text-gray-900">
              Payout Details
            </Link>
            <Link href="/pages/setting/plan" className="pb-3 text-gray-600 hover:text-gray-900">
              Plans &amp; Subscription
            </Link>
            <span className="border-b-2 border-gray-900 pb-3 font-semibold text-gray-900">
              Invoices &amp; Statements
            </span>
          </div>

          <div className="mt-8">
            <LockedCard />
          </div>
        </div>
      </main>
    </div>
  );
}