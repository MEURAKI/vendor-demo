"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import clsx from "clsx";
import { useRouter } from "next/navigation";
import Sidebar from "../../../../components/sidebar/Sidebar";
import { buildSidebarConfig } from "../../../../components/sidebar/sidebar.config";
import { supabase } from "../../../../lib/supabase/client";
import ClipLoader from "react-spinners/ClipLoader";

type BundleStatus = "draft" | "active" | "out_of_stock";

type BundleRow = {
  id: string;
  name: string;
  type: "Single" | "Multiple";
  productsIncluded: number;
  sku: string;
  price: number;
  discount: number;
  status: BundleStatus;
  imageUrl?: string | null;
};

export default function AllBundlesPage() {
  const router = useRouter();
  const [bundles, setBundles] = useState<BundleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    let mounted = true;

    async function init() {
      setLoading(true);

      const { data: auth } = await supabase.auth.getUser();
      if (auth?.user) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("id,email,status,onboarding_completed,full_name")
          .eq("id", auth.user.id)
          .maybeSingle();
        if (mounted && prof) setProfile(prof);
      }

      const res = await fetch("/api/bundles");
      const data = await res.json();

      const mapped: BundleRow[] = (data.bundles ?? []).map((b: any) => ({
        id: String(b.id),
        name: b.name,
        type: b.type ?? "Multiple",
        productsIncluded: b.productsIncluded ?? 0,
        sku: b.sku,
        price: (b.priceCents ?? 0) / 100,
        discount: b.discountType ? b.discountValue ?? 0 : 0,
        status: b.status,
        imageUrl: b.imageUrl ?? null,
      }));

      if (mounted) {
        setBundles(mapped);
        setLoading(false);
      }
    }

    void init();
    return () => {
      mounted = false;
    };
  }, []);

  const sidebarConfig = useMemo(
    () =>
      buildSidebarConfig({
        fullName: profile?.full_name ?? "",
        email: profile?.email ?? "",
        role: "Vendor",
       status: profile?.status ?? "active"
      }),
    [profile]
  );

  const filtered = bundles.filter((b) =>
    b.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#050509]">
      <Sidebar config={sidebarConfig} />

      <div className="flex flex-1 items-stretch justify-center px-6 py-4">
        <div className="flex h-full w-full flex-col overflow-hidden rounded-[32px] border-[3px] border-black bg-[#F6F6FC] shadow-[0_24px_60px_rgba(0,0,0,0.7)]">
          {/* Top bar */}
          <div className="sticky top-0 z-30 flex items-center justify-between border-b border-[#E5E0FF] bg-gradient-to-r from-[#F6F0FF] to-[#FDFBFF] px-8 py-4">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold text-[#1B1529]">
                All Bundles
              </h1>
              <span className="inline-flex h-7 items-center rounded-full bg-[#B266FF] px-3 text-xs font-semibold text-white">
                {bundles.length}
              </span>
            </div>

            <div className="flex items-center gap-3">
              {/* Bulk actions skeleton */}
              <button className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-1.5 text-[11px] font-semibold shadow-sm">
                Bulk Actions ▾
              </button>

              {/* Filter skeleton */}
              <button className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-4 py-1.5 text-[11px] font-semibold text-gray-700 shadow-sm">
                Filter by ▾
              </button>

              {/* Search */}
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search Bundle"
                 className="
      w-60
      rounded-full
      bg-white
      pl-11
      pr-4
      py-2
      text-xs
      text-gray-700
      shadow-sm
      border border-gray-200
      placeholder:text-gray-400
      focus:border-[#7C3AED]
      focus:ring-2 
      focus:ring-[#E9D8FD] 
      focus:outline-none
      transition-all
    "
                />

              <button
                type="button"
                onClick={() => router.push("/pages/products/bundles/new")}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-black text-lg font-semibold text-white shadow-md hover:bg-gray-900"
              >
                +
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-auto p-6">
            <div className="min-h-0 overflow-auto rounded-2xl border border-[#ECECFB] bg-white">
              <table className="min-w-full text-xs">
                <thead className="sticky top-0 z-20 bg-[#F6F5FF] text-[11px] font-semibold text-gray-500 shadow-sm">
                  <tr>
                    <th className="w-8 px-3 py-3"></th>
                    <th className="px-3 py-3 text-left">Bundle Name</th>
                    <th className="px-3 py-3 text-left">Type</th>
                    <th className="px-3 py-3 text-left">Products Included</th>
                    <th className="px-3 py-3 text-left">SKU</th>
                    <th className="px-3 py-3 text-right">Price</th>
                    <th className="px-3 py-3 text-right">Discount</th>
                    <th className="px-3 py-3 text-center">Status</th>
                    <th className="px-3 py-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td
                        colSpan={9}
                        className="px-4 py-10 text-center text-xs text-gray-500"
                      >
                                <ClipLoader size={55} color="#6B46C1" />

                      </td>
                    </tr>
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td
                        colSpan={9}
                        className="px-4 py-16 text-center text-xs text-gray-500"
                      >
                        No bundles found.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((b, idx) => (
                      <tr
                        key={b.id}
                        className={clsx(
                          "border-t border-gray-100",
                          idx % 2 === 1 && "bg-[#FBFBFE]"
                        )}
                      >
                        <td className="px-3 py-3">
                          <input type="checkbox" className="h-3 w-3" />
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-3">
                            <div className="relative h-9 w-9 overflow-hidden rounded-xl bg-gray-200">
                              <Image
                                src={
                                  b.imageUrl ||
                                  "/images/bundle-placeholder.svg"
                                }
                                alt={b.name}
                                fill
                                className="object-cover"
                              />
                            </div>
                            <div className="text-xs font-semibold text-gray-900">
                              {b.name}
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-[11px] text-gray-600">
                          {b.type}
                        </td>
                        <td className="px-3 py-3 text-[11px] text-gray-600">
                          {b.productsIncluded}
                        </td>
                        <td className="px-3 py-3 text-[11px] text-gray-600">
                          {b.sku}
                        </td>
                        <td className="px-3 py-3 text-right text-[11px] text-gray-800">
                          ${b.price.toFixed(2)}
                        </td>
                        <td className="px-3 py-3 text-right text-[11px] text-gray-800">
                          {b.discount ? `-$${b.discount.toFixed(2)}` : "—"}
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span
                            className={clsx(
                              "inline-flex h-7 items-center rounded-full px-3 text-[11px] font-semibold",
                              b.status === "active" &&
                                "bg-[#DCFCE7] text-[#166534]",
                              b.status === "draft" &&
                                "bg-gray-200 text-gray-700",
                              b.status === "out_of_stock" &&
                                "bg-[#FEE2E2] text-[#B91C1C]"
                            )}
                          >
                            {b.status === "out_of_stock"
                              ? "Out of Stock"
                              : b.status === "active"
                              ? "Active"
                              : "Draft"}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              className="rounded-full bg-black px-4 py-1.5 text-[11px] font-semibold text-white"
                              onClick={() =>
                                router.push(`/pages/products/bundles/${b.id}/edit`)
                              }
                            >
                              Edit
                            </button>
                            <button className="rounded-full border border-gray-300 px-4 py-1.5 text-[11px] text-gray-700">
                              Trash
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex items-center justify-between text-[11px] text-gray-500">
              <span>Showing {filtered.length} bundles</span>
              <div className="space-x-2">
                <button className="rounded-full border border-gray-300 px-3 py-1">
                  &lt; Back
                </button>
                <button className="rounded-full border border-gray-300 px-3 py-1">
                  1
                </button>
                <button className="rounded-full border border-gray-300 px-3 py-1">
                  Next &gt;
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}