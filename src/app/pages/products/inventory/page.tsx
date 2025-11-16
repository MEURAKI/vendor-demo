"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import clsx from "clsx";
import { useRouter } from "next/navigation";
import Sidebar from "../../../../components/sidebar/Sidebar";
import { buildSidebarConfig } from "../../../../components/sidebar/sidebar.config";
import { supabase } from "../../../../lib/supabase/client";

type InventoryStatus = "draft" | "active" | "out_of_stock" | "published" | "inactive";

type InventoryRow = {
  id: string;
  productId: string;
  productName: string;
  variantLabel: string | null;
  category: string;
  price: number;
  stock: number;
  sku: string;
  status: InventoryStatus;
  imageUrl?: string | null;
};

type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  status: "active" | "inactive" | "pending";
  onboarding_completed: boolean;
};

function formatMoney(value: number) {
  return `$${value.toFixed(2)}`;
}

export default function InventoryPage() {
  const router = useRouter();

  const [rows, setRows] = useState<InventoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function init() {
      try {
        setLoading(true);

        const { data: auth } = await supabase.auth.getUser();
        if (auth?.user) {
          const { data: prof } = await supabase
            .from("profiles")
            .select("id,email,status,onboarding_completed,full_name")
            .eq("id", auth.user.id)
            .maybeSingle();
          if (isMounted && prof) setProfile(prof as Profile);
        }

        const res = await fetch("/api/inventory");
        const data = await res.json();
        const mapped: InventoryRow[] = (data.inventory ?? []).map((r: any) => ({
          id: String(r.id),
          productId: String(r.productId),
          productName: r.productName,
          variantLabel: r.variantLabel ?? null,
          category: r.category ?? "—",
          price: (r.priceCents ?? 0) / 100,
          stock: r.stock ?? 0,
          sku: r.sku ?? "",
          status: r.status as InventoryStatus,
          imageUrl: r.imageUrl ?? null,
        }));
        if (isMounted) setRows(mapped);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    void init();
    return () => {
      isMounted = false;
    };
  }, []);

  const sidebarConfig = useMemo(
    () =>
      buildSidebarConfig({
        fullName: profile?.full_name ?? "",
        email: profile?.email ?? "",
        role: "Vendor",
        status: "Incomplete Registration",
      }),
    [profile]
  );

  const filtered = rows.filter((r) => {
    const q = search.toLowerCase();
    return (
      r.productName.toLowerCase().includes(q) ||
      (r.variantLabel ?? "").toLowerCase().includes(q) ||
      r.sku.toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex h-screen w-screen bg-[#050509] overflow-hidden">
      <Sidebar config={sidebarConfig} />

      <div className="flex flex-1 items-stretch justify-center px-6 py-4">
        <div className="flex h-full w-full flex-col overflow-hidden rounded-[32px] border-[3px] border-black bg-[#F6F6FC] shadow-[0_24px_60px_rgba(0,0,0,0.7)]">
          {/* top bar */}
          <div className="sticky top-0 z-30 flex items-center justify-between border-b border-[#E5E0FF] bg-gradient-to-r from-[#F6F0FF] to-[#FDFBFF] px-8 py-4">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold text-[#1B1529]">
                Inventory
              </h1>
              <span className="inline-flex h-7 items-center rounded-full bg-[#B266FF] px-3 text-xs font-semibold text-white">
                {rows.length}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center rounded-full border border-gray-200 bg-[#F5F5F8] px-3 py-1">
                <span className="mr-1 text-xs text-gray-400">🔍</span>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search inventory"
                  className="w-56 bg-transparent text-xs text-gray-700 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* body */}
          <div className="flex-1 overflow-auto p-6">
            <div className="min-h-0 overflow-auto rounded-2xl border border-[#ECECFB] bg-white">
              <table className="min-w-full text-xs">
                <thead className="sticky top-0 z-20 bg-[#F6F5FF] text-[11px] font-semibold text-gray-500 shadow-sm">
                  <tr>
                    <th className="px-3 py-3 text-left">Product Name</th>
                    <th className="px-3 py-3 text-left">Category</th>
                    <th className="px-3 py-3 text-left">Variant</th>
                    <th className="px-3 py-3 text-right">Price</th>
                    <th className="px-3 py-3 text-right">Stock</th>
                    <th className="px-3 py-3 text-left">SKU</th>
                    <th className="px-3 py-3 text-center">Status</th>
                    <th className="px-3 py-3 text-center">Action</th>
                  </tr>
                </thead>

                <tbody>
                  {loading ? (
                    <tr>
                      <td
                        colSpan={8}
                        className="px-4 py-10 text-center text-xs text-gray-500"
                      >
                        Loading inventory…
                      </td>
                    </tr>
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td
                        colSpan={8}
                        className="px-4 py-16 text-center text-xs text-gray-500"
                      >
                        No inventory rows. Try adjusting your search.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((r, idx) => (
                      <tr
                        key={r.id}
                        className={clsx(
                          "border-t border-gray-100",
                          idx % 2 === 1 && "bg-[#FBFBFE]"
                        )}
                      >
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-3">
                            <div className="relative h-9 w-9 overflow-hidden rounded-xl bg-gray-200">
                              {r.imageUrl && (
                                <Image
                                  src={r.imageUrl}
                                  alt={r.productName}
                                  fill
                                  className="object-cover"
                                />
                              )}
                            </div>
                            <div className="text-xs font-semibold text-gray-900">
                              {r.productName}
                            </div>
                          </div>
                        </td>

                        <td className="px-3 py-3 text-[11px] text-gray-600">
                          {r.category}
                        </td>

                        <td className="px-3 py-3 text-[11px] text-gray-600">
                          {r.variantLabel ?? "—"}
                        </td>

                        <td className="px-3 py-3 text-right text-[11px] text-gray-800">
                          {formatMoney(r.price)}
                        </td>

                        <td className="px-3 py-3 text-right text-[11px] text-gray-800">
                          {r.stock}
                        </td>

                        <td className="px-3 py-3 text-[11px] text-gray-600">
                          {r.sku}
                        </td>

                        <td className="px-3 py-3 text-center">
                          <span
                            className={clsx(
                              "inline-flex h-7 items-center rounded-full px-3 text-[11px] font-semibold",
                              r.status === "active" &&
                                "bg-[#DCFCE7] text-[#166534]",
                              r.status === "out_of_stock" &&
                                "bg-[#FEE2E2] text-[#B91C1C]",
                              r.status === "draft" &&
                                "bg-gray-200 text-gray-700"
                            )}
                          >
                            {r.status === "out_of_stock"
                              ? "Out of Stock"
                              : r.status === "active"
                              ? "Active"
                              : r.status === "draft"
                              ? "Draft"
                              : r.status}
                          </span>
                        </td>

                        <td className="px-3 py-3 text-center">
                          <button
                            className="rounded-full bg-black px-4 py-1.5 text-[11px] font-semibold text-white"
                            onClick={() =>
                              router.push(`/pages/products/${r.productId}/edit`)
                            }
                          >
                            Edit Product
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* footer / count */}
            <div className="mt-4 flex items-center justify-between text-[11px] text-gray-500">
              <span>Showing {filtered.length} items</span>
              {/* add pagination here later if you need */}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}