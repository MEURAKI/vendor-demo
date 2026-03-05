"use client";

import { useVendorProfile } from "../../../../../context/VendorShellContext";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import clsx from "clsx";
import { useRouter } from "next/navigation";
import { supabase } from "../../../../../lib/supabase/client";
import { Search } from "lucide-react";
import ClipLoader from "react-spinners/ClipLoader";

type ProductStatus = "draft" | "active" | "out_of_stock" | "published" | "inactive";

type ProductRow = {
  id: string;
  name: string;
  type: "Single" | "Variant";
  categories: string;
  price: number; // original
  stock: number;
  sku: string;
  status: ProductStatus;
  variantCount: number;
  imageUrl?: string | null;
};

type UserStatus = "active" | "inactive" | "pending";

type Profile = {
  id: string;
  email: string | null;
  status: UserStatus;
  onboarding_completed: boolean;
  full_name: string | null;
};

type DiscountType = "fixed" | "percent";

type CorporateSettings = {
  corporate_program_enabled: boolean;
  corporate_discount_products: boolean;
  corporate_product_discount_type: DiscountType;
  corporate_product_discount_value: number;
};

function formatMoney(value: number) {
  return `$${value.toFixed(2)}`;
}

function computeDiscountedPrice(
  price: number,
  type: DiscountType,
  value: number
): number {
  const safePrice = Number.isFinite(price) ? price : 0;
  const safeValue = Number.isFinite(value) ? value : 0;

  if (type === "percent") {
    const pct = Math.max(0, Math.min(100, safeValue));
    return Math.max(0, safePrice - (safePrice * pct) / 100);
  }

  // fixed
  return Math.max(0, safePrice - Math.max(0, safeValue));
}

