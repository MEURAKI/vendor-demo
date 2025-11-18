// app/pages/setting/verification/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../../lib/supabase/client";
import Sidebar from "../../../../components/sidebar/Sidebar";
import SettingsNav from "../../../../components/settings/SettingsNav";
import { buildSidebarConfig } from "../../../../components/sidebar/sidebar.config";
import Link from "next/link";

type DocKind = "vendor_agreement" | "uen_acra" | "product_certificate" | "service_certificate";
type DocRow = {
  kind: DocKind;
  status: "pending" | "approved" | "rejected";
};

type Business = {
  vendor_id: string;
  logo_url: string | null;
  policy_url: string | null; // ← you said we moved policy here
};

type Payout = {
  vendor_id: string;
  account_number?: string | null; // or your own bank fields
  account_holder_name?: string | null;
};

export default function VerificationStatusPage() {
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<{ id: string; email: string | null; full_name: string | null; status: string | null; onboarding_completed: boolean } | null>(null);
  const [biz, setBiz] = useState<Business | null>(null);
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [payout, setPayout] = useState<Payout | null>(null);

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;

      const [{ data: profile }, { data: business }, { data: drows }, { data: p }] = await Promise.all([
        supabase.from("profiles").select("id,email,full_name").eq("id", auth.user.id).maybeSingle(),
        supabase.from("vendor_business").select("vendor_id,logo_url,policy_url").eq("vendor_id", auth.user.id).maybeSingle(),
        supabase.from("vendor_docs").select("kind,status").eq("vendor_id", auth.user.id),
        supabase.from("vendor_payout").select("*").eq("vendor_id", auth.user.id).maybeSingle(),
      ]);

      setMe((profile || null) as any);
      setBiz((business || null) as any);
      setDocs((drows || []) as any);
      setPayout((p || null) as any);
      setLoading(false);
    })();
  }, []);

  const completeness = useMemo(() => {
    const hasLogo = !!biz?.logo_url;
    const hasPolicy = !!biz?.policy_url;

    const hasAnyCert =
      docs.filter((d) => d.kind === "product_certificate" || d.kind === "service_certificate").length > 0;

    const hasPayout =
      !!payout?.account_number || !!payout?.account_holder_name; 

    const missing = {
      logo: !hasLogo,
      policy: !hasPolicy,
      certificates: !hasAnyCert,
      payout: !hasPayout,
    };

    const overallIncomplete = Object.values(missing).some(Boolean);

    const navAlerts = {
      "/pages/setting/business": missing.logo, // business info -> logo lives here
      "/pages/setting/brand": false, // add a real rule if you want (e.g., empty short_story)
      "/pages/setting/docs": missing.policy || missing.certificates,
      "/pages/setting/verification": overallIncomplete,
      "/pages/setting/payouts": missing.payout,
    };

    return { missing, overallIncomplete, navAlerts };
  }, [biz, docs, payout]);

  const sidebarConfig = useMemo(
    () =>
      buildSidebarConfig({
        fullName: me?.full_name || me?.email || "User",
        email: me?.email || "",
        role: "Vendor",
        status: me?.status ?? (completeness.overallIncomplete ? "Incomplete Registration" : "Active"),
      }),
    [me, completeness.overallIncomplete]
  );

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <p className="text-gray-600">Loading…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar config={sidebarConfig} />
      <SettingsNav alerts={completeness.navAlerts} />

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl px-8 py-10">
          <h1 className="text-[28px] font-semibold text-gray-900">Verification Status</h1>

          {/* Top tabs (read-only) */}
          <div className="mt-6 flex gap-8 border-b border-gray-200 text-sm">
            <Link href="/pages/setting/business" className="pb-3 text-gray-600 hover:text-gray-900">
              Business Information
            </Link>
            <Link href="/pages/setting/brand" className="pb-3 text-gray-600 hover:text-gray-900">
              Brand Story &amp; Offerings
            </Link>
            <Link href="/pages/setting/docs" className="pb-3 text-gray-600 hover:text-gray-900">
              Documents &amp; Agreements
            </Link>
            <span className="border-b-2 border-gray-900 pb-3 font-semibold text-gray-900">Verification Status</span>
          </div>

          {/* Account status card */}
          <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <div className="text-[15px] font-semibold text-gray-900">Account Status</div>
              {completeness.overallIncomplete ? (
                <span className="inline-flex items-center gap-2 rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700">
                  ● Incomplete Registration
                </span>
              ) : (
                <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                  ● Complete
                </span>
              )}
            </div>

            {completeness.overallIncomplete && (
              <div className="mt-4 rounded-xl bg-black px-4 py-2 text-sm font-medium text-white">
                Some required details are missing
              </div>
            )}
          </div>

          {/* Missing checklist */}
          <div className="mt-6 divide-y divide-gray-200 overflow-hidden rounded-2xl border border-gray-200 bg-white">
            <Row
              label="Business Logo"
              missing={completeness.missing.logo}
              href="/pages/setting/business"
              cta="Go to Business Information"
            />
            <Row
              label="Refund Policy link"
              missing={completeness.missing.policy}
              href="/pages/setting/docs"
              cta="Go to Documents & Agreements"
            />
            <Row
              label="Upload Business Certificates"
              missing={completeness.missing.certificates}
              href="/pages/setting/docs"
              cta="Go to Business Settings"
            />
            <Row
              label="Payout Details"
              missing={completeness.missing.payout}
              href="/pages/setting/payouts"
              cta="Go to Payout Details"
            />
          </div>
        </div>
      </main>
    </div>
  );
}

function Row({
  label,
  missing,
  href,
  cta,
}: {
  label: string;
  missing: boolean;
  href: string;
  cta: string;
}) {
  return (
    <div className="flex items-center gap-4 px-5 py-4">
      {/* red dot */}
      <span
        className={[
          "inline-block h-2 w-2 rounded-full",
          missing ? "bg-rose-500" : "bg-emerald-500",
        ].join(" ")}
      />
      <div className="flex-1 text-sm text-gray-900">{label}</div>
      <Link
        href={href}
        className="text-sm font-medium text-gray-700 underline-offset-2 hover:underline"
      >
        {cta}
      </Link>
    </div>
  );
}