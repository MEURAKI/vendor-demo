"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../../lib/supabase/client";
import Sidebar from "../../../../components/sidebar/Sidebar";
import SettingsNav from "../../../../components/settings/SettingsNav";
import { buildSidebarConfig } from "../../../../components/sidebar/sidebar.config";
import Link from "next/link";
import { useToast } from "../../../../components/toast/ToastProvider";

/* ---------- Types (adjust to your table) ---------- */
type Payout = {
  vendor_id: string;
  bank_name: string | null;
  account_number: string | null;
  account_holder_name: string | null;
  bank_code: string | null;     // e.g. clearing code
  branch_code: string | null;   // e.g. 3-digit
  swift_iban: string | null;    // SWIFT / IBAN
  country: string | null;       // optional
  currency: string | null;      // optional
  updated_at?: string;
};

export default function PayoutDetailsPage() {
  const [me, setMe] = useState<{ id: string; email: string | null; full_name: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { successToast, errorToast } = useToast();

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

  /* ---------- Load user + payout ---------- */
  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;

      const [{ data: profile }, { data: p }] = await Promise.all([
        supabase.from("profiles").select("id,email,full_name").eq("id", auth.user.id).maybeSingle(),
        supabase.from("vendor_payout").select("*").eq("vendor_id", auth.user.id).maybeSingle(),
      ]);

      setMe(profile || null);

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

  /* ---------- Sidebar card ---------- */
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

  /* ---------- Save ---------- */
  async function onSave() {
    if (!payout.vendor_id) return;
    setSaving(true);

    // Simple required fields check
    const required = ["bank_name", "account_number", "account_holder_name"] as const;
    const missing = required.filter((k) => !String(payout[k] || "").trim());
    if (missing.length) {
      errorToast({ title: "Error", description: "Please complete required fields: " + missing.join(", ") });
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
      {/* Left rails */}
      <Sidebar config={sidebarConfig} />
      <SettingsNav
        alerts={{
          // show a red dot on Payouts if any key fields missing
          "/pages/setting/payouts":
            !payout.bank_name || !payout.account_number || !payout.account_holder_name,
        }}
      />

      {/* Main */}
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl px-8 py-10">
          <h1 className="text-[28px] font-semibold text-gray-900">Billing &amp; Payment Settings</h1>

          {/* Tabs */}
          <div className="mt-6 flex gap-8 border-b border-gray-200 text-sm">
            <span className="border-b-2 border-gray-900 pb-3 font-semibold text-gray-900">Payout Details</span>
            <Link href="/pages/setting/plan" className="pb-3 text-gray-600 hover:text-gray-900">
              Plans &amp; Subscription
            </Link>
            <Link href="/pages/setting/invoices" className="pb-3 text-gray-600 hover:text-gray-900">
              Invoices &amp; Statements
            </Link>
          </div>

          {/* Banner */}
          <div className="mt-6 rounded-full border border-black/10 bg-black px-4 py-2 text-sm font-medium text-white shadow">
            You cannot publish products, list services, or receive payouts until your business is verified.
          </div>

          {/* Form */}
          <form
            className="mt-8 space-y-10 pb-28"
            onSubmit={(e) => {
              e.preventDefault();
              onSave();
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
              onChange={(v) => setPayout((x) => ({ ...x, account_holder_name: v }))}
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
        </div>
      </main>
    </div>
  );
}

/* ---------- Small UI helpers ---------- */

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