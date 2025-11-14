"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../../../lib/supabase/client";
import Sidebar from "../../../../../components/sidebar/Sidebar";
import SettingsNav from "../../../../../components/settings/SettingsNav";
import { buildSidebarConfig } from "../../../../../components/sidebar/sidebar.config";
import { useToast } from "../../../../../components/toast/ToastProvider";


/* ------------------------------- Types ---------------------------------- */

type VB = {
  id: string; // profiles.id (PK on vendor_business)
  fulfilment_delivery: boolean;
  fulfilment_pickup: boolean;
  delivery_days_standard: string | number | null;
  delivery_rate_standard: string | number | null;
  delivery_days_express: string | number | null;
  delivery_rate_express: string | number | null;
  pickup_address: string | null;
  pickup_postal_code: string | null;
  delivery_days_note: string | null;
};

type ProfileLite = { id: string; email: string | null; full_name: string | null };

/* -------------------------------- Page ---------------------------------- */

export default function FulfilmentPage() {
  const [me, setMe] = useState<ProfileLite | null>(null);
  const [data, setData] = useState<VB | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { successToast, errorToast } = useToast();

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth.user;
      if (!user) return;

      // profile (for sidebar)
      const { data: prof } = await supabase
        .from("profiles")
        .select("id,email,full_name")
        .eq("id", user.id)
        .maybeSingle();
      setMe(prof as ProfileLite);

      // fulfilment from vendor_business (single row keyed by id)
      const { data: vb } = await supabase
        .from("vendor_business")
        .select(
          `
            id,
            fulfilment_delivery,
            fulfilment_pickup,
            delivery_days_standard,
            delivery_rate_standard,
            delivery_days_express,
            delivery_rate_express,
            pickup_address,
            pickup_postal_code,
            delivery_days_note
          `
        )
        .eq("id", user.id)
        .maybeSingle();

      // sensible defaults for first-time vendors
      const defaults: VB = {
        id: user.id,
        fulfilment_delivery: false,
        fulfilment_pickup: false,
        delivery_days_standard: "3 – 5 days",
        delivery_rate_standard: "0.00",
        delivery_days_express: "1 day (Between 5:00pm – 9:00pm)",
        delivery_rate_express: "0.00",
        pickup_address: "",
        pickup_postal_code: "",
        delivery_days_note: "",
      };

      setData({ ...defaults, ...(vb || {}) });
      setLoading(false);
    })();
  }, []);

  const sidebarConfig = useMemo(
    () =>
      buildSidebarConfig({
        fullName: me?.full_name,
        email: me?.email,
        role: "Vendor",
        status: "Incomplete Registration",
      }),
    [me]
  );

  async function onSave() {
    if (!data) return;
    setSaving(true);

    // Upsert into vendor_business (id = profiles.id)
    const payload = {
      id: data.id,
      fulfilment_delivery: !!data.fulfilment_delivery,
      fulfilment_pickup: !!data.fulfilment_pickup,
      delivery_days_standard: data.delivery_days_standard ?? null,
      delivery_rate_standard: data.delivery_rate_standard ?? null,
      delivery_days_express: data.delivery_days_express ?? null,
      delivery_rate_express: data.delivery_rate_express ?? null,
      pickup_address: data.pickup_address ?? null,
      pickup_postal_code: data.pickup_postal_code ?? null,
      delivery_days_note: data.delivery_days_note ?? null,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("vendor_business")
      .upsert(payload, { onConflict: "id" });

    setSaving(false);
    if (error) errorToast({ title: "Error", description: "Failed to save fulfilment details." });
    else successToast({ title: "Success", description: "Fulfilment details saved successfully." });
  }

  if (loading || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <p className="text-gray-600">Loading fulfilment settings…</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#F7F7FB]">
      <Sidebar config={sidebarConfig} />
      <SettingsNav />

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl px-8 py-10">
          <h1 className="text-[28px] font-semibold text-gray-900">Shop Settings</h1>

          {/* Tabs */}
          <div className="mt-6 flex gap-8 border-b border-gray-200 text-sm">
            <a href="/pages/setting/shop" className="pb-3 text-gray-600 hover:text-gray-900">
              General
            </a>
            <span className="pb-3 font-semibold text-gray-900 border-b-2 border-gray-900">
              Fulfilment &amp; Delivery
            </span>
          </div>

          {/* Banner */}
          <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-black px-4 py-2 text-sm text-white">
            <span className="inline-block h-2 w-2 rounded-full bg-purple-400" />
            You cannot publish products, list services, or receive payouts until your business is verified.
          </div>

          <form
            className="mt-8 space-y-12 pb-28"
            onSubmit={(e) => {
              e.preventDefault();
              onSave();
            }}
          >
            {/* Fulfilment method */}
            <section className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <div className="text-sm font-semibold text-gray-900">Fulfilment Method</div>
                <p className="mt-1 text-xs text-gray-500">How vendor delivers products/services.</p>
              </div>
              <div className="flex gap-6">
                <label className="flex items-center gap-2 text-sm text-gray-800">
                  <input
                    type="checkbox"
                    checked={!!data.fulfilment_delivery}
                    onChange={(e) =>
                      setData((d) => d && { ...d, fulfilment_delivery: e.target.checked })
                    }
                    className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                  />
                  Delivery
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-800">
                  <input
                    type="checkbox"
                    checked={!!data.fulfilment_pickup}
                    onChange={(e) =>
                      setData((d) => d && { ...d, fulfilment_pickup: e.target.checked })
                    }
                    className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                  />
                  Pickup
                </label>
              </div>
            </section>
            <div className="border-t border-gray-200" />

            {/* Shipping profiles */}
            <section className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <div className="text-sm font-semibold text-gray-900">Shipping Profile & Pricing</div>
                <p className="mt-1 text-xs text-gray-500">Standard and express delivery options.</p>
              </div>
              <div className="space-y-5">
                {/* Standard */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-900">
                    Standard Delivery
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-gray-900"
                      value={String(data.delivery_days_standard ?? "")}
                      onChange={(e) =>
                        setData((d) => d && { ...d, delivery_days_standard: e.target.value })
                      }
                      placeholder="3 – 5 days"
                    />
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-gray-900"
                      value={String(data.delivery_rate_standard ?? "")}
                      onChange={(e) =>
                        setData((d) => d && { ...d, delivery_rate_standard: e.target.value })
                      }
                      placeholder="$20.00"
                    />
                  </div>
                </div>

                {/* Express */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-900">
                    Express Delivery
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-gray-900"
                      value={String(data.delivery_days_express ?? "")}
                      onChange={(e) =>
                        setData((d) => d && { ...d, delivery_days_express: e.target.value })
                      }
                      placeholder="1 day (Between 5:00pm – 9:00pm)"
                    />
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-gray-900"
                      value={String(data.delivery_rate_express ?? "")}
                      onChange={(e) =>
                        setData((d) => d && { ...d, delivery_rate_express: e.target.value })
                      }
                      placeholder="$30.00"
                    />
                  </div>
                </div>
              </div>
            </section>
            <div className="border-t border-gray-200" />

            {/* Pickup address */}
            <section className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <div className="text-sm font-semibold text-gray-900">Pickup Address</div>
                <p className="mt-1 text-xs text-gray-500">
                  Your store address is your pickup address. However, if you have a warehouse,
                  provide that instead.
                </p>
              </div>
              <div className="space-y-3">
                <input
                  className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-gray-900"
                  value={data.pickup_address ?? ""}
                  onChange={(e) =>
                    setData((d) => d && { ...d, pickup_address: e.target.value })
                  }
                  placeholder="56 Tanglin Road, 01-03 Singapore 247964"
                />
                <input
                  className="h-11 w-40 rounded-xl border border-gray-200 bg-white px-3 text-gray-900"
                  value={data.pickup_postal_code ?? ""}
                  onChange={(e) =>
                    setData((d) => d && { ...d, pickup_postal_code: e.target.value })
                  }
                  placeholder="247964"
                />
              </div>
            </section>
            <div className="border-t border-gray-200" />

            {/* Delivery days note */}
            <section className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <div className="text-sm font-semibold text-gray-900">Delivery Days</div>
                <p className="mt-1 text-xs text-gray-500">Days available for delivery.</p>
              </div>
              <input
                className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-gray-900"
                value={data.delivery_days_note ?? ""}
                onChange={(e) =>
                  setData((d) => d && { ...d, delivery_days_note: e.target.value })
                }
                placeholder="e.g. Monday – Fridays | 9:00am to 5:00pm"
              />
            </section>

            {/* Sticky save bar */}
            <div className="fixed bottom-0 left-0 right-0 z-10 ml-[calc(300px+280px)] bg-transparent">
              <div className="mx-auto max-w-5xl px-8 pb-6">
                <div className="pointer-events-auto flex items-center justify-end gap-3 rounded-full border border-gray-200 bg-white/90 px-3 py-2.5 shadow-sm backdrop-blur">
                  <a
                    href="/pages/setting/shop"
                    className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    Go back without saving
                  </a>
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