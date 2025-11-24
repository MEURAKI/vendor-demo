// app/vendor/orders/[id]/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import Sidebar from "../../../../../components/sidebar/Sidebar";
import { buildSidebarConfig } from "../../../../../components/sidebar/sidebar.config";
import { supabase } from "../../../../../lib/supabase/client";

type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  status: "active" | "inactive" | "pending";
  onboarding_completed: boolean;
};

export default function OrderDetailPage() {
  const [profile, setProfile] = useState<Profile | null>(null);

  // Load profile for sidebar
  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) return;

      const { data } = await supabase
        .from("profiles")
        .select("id,email,full_name,status,onboarding_completed")
        .eq("id", auth.user.id)
        .maybeSingle();

      if (data) setProfile(data as Profile);
    })();
  }, []);

  const sidebarConfig = useMemo(
    () =>
      buildSidebarConfig({
        fullName: profile?.full_name ?? "",
        email: profile?.email ?? "",
        role: "Vendor",
        status: profile?.status ?? "active",
      }),
    [profile]
  );

  const code = "#M23920";

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#050509]">
      {/* Sidebar */}
      <Sidebar config={sidebarConfig} />

      {/* Main shell */}
      <div className="flex flex-1 items-stretch justify-center px-6 py-4">
        <div className="flex h-full w-full flex-col overflow-hidden rounded-[32px] border-[3px] border-black bg-[#F6F6FC] shadow-[0_24px_60px_rgba(0,0,0,0.7)]">
          {/* Scrollable content */}
          <div className="flex-1 overflow-auto px-6 py-6">
            <div className="mx-auto max-w-6xl">
              <div className="mb-4 text-sm text-slate-500">
                <Link href="/vendor/orders" className="hover:underline">
                  Back to orders
                </Link>
              </div>

              {/* Header row */}
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h1 className="text-2xl font-semibold text-slate-900">
                    Order {code}
                  </h1>
                  <p className="text-sm text-slate-500">
                    Placed 18 May 2025 · 3 items · SGD 142.40
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-medium text-indigo-700">
                    Shipped
                  </span>
                  <button className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white">
                    Mark as delivered
                  </button>
                  <button className="rounded-full bg-white px-4 py-2 text-sm shadow-sm">
                    More actions ▾
                  </button>
                </div>
              </div>

              {/* Progress bar / timeline */}
              <div className="mb-6 rounded-3xl bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div className="flex flex-1 items-center justify-between">
                    {[
                      { label: "Placed", date: "18 May 2025 · 21:14", done: true },
                      { label: "Fulfilled", date: "19 May 2025 · 09:30", done: true },
                      { label: "Shipped", date: "20 May 2025 · 10:05", done: true },
                      { label: "Delivered", date: "ETA 22–24 May", done: false },
                    ].map((step, idx, arr) => (
                      <div key={step.label} className="flex flex-1 items-center">
                        <div className="flex flex-col items-center">
                          <div
                            className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium ${
                              step.done
                                ? "bg-slate-900 text-white"
                                : "bg-slate-200 text-slate-500"
                            }`}
                          >
                            {idx + 1}
                          </div>
                          <div className="mt-1 text-xs font-medium text-slate-700">
                            {step.label}
                          </div>
                          <div className="text-[11px] text-slate-400">{step.date}</div>
                        </div>
                        {idx < arr.length - 1 && (
                          <div className="mx-2 h-px flex-1 bg-slate-200" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* 2-column layout */}
              <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.6fr)]">
                {/* Left column cards */}
                <div className="space-y-5">
                  {/* Customer card */}
                  <div className="rounded-3xl bg-white p-5 shadow-sm">
                    <h2 className="mb-3 text-sm font-semibold text-slate-900">
                      Customer
                    </h2>
                    <p className="text-sm font-medium text-slate-900">Daniel Chan</p>
                    <p className="text-sm text-slate-500">daniel.chan@example.com</p>
                    <p className="mt-1 text-sm text-slate-500">+65 8132 4567</p>

                    <div className="mt-4 flex flex-wrap gap-3">
                      <button className="rounded-full bg-white px-4 py-2 text-xs shadow-sm">
                        Email
                      </button>
                      <button className="rounded-full bg-purple-600 px-4 py-2 text-xs font-medium text-white">
                        Call / WhatsApp
                      </button>
                    </div>
                  </div>

                  {/* Delivery & fulfilment */}
                  <div className="rounded-3xl bg-white p-5 shadow-sm">
                    <h2 className="mb-3 text-sm font-semibold text-slate-900">
                      Delivery & fulfilment
                    </h2>
                    <p className="mb-2 inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
                      Standard delivery
                    </p>

                    <div className="mt-3 space-y-1 text-sm text-slate-600">
                      <p>
                        <span className="font-medium">Expected delivery:</span>{" "}
                        18–25 May
                      </p>
                      <p>Standard · 3–5 business days</p>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
                      <div>
                        <p className="text-xs uppercase tracking-wide text-slate-400">
                          Fulfilment details
                        </p>
                        <p className="text-slate-700">Shipping provider</p>
                      </div>
                      <div className="h-8 w-px bg-slate-200" />
                      <div>
                        <p className="text-xs uppercase tracking-wide text-slate-400">
                          Tracking
                        </p>
                        <p className="text-slate-700">MRAK123456789</p>
                      </div>
                      <button className="text-xs font-medium text-slate-900 underline-offset-4 hover:underline">
                        View tracking page
                      </button>
                    </div>

                    <div className="mt-4">
                      <p className="text-xs uppercase tracking-wide text-slate-400">
                        Ship to
                      </p>
                      <p className="mt-1 text-sm text-slate-700">
                        Daniel Chan
                        <br />
                        233 Orchard Road, #08–12
                        <br />
                        Singapore 238891
                      </p>
                    </div>
                  </div>

                  {/* Payment & totals */}
                  <div className="rounded-3xl bg-white p-5 shadow-sm">
                    <h2 className="mb-3 text-sm font-semibold text-slate-900">
                      Payment & totals
                    </h2>

                    <dl className="space-y-2 text-sm text-slate-700">
                      <div className="flex justify-between">
                        <dt>Subtotal</dt>
                        <dd>SGD 130.00</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt>Shipping – Standard</dt>
                        <dd>SGD 8.00</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt>Promo code (WELCOME20)</dt>
                        <dd>– SGD 0.00</dd>
                      </div>
                      <div className="mt-2 flex justify-between border-t border-slate-100 pt-3 text-base font-semibold">
                        <dt>Total</dt>
                        <dd>SGD 142.40</dd>
                      </div>
                    </dl>

                    <div className="mt-4 space-y-1 text-xs text-slate-500">
                      <p>Paid with Visa ···· 0633</p>
                      <p>Payment status: Paid</p>
                      <p>Vendor earnings: SGD 113.92</p>
                      <p>Meuraki commission: SGD 28.48 (20%)</p>
                    </div>
                  </div>
                </div>

                {/* Right column cards */}
                <div className="space-y-5">
                  {/* What to pack */}
                  <div className="rounded-3xl bg-white p-5 shadow-sm">
                    <h2 className="mb-3 text-sm font-semibold text-slate-900">
                      What to pack
                    </h2>

                    <div className="space-y-3">
                      <div className="flex items-start justify-between rounded-2xl bg-slate-50 p-3">
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            className="mt-1 h-4 w-4 rounded border-slate-300"
                          />
                          <div>
                            <p className="text-sm font-medium text-slate-900">
                              Barrett Grounded Flow Set × 1
                            </p>
                            <p className="text-xs text-slate-500">
                              Bundle · Contains 3 items
                            </p>
                          </div>
                        </div>
                        <span className="rounded-full bg-slate-200 px-2 py-1 text-[10px] uppercase tracking-wide text-slate-700">
                          Bundle
                        </span>
                      </div>

                      {/* Single item rows */}
                      {[
                        {
                          name: "Organic Pure Yoga Mat",
                          meta: "Color: Indigo Dust · Thickness: 4mm",
                          stock: "In stock: 80",
                        },
                        {
                          name: "Organic Yoga Mat Spray",
                          meta: "Scent: Lavender · 250ml",
                          stock: "In stock: 54",
                        },
                      ].map((item) => (
                        <div
                          key={item.name}
                          className="flex items-start justify-between gap-3"
                        >
                          <div className="flex items-start gap-3">
                            <input
                              type="checkbox"
                              className="mt-1 h-4 w-4 rounded border-slate-300"
                            />
                            <div>
                              <p className="text-sm font-medium text-slate-900">
                                {item.name} × 1
                              </p>
                              <p className="text-xs text-slate-500">
                                {item.meta}
                              </p>
                              <p className="text-xs text-slate-400">
                                {item.stock}
                              </p>
                            </div>
                          </div>
                          <button className="text-xs font-medium text-slate-900 underline-offset-4 hover:underline">
                            View in inventory
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Customer note */}
                  <div className="rounded-3xl bg-white p-5 shadow-sm">
                    <h2 className="mb-3 text-sm font-semibold text-slate-900">
                      Customer note
                    </h2>
                    <p className="text-sm text-slate-600">
                      “Please wrap as a gift, no pricing on slip.”
                    </p>
                  </div>

                  {/* Activity */}
                  <div className="rounded-3xl bg-white p-5 shadow-sm">
                    <h2 className="mb-3 text-sm font-semibold text-slate-900">
                      Activity
                    </h2>
                    <ul className="space-y-2 text-xs text-slate-600">
                      <li>22 May 2025, 15:12 — Marked as delivered</li>
                      <li>20 May 2025, 10:05 — Shipped with DHL</li>
                      <li>19 May 2025, 09:30 — Marked as fulfilled</li>
                      <li>18 May 2025, 21:14 — Order placed</li>
                    </ul>
                  </div>

                  {/* Internal notes */}
                  <div className="rounded-3xl bg-white p-5 shadow-sm">
                    <h2 className="mb-3 text-sm font-semibold text-slate-900">
                      Internal notes
                    </h2>
                    <p className="mb-2 text-xs text-slate-500">
                      Add private notes about this order (visible only to you
                      and your team).
                    </p>
                    <textarea
                      className="h-24 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-slate-400"
                      placeholder="These notes are not shown to the customer."
                    />
                    <div className="mt-3 flex justify-end">
                      <button className="rounded-full bg-slate-900 px-4 py-2 text-xs font-medium text-white">
                        Save note
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              {/* end grid */}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}