export default function CorporateProductsPage() {
  const router = useRouter();

  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [corp, setCorp] = useState<CorporateSettings | null>(null);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);

        const { data: auth } = await supabase.auth.getUser();
        if (!auth?.user) return;

        // profile (for sidebar)
        const { data: prof } = await supabase
          .from("profiles")
          .select("id,email,status,onboarding_completed,full_name")
          .eq("id", auth.user.id)
          .maybeSingle();

        if (alive && prof) setProfile(prof as Profile);

        // corporate settings
        const { data: vb } = await supabase
          .from("vendor_business")
          .select(
            `
            corporate_program_enabled,
            corporate_discount_products,
            corporate_product_discount_type,
            corporate_product_discount_value
          `
          )
          .eq("id", auth.user.id)
          .maybeSingle();

        if (alive && vb) {
          setCorp({
            corporate_program_enabled: !!vb.corporate_program_enabled,
            corporate_discount_products: !!vb.corporate_discount_products,
            corporate_product_discount_type: (vb.corporate_product_discount_type as DiscountType) || "percent",
            corporate_product_discount_value: Number(vb.corporate_product_discount_value ?? 0),
          });
        }

        // products
        const {
          data: { session },
        } = await supabase.auth.getSession();

        const res = await fetch("/api/products", {
          headers: {
            Authorization: session?.access_token ? `Bearer ${session.access_token}` : "",
          },
        });

        if (!res.ok) throw new Error("Failed to fetch products");
        const data = await res.json();

        const mapped: ProductRow[] = (data.products ?? data ?? []).map((p: any) => ({
          id: String(p.id),
          name: p.name,
          type: p.type === "Variant" ? "Variant" : "Single",
          categories: p.categories ?? "—",
          price: typeof p.priceCents === "number" ? p.priceCents / 100 : 0,
          stock: p.stock ?? p.totalStock ?? p.inventoryQty ?? 0,
          sku: p.baseSku ?? p.sku ?? "",
          status: p.status as ProductStatus,
          variantCount: p.variantCount ?? 0,
          imageUrl: p.imageUrl ?? null,
        }));

        if (alive) setProducts(mapped);
      } catch (e) {
        console.error(e);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return products;
    return products.filter((p) => p.name?.toLowerCase().includes(term));
  }, [products, search]);

  const canApplyCorporate =
    !!corp?.corporate_program_enabled && !!corp?.corporate_discount_products;

  return (
    <>
          {/* Top bar */}
          <div className="sticky top-0 z-30 flex items-center justify-between border-b border-[#E5E0FF] bg-gradient-to-r from-[#F6F0FF] to-[#FDFBFF] px-8 py-4">
            <div className="flex items-center gap-3">
              <div>
                <h1 className="text-xl font-semibold text-[#1B1529]">Corporate Program Products</h1>
                <p className="mt-0.5 text-[11px] text-gray-500">
                  Showing corporate-discounted pricing for your products.
                </p>
              </div>

              <span className="inline-flex h-7 items-center rounded-full bg-[#B266FF] px-3 text-xs font-semibold text-white">
                {filtered.length}
              </span>

              {!canApplyCorporate && (
                <span className="inline-flex h-7 items-center rounded-full bg-black/80 px-3 text-[11px] font-semibold text-white">
                  Corporate discount not enabled
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              {/* Search */}
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") setSearch(searchInput);
                  }}
                  placeholder="Search product…"
                  className="w-64 rounded-full bg-white pl-11 pr-4 py-2 text-xs text-gray-700 shadow-sm border border-gray-200 placeholder:text-gray-400 focus:border-[#7C3AED] focus:ring-2 focus:ring-[#E9D8FD] focus:outline-none transition-all"
                />
              </div>

              <button
                type="button"
                onClick={() => setSearch(searchInput)}
                className="rounded-full bg-black px-4 py-2 text-xs font-semibold text-white"
              >
                Search
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-auto p-6">
            <div className="min-h-0 overflow-auto rounded-2xl border border-[#ECECFB] bg-white">
              <table className="min-w-full text-xs">
                <thead className="sticky top-0 z-20 bg-[#F6F5FF] text-[11px] font-semibold text-gray-500 shadow-sm">
                  <tr>
                    <th className="px-3 py-3 text-left">Product</th>
                    <th className="px-3 py-3 text-left">Type</th>
                    <th className="px-3 py-3 text-left">Category</th>
                    <th className="px-3 py-3 text-right">Original Price</th>
                    <th className="px-3 py-3 text-right">Corporate Price</th>
                    <th className="px-3 py-3 text-right">Stock</th>
                    <th className="px-3 py-3 text-left">SKU</th>
                    <th className="px-3 py-3 text-center">Action</th>
                  </tr>
                </thead>

                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-10 text-center text-xs text-gray-500">
                        <ClipLoader size={40} color="#6B46C1" cssOverride={{ animationDuration: "3s" }} />
                      </td>
                    </tr>
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-16 text-center text-xs text-gray-500">
                        No products found.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((p, idx) => {
                      const discounted = canApplyCorporate
                        ? computeDiscountedPrice(
                            p.price,
                            corp!.corporate_product_discount_type,
                            corp!.corporate_product_discount_value
                          )
                        : p.price;

                      const isDiscounted = discounted < p.price;

                      return (
                        <tr
                          key={p.id}
                          className={clsx("border-t border-gray-100", idx % 2 === 1 && "bg-[#FBFBFE]")}
                        >
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-3">
                              <div className="relative h-9 w-9 overflow-hidden rounded-xl bg-gray-200">
                                {p.imageUrl && <Image src={p.imageUrl} alt={p.name} fill className="object-cover" />}
                              </div>
                              <div>
                                <div className="text-xs font-semibold text-gray-900">{p.name}</div>
                                {isDiscounted && (
                                  <span className="mt-1 inline-flex rounded-full bg-[#F3E8FF] px-2 py-0.5 text-[10px] font-semibold text-[#6D28D9]">
                                    Discount applied
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>

                          <td className="px-3 py-3 text-[11px] text-gray-600">{p.type}</td>
                          <td className="px-3 py-3 text-[11px] text-gray-600">{p.categories}</td>

                          <td className="px-3 py-3 text-right text-[11px] text-gray-800">
                            {isDiscounted ? (
                              <span className="text-gray-400 line-through">{formatMoney(p.price)}</span>
                            ) : (
                              formatMoney(p.price)
                            )}
                          </td>

                          <td className="px-3 py-3 text-right text-[11px] font-semibold text-gray-900">
                            {formatMoney(discounted)}
                          </td>

                          <td className="px-3 py-3 text-right text-[11px] text-gray-800">{p.stock}</td>
                          <td className="px-3 py-3 text-[11px] text-gray-600">{p.sku}</td>

                          <td className="px-3 py-3 text-center">
                            <button
                              className="rounded-full bg-black px-4 py-1.5 text-[11px] font-semibold text-white"
                              onClick={() => router.push(`/pages/products/${p.id}/edit`)}
                            >
                              Edit
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Hint footer */}
            {canApplyCorporate && corp && (
              <div className="mt-4 text-[11px] text-gray-500">
                Corporate pricing rule:{" "}
                <span className="font-semibold text-gray-700">
                  {corp.corporate_product_discount_type === "percent"
                    ? `${corp.corporate_product_discount_value}% off`
                    : `SGD ${corp.corporate_product_discount_value} off`}
                </span>
              </div>
            )}
          </div>
        </>
  );
}