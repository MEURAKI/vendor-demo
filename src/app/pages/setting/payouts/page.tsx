// app/pages/setting/payouts/page.tsx
"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../../lib/supabase/client";
import Sidebar from "../../../../components/sidebar/Sidebar";
import SettingsNav from "../../../../components/settings/SettingsNav";
import { buildSidebarConfig } from "../../../../components/sidebar/sidebar.config";
import { useToast } from "../../../../components/toast/ToastProvider";
import { useAuthGuard } from "../../../../hooks/useAuthGuard";
import ClipLoader from "react-spinners/ClipLoader";

/* ---------- Types ---------- */
type Payout = {
  vendor_id: string;
  bank_name: string | null;
  account_number: string | null;
  account_holder_name: string | null;
  bank_code: string | null;
  branch_code: string | null;
  swift_iban: string | null;
  country: string | null;
  currency: string | null;
  updated_at?: string;
};

type Me = { id: string; email: string | null; full_name: string | null; status: string | null; onboarding_completed: boolean; };

type BillingTab = "payouts" | "plan" | "invoices";

/* ---------- Small shared UI helpers ---------- */

function Field({
  label,
  value,
  onChange,
  placeholder,
  help,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  help?: string;
  required?: boolean;
}) {
  return (
    <div className="grid gap-2">
      <label className="text-sm font-medium text-gray-900">
        {label} {required && <span className="text-rose-500">*</span>}
      </label>
      <input
        className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-gray-900 focus:border-purple-500 focus:ring-purple-500"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      {help && <p className="text-xs text-gray-500">{help}</p>}
    </div>
  );
}

