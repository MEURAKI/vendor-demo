"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../../lib/supabase/client";
import Sidebar from "../../../../components/sidebar/Sidebar";
import SettingsNav from "../../../../components/settings/SettingsNav";
import { buildSidebarConfig } from "../../../../components/sidebar/sidebar.config";
import { useToast } from "../../../../components/toast/ToastProvider";


type Shop = {
  id: string;
  shop_status: boolean;
  shop_name: string;
  shop_slug: string;
  business_category: string;
  shop_bio: string;
  contact_email: string;
  phone_country_code: string;
  phone_number: string;
  frame_id: string | null;
  commission_type: string | null;
  commission_rate: number | null;
};

export default function ShopGeneralPage() {
  const [me, setMe] = useState<{ id: string; email: string | null; full_name: string | null } | null>(null);
  const [shop, setShop] = useState<Shop | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [bioCount, setBioCount] = useState(0);
  const { successToast, errorToast } = useToast();

  // Fetch profile + shop row (create empty defaults if missing)
  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth.user;
      if (!user) return;

      const { data: prof } = await supabase
        .from("profiles")
        .select("id,email,full_name")
        .eq("id", user.id)
        .maybeSingle();

      setMe(prof as any);

      const { data: s } = await supabase
        .from("vendor_business")
        .select(
          "id, shop_status, shop_name, shop_slug, business_category, shop_bio, contact_email, phone_country_code, phone_number, frame_id, commission_type, commission_rate"
        )
        .eq("id", user.id)
        .maybeSingle();

      const defaults: Shop = {
        id: user.id,
        shop_status: false,
        shop_name: "",
        shop_slug: "",
        business_category: "",
        shop_bio: "",
        contact_email: prof?.email ?? "",
        phone_country_code: "+65",
        phone_number: "",
        frame_id: null,
        commission_type: null,
        commission_rate: null,
      };

      const merged = { ...(defaults as any), ...(s || {}) } as Shop;
      setShop(merged);
      setBioCount(merged.shop_bio?.length || 0);
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
    if (!shop) return;
    setSaving(true);

    const payload = {
      id: shop.id,
      shop_status: shop.shop_status,
      shop_name: (shop.shop_name || "").trim(),
      shop_slug: (shop.shop_slug || "").replace(/[^a-z0-9-]/gi, "").toLowerCase(),
      business_category: (shop.business_category || "").trim(),
      shop_bio: (shop.shop_bio || "").slice(0, 200),
      contact_email: (shop.contact_email || "").trim(),
      phone_country_code	: shop.phone_country_code	|| "+65",
      phone_number: (shop.phone_number || "").trim(),
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("vendor_business")
      .upsert(payload, { onConflict: "id" });

    setSaving(false);
    if (error) errorToast({ title: "Error", description: error.message });
    else successToast({ title: "Success", description: "Shop settings saved." });
  }

  if (loading || !shop) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <p className="text-gray-600">Loading shop settings…</p>
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
            <span className="pb-3 font-semibold text-gray-900 border-b-2 border-gray-900">General</span>
            <a href="/pages/setting/shop/fulfilment" className="pb-3 text-gray-600 hover:text-gray-900">
              Fulfilment &amp; Delivery
            </a>
          </div>

          {/* Banner */}
          <div className="mt-6 rounded-full bg-black text-white text-sm px-4 py-2 inline-flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-purple-400" />
            You cannot publish products, list services, or receive payouts until your business is verified.
          </div>

          {/* Form */}
          <form
            className="mt-8 space-y-12 pb-28"
            onSubmit={(e) => {
              e.preventDefault();
              onSave();
            }}
          >
            {/* Shop Status */}
            <section className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <div className="text-sm font-semibold text-gray-900">Shop Status</div>
                <p className="mt-1 text-xs text-gray-500">
                  Toggle ON to go live, or OFF to hide your shop from the marketplace.
                </p>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3">
                <div className="text-sm text-gray-700">{shop.shop_status ? "Live" : "Hidden"}</div>
                <button
                  type="button"
                  onClick={() => setShop({ ...shop, shop_status: !shop.shop_status })}
                  className={[
                    "relative h-6 w-11 rounded-full transition",
                    shop.shop_status ? "bg-purple-600" : "bg-gray-300",
                  ].join(" ")}
                  aria-label="Toggle shop status"
                >
                  <span
                    className={[
                      "absolute top-1/2 -translate-y-1/2 h-4 w-4 rounded-full bg-white shadow transition",
                      shop.shop_status ? "right-1" : "left-1",
                    ].join(" ")}
                  />
                </button>
              </div>
            </section>
            <div className="border-t border-gray-200" />

            {/* Name + Handle */}
            <section className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <div className="text-sm font-semibold text-gray-900">Shop Name</div>
                <p className="mt-1 text-xs text-gray-500">
                  Displayed name of vendor’s store.
                </p>
              </div>
              <input
                className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-gray-900 focus:border-purple-500 focus:ring-purple-500"
                value={shop.shop_name}
                onChange={(e) => setShop({ ...shop, shop_name: e.target.value })}
                placeholder="Wellness Club Co."
              />

              <div>
                <div className="text-sm font-semibold text-gray-900">Shop URL / Handle</div>
                <p className="mt-1 text-xs text-gray-500">
                  Custom URL slug (e.g. **/meuraki.com/sg/shop-name**).
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500 select-none">/</span>
                <input
                  className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-gray-900 focus:border-purple-500 focus:ring-purple-500"
                  value={shop.shop_slug}
                  onChange={(e) =>
                    setShop({
                      ...shop,
                      shop_slug: e.target.value.replace(/[^a-z0-9-]/gi, "").toLowerCase(),
                    })
                  }
                  placeholder="custom-handle"
                />
              </div>
            </section>
            <div className="border-t border-gray-200" />

            {/* Category */}
            <section className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <div className="text-sm font-semibold text-gray-900">Business Category</div>
                <p className="mt-1 text-xs text-gray-500">Primary focus area.</p>
              </div>
              <input
                className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-gray-900 focus:border-purple-500 focus:ring-purple-500"
                value={shop.business_category}
                onChange={(e) => setShop({ ...shop, business_category: e.target.value })}
                placeholder="Wellness, Skincare, Nutrition"
              />
            </section>
            <div className="border-t border-gray-200" />

            {/* Short bio */}
            <section className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <div className="text-sm font-semibold text-gray-900">Shop Description / Bio (Short)</div>
                <p className="mt-1 text-xs text-gray-500">About the shop (public-facing).</p>
              </div>
              <div>
                <textarea
                  rows={3}
                  className="w-full rounded-xl border border-gray-200 bg-white p-3 text-gray-900 focus:border-purple-500 focus:ring-purple-500"
                  maxLength={200}
                  value={shop.shop_bio}
                  onChange={(e) => {
                    setShop({ ...shop, shop_bio: e.target.value });
                    setBioCount(e.target.value.length);
                  }}
                  placeholder="Promoting holistic wellbeing…"
                />
                <div className="mt-1 text-right text-xs text-gray-500">{bioCount}/200</div>
              </div>
            </section>
            <div className="border-t border-gray-200" />

            {/* Contact email */}
            <section className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <div className="text-sm font-semibold text-gray-900">Shop Contact Email Address</div>
                <p className="mt-1 text-xs text-gray-500">For customer inquiries.</p>
              </div>
              <input
                type="email"
                className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-gray-900 focus:border-purple-500 focus:ring-purple-500"
                value={shop.contact_email}
                onChange={(e) => setShop({ ...shop, contact_email: e.target.value })}
                placeholder="e.g. janedoe@gmail.com"
              />
            </section>
            <div className="border-t border-gray-200" />

            {/* Contact phone */}
            <section className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <div className="text-sm font-semibold text-gray-900">Shop Contact Phone Number</div>
                <p className="mt-1 text-xs text-gray-500">For customer inquiries.</p>
              </div>
              <div className="flex gap-2">
                <input
                  className="h-11 w-24 rounded-xl border border-gray-200 bg-white px-3 text-gray-900 focus:border-purple-500 focus:ring-purple-500"
                  value={shop.phone_country_code	}
                  onChange={(e) => setShop({ ...shop, phone_country_code	: e.target.value })}
                  placeholder="+65"
                />
                <input
                  className="h-11 flex-1 rounded-xl border border-gray-200 bg-white px-3 text-gray-900 focus:border-purple-500 focus:ring-purple-500"
                  value={shop.phone_number}
                  onChange={(e) => setShop({ ...shop, phone_number: e.target.value })}
                  placeholder="0000 0000"
                />
              </div>
            </section>
            <div className="border-t border-gray-200" />

            {/* Frame & Commission (read-only display) */}
            <section className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <div className="text-sm font-semibold text-gray-900">Frame</div>
                <p className="mt-1 text-xs text-gray-500">MEURAKI shop package and agreed rate</p>
              </div>
              <div className="grid grid-cols-1 gap-3">
                <input
                  disabled
                  className="h-11 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 text-gray-900"
                  value={shop.frame_id || "—"}
                />
                <div className="flex items-center gap-2">
                  <input
                    disabled
                    className="h-11 flex-1 rounded-xl border border-gray-200 bg-gray-50 px-3 text-gray-900"
                    value={shop.commission_type || "Growth Package"}
                  />
                  <div className="flex items-center gap-2">
                    <input
                      disabled
                      className="h-11 w-20 rounded-xl border border-gray-200 bg-gray-50 px-3 text-gray-900 text-center"
                      value={shop.commission_rate ?? 15}
                    />
                    <span className="text-sm text-gray-600">%</span>
                  </div>
                </div>
              </div>
            </section>

            {/* Sticky save bar */}
            <div className="fixed bottom-0 left-0 right-0 z-10 ml-[calc(300px+280px)] bg-transparent">
              <div className="mx-auto max-w-5xl px-8 pb-6">
                <div className="rounded-full border border-gray-200 bg-white/90 shadow-sm backdrop-blur px-3 py-2.5 flex items-center justify-end gap-3">
                  <a
                    href="/pages/setting/business"
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