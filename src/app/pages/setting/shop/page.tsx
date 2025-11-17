"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { supabase } from "../../../../lib/supabase/client";
import Sidebar from "../../../../components/sidebar/Sidebar";
import SettingsNav from "../../../../components/settings/SettingsNav";
import { buildSidebarConfig } from "../../../../components/sidebar/sidebar.config";
import { useToast } from "../../../../components/toast/ToastProvider";

/* ----------------------------- Types ----------------------------- */

type UserStatus =
  | "pending_admin_approval"
  | "approved"
  | "active"
  | "rejected"
  | "suspended";

type ProfileLite = {
  id: string;
  email: string | null;
  full_name: string | null;
  status: UserStatus;
};

type VendorBusiness = {
  id: string;
  // shop – general
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

  // fulfilment
  fulfilment_delivery: boolean;
  fulfilment_pickup: boolean;
  delivery_days_standard: string | null;
  delivery_rate_standard: string | null;
  delivery_days_express: string | null;
  delivery_rate_express: string | null;
  pickup_address: string | null;
  pickup_postal_code: string | null;
  delivery_days_note: string | null;
};

/* ----------------------------- Page ----------------------------- */

type TabKey = "general" | "fulfilment";

export default function ShopSettingsPage() {
  const [profile, setProfile] = useState<ProfileLite | null>(null);
  const [vb, setVb] = useState<VendorBusiness | null>(null);
  const [bioCount, setBioCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { successToast, errorToast } = useToast();

  // URL-based tab handling
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const urlTab = (searchParams.get("tab") as TabKey) || "general";
  const [activeTab, setActiveTab] = useState<TabKey>(urlTab);

  // Keep local state in sync with URL
  useEffect(() => {
    const next = (searchParams.get("tab") as TabKey) || "general";
    setActiveTab(next);
  }, [searchParams]);

  function switchTab(tab: TabKey) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    router.replace(`${pathname}?${params.toString()}`);
  }

  // Initial load: profile + vendor_business
  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth.user;
      if (!user) {
        setLoading(false);
        return;
      }

      const [{ data: prof }, { data: vbRow }] = await Promise.all([
        supabase
          .from("profiles")
          .select("id,email,full_name,status")
          .eq("id", user.id)
          .maybeSingle(),
        supabase
          .from("vendor_business")
          .select(
            `
              id,
              shop_status,
              shop_name,
              shop_slug,
              business_category,
              shop_bio,
              contact_email,
              phone_country_code,
              phone_number,
              frame_id,
              commission_type,
              commission_rate,
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
          .maybeSingle(),
      ]);

      const profTyped: ProfileLite = {
        id: user.id,
        email: prof?.email ?? user.email ?? null,
        full_name: prof?.full_name ?? user.email ?? "User",
        status: (prof?.status as UserStatus) ?? "pending_admin_approval",
      };

      const defaults: VendorBusiness = {
        id: user.id,
        shop_status: false,
        shop_name: "",
        shop_slug: "",
        business_category: "",
        shop_bio: "",
        contact_email: profTyped.email ?? "",
        phone_country_code: "+65",
        phone_number: "",
        frame_id: null,
        commission_type: null,
        commission_rate: null,
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

      const merged: VendorBusiness = { ...defaults, ...(vbRow || {}) };

      setProfile(profTyped);
      setVb(merged);
      setBioCount(merged.shop_bio?.length || 0);
      setLoading(false);
    })();
  }, []);

  /* ------------------------- Sidebar config ------------------------- */

  const sidebarConfig = useMemo(() => {
    const statusLabel =
      profile?.status === "active" ? "Active" : "Incomplete Registration";

    return buildSidebarConfig({
      fullName: profile?.full_name ?? profile?.email ?? "User",
      email: profile?.email ?? "",
      role: "Vendor",
      status: statusLabel,
    });
  }, [profile]);

  /* ------------------------- Save helpers --------------------------- */

  function buildPayload(src: VendorBusiness) {
    return {
      id: src.id,
      // general
      shop_status: src.shop_status,
      shop_name: (src.shop_name || "").trim(),
      shop_slug: (src.shop_slug || "").replace(/[^a-z0-9-]/gi, "").toLowerCase(),
      business_category: (src.business_category || "").trim(),
      shop_bio: (src.shop_bio || "").slice(0, 200),
      contact_email: (src.contact_email || "").trim(),
      phone_country_code: src.phone_country_code || "+65",
      phone_number: (src.phone_number || "").trim(),
      frame_id: src.frame_id,
      commission_type: src.commission_type,
      commission_rate: src.commission_rate,

      // fulfilment
      fulfilment_delivery: !!src.fulfilment_delivery,
      fulfilment_pickup: !!src.fulfilment_pickup,
      delivery_days_standard: src.delivery_days_standard,
      delivery_rate_standard: src.delivery_rate_standard,
      delivery_days_express: src.delivery_days_express,
      delivery_rate_express: src.delivery_rate_express,
      pickup_address: src.pickup_address,
      pickup_postal_code: src.pickup_postal_code,
      delivery_days_note: src.delivery_days_note,

      updated_at: new Date().toISOString(),
    };
  }

  async function save(tab: TabKey) {
    if (!vb) return;
    setSaving(true);

    const payload = buildPayload(vb);

    const { error } = await supabase
      .from("vendor_business")
      .upsert(payload, { onConflict: "id" });

    setSaving(false);
    if (error) {
      errorToast({
        title: "Error",
        description:
          tab === "general"
            ? "Failed to save shop settings."
            : "Failed to save fulfilment details.",
      });
    } else {
      successToast({
        title: "Success",
        description:
          tab === "general"
            ? "Shop settings saved."
            : "Fulfilment details saved successfully.",
      });
    }
  }

  /* ------------------------- Loading state -------------------------- */

  if (loading || !vb || !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <p className="text-gray-600">Loading shop settings…</p>
      </div>
    );
  }

  /* ------------------------- Render -------------------------- */

  return (
    <Suspense>
    <div className="flex h-screen bg-[#F7F7FB]">
      <Sidebar config={sidebarConfig} />
      <SettingsNav />

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl px-8 py-10">
          <h1 className="text-[28px] font-semibold text-gray-900">Shop Settings</h1>

          {/* Tabs (URL-driven) */}
          <div className="mt-6 flex gap-8 border-b border-gray-200 text-sm">
            <button
              type="button"
              onClick={() => switchTab("general")}
              className={[
                "pb-3",
                activeTab === "general"
                  ? "border-b-2 border-gray-900 font-semibold text-gray-900"
                  : "text-gray-600 hover:text-gray-900",
              ].join(" ")}
            >
              General
            </button>
            <button
              type="button"
              onClick={() => switchTab("fulfilment")}
              className={[
                "pb-3",
                activeTab === "fulfilment"
                  ? "border-b-2 border-gray-900 font-semibold text-gray-900"
                  : "text-gray-600 hover:text-gray-900",
              ].join(" ")}
            >
              Fulfilment &amp; Delivery
            </button>
          </div>

          {/* Verification banner: only when NOT active */}
          {profile.status !== "active" && (
            <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-black px-4 py-2 text-sm text-white">
              <span className="inline-block h-2 w-2 rounded-full bg-purple-400" />
              You cannot publish products, list services, or receive payouts until your
              business is verified.
            </div>
          )}

          {/* GENERAL TAB ------------------------------------------------ */}
          {activeTab === "general" && (
            <form
              className="mt-8 space-y-12 pb-28"
              onSubmit={(e) => {
                e.preventDefault();
                save("general");
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
                  <div className="text-sm text-gray-700">
                    {vb.shop_status ? "Live" : "Hidden"}
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setVb((prev) => prev && { ...prev, shop_status: !prev.shop_status })
                    }
                    className={[
                      "relative h-6 w-11 rounded-full transition",
                      vb.shop_status ? "bg-purple-600" : "bg-gray-300",
                    ].join(" ")}
                    aria-label="Toggle shop status"
                  >
                    <span
                      className={[
                        "absolute top-1/2 -translate-y-1/2 h-4 w-4 rounded-full bg-white shadow transition",
                        vb.shop_status ? "right-1" : "left-1",
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
                  value={vb.shop_name}
                  onChange={(e) =>
                    setVb((prev) => prev && { ...prev, shop_name: e.target.value })
                  }
                  placeholder="Wellness Club Co."
                />

                <div>
                  <div className="text-sm font-semibold text-gray-900">
                    Shop URL / Handle
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    Custom URL slug (e.g. /meuraki.com/sg/shop-name).
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="select-none text-sm text-gray-500">/</span>
                  <input
                    className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-gray-900 focus:border-purple-500 focus:ring-purple-500"
                    value={vb.shop_slug}
                    onChange={(e) =>
                      setVb((prev) =>
                        prev && {
                          ...prev,
                          shop_slug: e.target.value
                            .replace(/[^a-z0-9-]/gi, "")
                            .toLowerCase(),
                        }
                      )
                    }
                    placeholder="custom-handle"
                  />
                </div>
              </section>
              <div className="border-t border-gray-200" />

              {/* Category */}
              <section className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div>
                  <div className="text-sm font-semibold text-gray-900">
                    Business Category
                  </div>
                  <p className="mt-1 text-xs text-gray-500">Primary focus area.</p>
                </div>
                <input
                  className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-gray-900 focus:border-purple-500 focus:ring-purple-500"
                  value={vb.business_category}
                  onChange={(e) =>
                    setVb((prev) =>
                      prev && { ...prev, business_category: e.target.value }
                    )
                  }
                  placeholder="Wellness, Skincare, Nutrition"
                />
              </section>
              <div className="border-t border-gray-200" />

              {/* Short bio */}
              <section className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div>
                  <div className="text-sm font-semibold text-gray-900">
                    Shop Description / Bio (Short)
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    About the shop (public-facing).
                  </p>
                </div>
                <div>
                  <textarea
                    rows={3}
                    className="w-full rounded-xl border border-gray-200 bg-white p-3 text-gray-900 focus:border-purple-500 focus:ring-purple-500"
                    maxLength={200}
                    value={vb.shop_bio}
                    onChange={(e) => {
                      const value = e.target.value.slice(0, 200);
                      setVb((prev) => prev && { ...prev, shop_bio: value });
                      setBioCount(value.length);
                    }}
                    placeholder="Promoting holistic wellbeing…"
                  />
                  <div className="mt-1 text-right text-xs text-gray-500">
                    {bioCount}/200
                  </div>
                </div>
              </section>
              <div className="border-t border-gray-200" />

              {/* Contact email */}
              <section className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div>
                  <div className="text-sm font-semibold text-gray-900">
                    Shop Contact Email Address
                  </div>
                  <p className="mt-1 text-xs text-gray-500">For customer inquiries.</p>
                </div>
                <input
                  type="email"
                  className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-gray-900 focus:border-purple-500 focus:ring-purple-500"
                  value={vb.contact_email}
                  onChange={(e) =>
                    setVb((prev) => prev && { ...prev, contact_email: e.target.value })
                  }
                  placeholder="e.g. janedoe@gmail.com"
                />
              </section>
              <div className="border-t border-gray-200" />

              {/* Contact phone */}
              <section className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div>
                  <div className="text-sm font-semibold text-gray-900">
                    Shop Contact Phone Number
                  </div>
                  <p className="mt-1 text-xs text-gray-500">For customer inquiries.</p>
                </div>
                <div className="flex gap-2">
                  <input
                    className="h-11 w-24 rounded-xl border border-gray-200 bg-white px-3 text-gray-900 focus:border-purple-500 focus:ring-purple-500"
                    value={vb.phone_country_code}
                    onChange={(e) =>
                      setVb((prev) =>
                        prev && { ...prev, phone_country_code: e.target.value }
                      )
                    }
                    placeholder="+65"
                  />
                  <input
                    className="h-11 flex-1 rounded-xl border border-gray-200 bg-white px-3 text-gray-900 focus:border-purple-500 focus:ring-purple-500"
                    value={vb.phone_number}
                    onChange={(e) =>
                      setVb((prev) => prev && { ...prev, phone_number: e.target.value })
                    }
                    placeholder="0000 0000"
                  />
                </div>
              </section>
              <div className="border-t border-gray-200" />

              {/* Frame & Commission (read-only display) */}
              <section className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div>
                  <div className="text-sm font-semibold text-gray-900">Frame</div>
                  <p className="mt-1 text-xs text-gray-500">
                    MEURAKI shop package and agreed rate
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-3">
                  <input
                    disabled
                    className="h-11 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 text-gray-900"
                    value={vb.frame_id || "—"}
                  />
                  <div className="flex items-center gap-2">
                    <input
                      disabled
                      className="h-11 flex-1 rounded-xl border border-gray-200 bg-gray-50 px-3 text-gray-900"
                      value={vb.commission_type || "Growth Package"}
                    />
                    <div className="flex items-center gap-2">
                      <input
                        disabled
                        className="h-11 w-20 rounded-xl border border-gray-200 bg-gray-50 px-3 text-center text-gray-900"
                        value={vb.commission_rate ?? 15}
                      />
                      <span className="text-sm text-gray-600">%</span>
                    </div>
                  </div>
                </div>
              </section>

              {/* Sticky save bar */}
              <div className="fixed bottom-0 left-0 right-0 z-10 ml-[calc(300px+280px)] bg-transparent">
                <div className="mx-auto max-w-5xl px-8 pb-6">
                  <div className="flex items-center justify-end gap-3 rounded-full border border-gray-200 bg-white/90 px-3 py-2.5 shadow-sm backdrop-blur">
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
          )}

          {/* FULFILMENT TAB -------------------------------------------- */}
          {activeTab === "fulfilment" && (
            <form
              className="mt-8 space-y-12 pb-28"
              onSubmit={(e) => {
                e.preventDefault();
                save("fulfilment");
              }}
            >
              {/* Fulfilment method */}
              <section className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div>
                  <div className="text-sm font-semibold text-gray-900">
                    Fulfilment Method
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    How vendor delivers products/services.
                  </p>
                </div>
                <div className="flex gap-6">
                  <label className="flex items-center gap-2 text-sm text-gray-800">
                    <input
                      type="checkbox"
                      checked={!!vb.fulfilment_delivery}
                      onChange={(e) =>
                        setVb((prev) =>
                          prev && { ...prev, fulfilment_delivery: e.target.checked }
                        )
                      }
                      className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                    />
                    Delivery
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-800">
                    <input
                      type="checkbox"
                      checked={!!vb.fulfilment_pickup}
                      onChange={(e) =>
                        setVb((prev) =>
                          prev && { ...prev, fulfilment_pickup: e.target.checked }
                        )
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
                  <div className="text-sm font-semibold text-gray-900">
                    Shipping Profile &amp; Pricing
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    Standard and express delivery options.
                  </p>
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
                        value={vb.delivery_days_standard ?? ""}
                        onChange={(e) =>
                          setVb((prev) =>
                            prev && {
                              ...prev,
                              delivery_days_standard: e.target.value,
                            }
                          )
                        }
                        placeholder="3 – 5 days"
                      />
                      <input
                        className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-gray-900"
                        value={vb.delivery_rate_standard ?? ""}
                        onChange={(e) =>
                          setVb((prev) =>
                            prev && {
                              ...prev,
                              delivery_rate_standard: e.target.value,
                            }
                          )
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
                        value={vb.delivery_days_express ?? ""}
                        onChange={(e) =>
                          setVb((prev) =>
                            prev && {
                              ...prev,
                              delivery_days_express: e.target.value,
                            }
                          )
                        }
                        placeholder="1 day (Between 5:00pm – 9:00pm)"
                      />
                      <input
                        className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-gray-900"
                        value={vb.delivery_rate_express ?? ""}
                        onChange={(e) =>
                          setVb((prev) =>
                            prev && {
                              ...prev,
                              delivery_rate_express: e.target.value,
                            }
                          )
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
                  <div className="text-sm font-semibold text-gray-900">
                    Pickup Address
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    Your store address is your pickup address. However, if you have a
                    warehouse, provide that instead.
                  </p>
                </div>
                <div className="space-y-3">
                  <input
                    className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-gray-900"
                    value={vb.pickup_address ?? ""}
                    onChange={(e) =>
                      setVb((prev) =>
                        prev && { ...prev, pickup_address: e.target.value }
                      )
                    }
                    placeholder="56 Tanglin Road, 01-03 Singapore 247964"
                  />
                  <input
                    className="h-11 w-40 rounded-xl border border-gray-200 bg-white px-3 text-gray-900"
                    value={vb.pickup_postal_code ?? ""}
                    onChange={(e) =>
                      setVb((prev) =>
                        prev && { ...prev, pickup_postal_code: e.target.value }
                      )
                    }
                    placeholder="247964"
                  />
                </div>
              </section>
              <div className="border-t border-gray-200" />

              {/* Delivery days note */}
              <section className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div>
                  <div className="text-sm font-semibold text-gray-900">
                    Delivery Days
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    Days available for delivery.
                  </p>
                </div>
                <input
                  className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-gray-900"
                  value={vb.delivery_days_note ?? ""}
                  onChange={(e) =>
                    setVb((prev) =>
                      prev && { ...prev, delivery_days_note: e.target.value }
                    )
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
          )}
        </div>
      </main>
    </div>
    </Suspense>
  );
}