function TwoCols({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">{children}</div>;
}

function TwoColsWrap({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3">{children}</div>;
}

/* ---------- Locked cards for Plan / Invoices ---------- */

function LockedFeature({
  title,
  blurb,
}: {
  title: string;
  blurb: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-purple-200/40 bg-gradient-to-br from-purple-50 via-violet-50 to-white p-10 shadow-sm">
      <div className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-purple-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-fuchsia-400/20 blur-3xl" />

      <div className="mx-auto max-w-2xl text-center">
        <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-purple-600 text-white shadow-lg">
          <svg width="24" height="24" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M7 2h10a1 1 0 0 1 1 1v18l-3-2l-3 2l-3-2l-3 2V3a1 1 0 0 1 1-1m2 4v2h6V6zm0 4v2h6v-2z"
            />
          </svg>
        </div>

        <h2 className="text-2xl font-semibold text-gray-900">{title}</h2>
        <p className="mt-2 text-sm text-gray-600">{blurb}</p>
      </div>
    </div>
  );
}

function LockedInvoicesCard() {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-purple-200/40 bg-gradient-to-br from-violet-50 via-purple-50 to-white p-10 shadow-sm">
      <div className="pointer-events-none absolute -top-24 -right-28 h-64 w-64 rounded-full bg-fuchsia-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-28 -left-20 h-72 w-72 rounded-full bg-purple-500/20 blur-3xl" />

      <div className="mx-auto max-w-2xl text-center">
        <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-purple-600 text-white shadow-lg">
          <svg width="24" height="24" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M7 2h10a1 1 0 0 1 1 1v18l-3-2l-3 2l-3-2l-3 2V3a1 1 0 0 1 1-1m2 4v2h6V6zm0 4v2h6v-2z"
            />
          </svg>
        </div>

        <h2 className="text-2xl font-semibold text-gray-900">
          Invoices &amp; Statements
        </h2>
        <p className="mt-2 text-sm text-gray-600">
          Downloadable invoices and monthly statements are on the way. You’ll be able to
          filter by date range and export in CSV/PDF.
        </p>
      </div>
    </div>
  );
}

/* ======================================================================= */
/*                         INNER PAGE (uses hooks)                        */
/* ======================================================================= */

function BillingSettingsPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const [me, setMe] = useState<Me | null>(null);
  const [payout, setPayout] = useState<Payout>({
    vendor_id: "",
    bank_name: "",
    account_number: "",
    account_holder_name: "",
    bank_code: "",
    branch_code: "",
    swift_iban: "",
    country: "SG",
    currency: "SGD",
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const { successToast, errorToast } = useToast();

  const urlTab = (searchParams.get("tab") as BillingTab) || "payouts";
  const [activeTab, setActiveTab] = useState<BillingTab>(urlTab);

  // keep state in sync with URL
  useEffect(() => {
    setActiveTab(urlTab);
  }, [urlTab]);

  // initial load of user + payout
  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        setLoading(false);
        return;
      }

      const [{ data: profile }, { data: p }] = await Promise.all([
        supabase
          .from("profiles")
          .select("id,email,full_name,status,onboarding_completed")
          .eq("id", auth.user.id)
          .maybeSingle(),
        supabase
          .from("vendor_payout")
          .select("*")
          .eq("vendor_id", auth.user.id)
          .maybeSingle(),
      ]);

      setMe((profile || null) as Me);

      if (p) {
        setPayout({
          vendor_id: p.vendor_id,
          bank_name: p.bank_name ?? "",
          account_number: p.account_number ?? "",
          account_holder_name: p.account_holder_name ?? "",
          bank_code: p.bank_code ?? "",
          branch_code: p.branch_code ?? "",
          swift_iban: p.swift_iban ?? "",
          country: p.country ?? "SG",
          currency: p.currency ?? "SGD",
        });
      } else {
        setPayout((x) => ({ ...x, vendor_id: auth.user!.id }));
      }

      setLoading(false);
    })();
  }, []);

  const sidebarConfig = useMemo(
    () =>
      buildSidebarConfig({
        fullName: me?.full_name || me?.email || "User",
        email: me?.email || "",
        role: "Vendor",
       status: me?.status ?? "active"
      }),
    [me]
  );

  function switchTab(tab: BillingTab) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    router.replace(`${pathname}?${params.toString()}`);
    // state will update via useEffect on urlTab
  }

  async function onSavePayout() {
    if (!payout.vendor_id) return;
    setSaving(true);

    const required = [
      "bank_name",
      "account_number",
      "account_holder_name",
    ] as const;
    const missing = required.filter((k) => !String(payout[k] || "").trim());
    if (missing.length) {
      errorToast({
        title: "Error",
        description: "Please complete required fields: " + missing.join(", "),
      });
      setSaving(false);
      return;
    }

    const { error } = await supabase
      .from("vendor_payout")
      .upsert(
        {
          ...payout,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "vendor_id" }
      );

    setSaving(false);
    if (error) errorToast({ title: "Error", description: error.message });
    else successToast({ title: "Success", description: "Payout details saved." });
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <p className="text-gray-600">Loading payout details…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar config={sidebarConfig} />
      <SettingsNav
        alerts={{
          "/pages/setting/payouts?tab=payouts":
            !payout.bank_name ||
            !payout.account_number ||
            !payout.account_holder_name,
        }}
      />

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl px-8 py-10">
          <h1 className="text-[28px] font-semibold text-gray-900">
            Billing &amp; Payment Settings
          </h1>

          {/* Tabs (top bar) */}
          <div className="mt-6 flex gap-8 border-b border-gray-200 text-sm">
            <button
              type="button"
              onClick={() => switchTab("payouts")}
              className={[
                "pb-3",
                activeTab === "payouts"
                  ? "border-b-2 border-gray-900 font-semibold text-gray-900"
                  : "text-gray-600 hover:text-gray-900",
              ].join(" ")}
            >
              Payout Details
            </button>
            <button
              type="button"
              onClick={() => switchTab("plan")}
              className={[
                "pb-3",
                activeTab === "plan"
                  ? "border-b-2 border-gray-900 font-semibold text-gray-900"
                  : "text-gray-600 hover:text-gray-900",
              ].join(" ")}
            >
              Plans &amp; Subscription
            </button>
            <button
              type="button"
              onClick={() => switchTab("invoices")}
              className={[
                "pb-3",
                activeTab === "invoices"
                  ? "border-b-2 border-gray-900 font-semibold text-gray-900"
                  : "text-gray-600 hover:text-gray-900",
              ].join(" ")}
            >
              Invoices &amp; Statements
            </button>
          </div>

          {/* Shared banner */}
          <div className="mt-6 rounded-full border border-black/10 bg-black px-4 py-2 text-sm font-medium text-white shadow">
            You cannot publish products, list services, or receive payouts until your
            business is verified.
          </div>

          {/* CONTENT PER TAB */}
          {activeTab === "payouts" && (
            <form
              className="mt-8 space-y-10 pb-28"
              onSubmit={(e) => {
                e.preventDefault();
                onSavePayout();
              }}
            >
              <p className="text-[13px] font-medium text-purple-600">
                Please ensure your bank details match your verified company information.
              </p>

              <Field
                label="Bank Name"
                placeholder="e.g. OCBC Bank"
                value={payout.bank_name || ""}
                onChange={(v) => setPayout((x) => ({ ...x, bank_name: v }))}
                required
              />

              <Field
                label="Account Number"
                placeholder="000000000000"
                value={payout.account_number || ""}
                onChange={(v) => setPayout((x) => ({ ...x, account_number: v }))}
                required
              />

              <Field
                label="Account Holder Name"
                placeholder="e.g. Wellness Club Co."
                value={payout.account_holder_name || ""}
                onChange={(v) =>
                  setPayout((x) => ({ ...x, account_holder_name: v }))
                }
                help="Name must match your verified business / brand."
                required
              />

              <TwoCols>
                <Field
                  label="Bank Code"
                  placeholder="e.g. 7339"
                  value={payout.bank_code || ""}
                  onChange={(v) => setPayout((x) => ({ ...x, bank_code: v }))}
                />
                <Field
                  label="Branch Code"
                  placeholder="e.g. 604"
                  value={payout.branch_code || ""}
                  onChange={(v) => setPayout((x) => ({ ...x, branch_code: v }))}
                />
              </TwoCols>

              <TwoCols>
                <Field
                  label="SWIFT / IBAN Code"
                  placeholder="e.g. OCBCSGSG"
                  value={payout.swift_iban || ""}
                  onChange={(v) => setPayout((x) => ({ ...x, swift_iban: v }))}
                  help="Required for international or non-local transfers."
                />
                <TwoColsWrap>
                  <Field
                    label="Country"
                    placeholder="SG"
                    value={payout.country || ""}
                    onChange={(v) => setPayout((x) => ({ ...x, country: v }))}
                  />
                  <Field
                    label="Currency"
                    placeholder="SGD"
                    value={payout.currency || ""}
                    onChange={(v) => setPayout((x) => ({ ...x, currency: v }))}
                  />
                </TwoColsWrap>
              </TwoCols>

              {/* Sticky Save bar */}
              <div className="pointer-events-none fixed bottom-0 left-0 right-0 z-10">
                <div className="mx-auto max-w-5xl px-8 pb-6">
                  <div className="pointer-events-auto flex items-center justify-end gap-3 rounded-full border border-gray-200 bg-white/90 px-3 py-2.5 shadow-sm backdrop-blur">
                    <Link
                      href="/pages/setting/verification"
                      className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      Go back without saving
                    </Link>
                    <button
                      type="submit"
                      disabled={saving}
                      className="rounded-full bg-black px-6 py-2.5 text-sm font-medium text-white hover:bg-gray-900 disabled:opacity-60"
                    >
                      {saving ? "Saving…" : "Save"}
                    </button>
                  </div>
                </div>
              </div>
            </form>
          )}

          {activeTab === "plan" && (
            <div className="mt-8 pb-28">
              <LockedFeature
                title="Plans & Subscription"
                blurb="We’re polishing this experience — pricing tiers, seats, and add-ons will be available soon. Thanks for your patience!"
              />
            </div>
          )}

          {activeTab === "invoices" && (
            <div className="mt-8 pb-28">
              <LockedInvoicesCard />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

/* ======================================================================= */
/*                    OUTER WRAPPER (NO HOOKS HERE)                        */
/* ======================================================================= */

export default function BillingSettingsPage() {

  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-white">
          <p className="text-gray-600">Loading billing settings…</p>
        </div>
      }
    >
      <BillingSettingsPageInner />
    </Suspense>
  );
}