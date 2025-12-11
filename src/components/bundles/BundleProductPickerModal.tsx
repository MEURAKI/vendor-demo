// components/bundles/BundleProductPickerModal.tsx
"use client";

import React, { useEffect, useState } from "react";
import clsx from "clsx";
import { supabase } from "../../lib/supabase/client";
import type { BundleCandidateItem } from "../../types/bundles.types";

type ProductRow = {
  id: string;
  name: string;
  is_variant: boolean;
  price_cents: number | null;
  inventory_qty: number | null;
};

type VariantRow = {
  id: string; // product_variants.id
  product_id: string;
  price_cents: number;
  inventory_qty: number;
  options_json: Record<string, any>;
};

type Props = {
  open: boolean;
  onClose: () => void;
  initialSelected: BundleCandidateItem[];
  onContinue: (items: BundleCandidateItem[]) => void;
};

function buildVariantName(options_json: Record<string, any>): string {
  if (!options_json || typeof options_json !== "object") return "Variant";
  const values = Object.values(options_json).filter(Boolean);
  if (!values.length) return "Variant";
  return String(values.join(" / "));
}

export function BundleProductPickerModal({
  open,
  onClose,
  initialSelected,
  onContinue,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [variants, setVariants] = useState<VariantRow[]>([]);
  const [selected, setSelected] = useState<BundleCandidateItem[]>([]);
  const [search, setSearch] = useState("");

  /* sync selected from parent */
  useEffect(() => {
    setSelected(initialSelected || []);
  }, [initialSelected]);

  /* load products + variants for logged-in vendor */
  useEffect(() => {
    if (!open) return;

    let mounted = true;

    async function load() {
      try {
        setLoading(true);

        // 1) Get logged-in vendor
        const { data: auth } = await supabase.auth.getUser();
        const user = auth?.user;
        if (!user) {
          if (mounted) setLoading(false);
          return;
        }

        // 2) Load this vendor's products
        const { data: prodRows, error: prodError } = await supabase
          .from("products")
          .select("id,name,is_variant,price_cents,inventory_qty")
          .eq("vendor_id", user.id)
          // .eq("status", "active") // enable if you only want active ones
          .order("name", { ascending: true });

        if (prodError) {
          console.error("Error loading products", prodError);
        }

        const productList = (prodRows || []) as ProductRow[];
        if (!mounted) return;

        setProducts(productList);

        if (!productList.length) {
          setVariants([]);
          return;
        }

        const productIds = productList.map((p) => p.id);

        // 3) Load variants for those products
        const { data: varRows, error: varError } = await supabase
          .from("product_variants")
          .select("id,product_id,price_cents,inventory_qty,options_json")
          .in("product_id", productIds)
          .eq("is_active", true)
          .order("position", { ascending: true });

        if (varError) {
          console.error("Error loading product variants", varError);
        }

        if (!mounted) return;

        setVariants((varRows || []) as VariantRow[]);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void load();

    return () => {
      mounted = false;
    };
  }, [open]);

  if (!open) return null;

  /* helpers */

  const isVariantSelected = (id: string) =>
    !!selected.find((s) => s.id === id);

  const isProductVariantGroupSelected = (productId: string) =>
    !!selected.find((s) => s.kind === "variant" && s.productId === productId);

  const isProductAnythingSelected = (productId: string) =>
    !!selected.find((s) => s.productId === productId);

  const toggleSingleVariant = (product: ProductRow, variant: VariantRow) => {
    const id = variant.id; // product_variants.id

    const exists = selected.find((s) => s.id === id);
    if (exists) {
      setSelected((prev) => prev.filter((s) => s.id !== id));
      return;
    }

    const nameSuffix = buildVariantName(variant.options_json);
    const item: BundleCandidateItem = {
      id, // unique ID of bundle item
      productId: product.id,
      variantId: variant.id, // matches bundle_items.variant_id
      inventoryId: variant.id, // if you deduct from product_variants.inventory_qty
      name: `${product.name} — ${nameSuffix}`,
      kind: "single", // fixed variant (e.g. "Black towel")
      stock: variant.inventory_qty,
      priceCents: variant.price_cents,
      variantCount: null,
    };

    setSelected((prev) => [...prev, item]);
  };

  const addAsVariantGroup = (product: ProductRow) => {
    const productVariants = variants.filter((v) => v.product_id === product.id);
    const variantCount = productVariants.length;

    const id = `prod-${product.id}-variants`;

    const exists = selected.find((s) => s.id === id);
    if (exists) {
      setSelected((prev) => prev.filter((s) => s.id !== id));
      return;
    }

    const priceCents =
      productVariants.length > 0
        ? productVariants[0].price_cents
        : product.price_cents || 0;

    const totalStock = productVariants.reduce(
      (acc, v) => acc + (v.inventory_qty || 0),
      0
    );

    const item: BundleCandidateItem = {
      id,
      productId: product.id,
      variantId: null,
      inventoryId: null,
      name: `${product.name} (Variants)`,
      kind: "variant", // multi-choice
      stock: totalStock,
      priceCents,
      variantCount,
    };

    setSelected((prev) => [...prev, item]);
  };

  /* search filter */

  const normalizedSearch = search.trim().toLowerCase();

  const filteredProducts = normalizedSearch
    ? products.filter((p) => {
        const productVariants = variants.filter(
          (v) => v.product_id === p.id
        );

        const variantNames = productVariants
          .map((v) => buildVariantName(v.options_json))
          .join(" ");

        const haystack = `${p.name} ${variantNames}`.toLowerCase();
        return haystack.includes(normalizedSearch);
      })
    : products;

  /* UI */

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="flex max-h-[80vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-5 py-3">
          <h2 className="text-sm font-semibold text-gray-900">
            Add products to bundle
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="h-7 w-7 rounded-full bg-gray-100 text-xs text-gray-600 hover:bg-gray-200"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden text-xs">
          {/* LEFT: products + variants */}
          <div className="flex w-2/3 flex-col border-r">
            {/* Search bar */}
            <div className="border-b px-4 py-2">
              <input
                type="text"
                placeholder="Search products or variants…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-full border border-gray-200 bg-gray-50 px-3 py-2 text-xs focus:border-black focus:outline-none"
              />
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {loading && (
                <p className="text-gray-500">Loading products…</p>
              )}

              {!loading && filteredProducts.length === 0 && (
                <p className="text-gray-500">
                  {products.length === 0
                    ? "No products found for your account."
                    : "No products match your search."}
                </p>
              )}

              {!loading &&
                filteredProducts.map((p) => {
                  const productVariants = variants.filter(
                    (v) => v.product_id === p.id
                  );

                  const hasVariants =
                    p.is_variant && productVariants.length > 0;

                  const productHighlighted = isProductAnythingSelected(p.id);

                  return (
                    <div
                      key={p.id}
                      className={clsx(
                        "mb-3 rounded-xl border p-3",
                        productHighlighted
                          ? "border-black bg-black/5"
                          : "border-gray-200 bg-gray-50"
                      )}
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <div>
                          <div className="text-xs font-semibold text-gray-900">
                            {p.name}
                          </div>
                          <div className="text-[11px] text-gray-500">
                            {hasVariants
                              ? `${productVariants.length} variants`
                              : "Single product"}
                          </div>
                        </div>

                        {hasVariants && (
                          <button
                            type="button"
                            onClick={() => addAsVariantGroup(p)}
                            className={clsx(
                              "rounded-full border px-3 py-1 text-[11px]",
                              isProductVariantGroupSelected(p.id)
                                ? "border-purple-600 bg-purple-50 text-purple-700"
                                : "border-gray-300 bg-white text-gray-700 hover:border-purple-400"
                            )}
                          >
                            {isProductVariantGroupSelected(p.id)
                              ? "Remove multi-choice"
                              : "Add as multi-choice"}
                          </button>
                        )}
                      </div>

                      {/* Single-product (no variants) path */}
                      {!hasVariants && (
                        <label
                          className={clsx(
                            "mt-1 flex cursor-pointer items-center justify-between rounded-lg border px-2 py-1.5",
                            isVariantSelected(p.id)
                              ? "border-purple-600 bg-purple-50"
                              : "border-gray-200 bg-white hover:border-purple-300"
                          )}
                        >
                          <div>
                            <div className="text-[11px] font-medium text-gray-900">
                              Default
                            </div>
                            <div className="text-[10px] text-gray-500">
                              Stock: {p.inventory_qty ?? 0} · $
                              {((p.price_cents || 0) / 100).toFixed(2)}
                            </div>
                          </div>
                          <input
                            type="checkbox"
                            className="h-3 w-3"
                            checked={isVariantSelected(p.id)}
                            onChange={() => {
                              const exists = selected.find(
                                (s) => s.id === p.id
                              );
                              if (exists) {
                                setSelected((prev) =>
                                  prev.filter((x) => x.id !== p.id)
                                );
                                return;
                              }

                              const item: BundleCandidateItem = {
                                id: p.id,
                                productId: p.id,
                                variantId: null,
                                inventoryId: null,
                                name: p.name,
                                kind: "single",
                                stock: p.inventory_qty ?? 0,
                                priceCents: p.price_cents || 0,
                                variantCount: null,
                              };

                              setSelected((prev) => [...prev, item]);
                            }}
                          />
                        </label>
                      )}

                      {/* Variants list for variant products */}
                      {hasVariants && (
                        <div className="mt-2 space-y-1">
                          {productVariants.map((v) => {
                            const vid = v.id;
                            const checked = isVariantSelected(vid);
                            const variantName = buildVariantName(
                              v.options_json
                            );
                            const outOfStock =
                              !v.inventory_qty || v.inventory_qty <= 0;

                            return (
                              <label
                                key={vid}
                                className={clsx(
                                  "flex cursor-pointer items-center justify-between rounded-lg border px-2 py-1.5",
                                  outOfStock
                                    ? "border-gray-200 bg-gray-100 opacity-60 cursor-not-allowed"
                                    : checked
                                    ? "border-purple-600 bg-purple-50"
                                    : "border-gray-200 bg-white hover:border-purple-300"
                                )}
                              >
                                <div>
                                  <div className="text-[11px] font-medium text-gray-900">
                                    {variantName}
                                  </div>
                                  <div className="text-[10px] text-gray-500">
                                    Stock: {v.inventory_qty} · $
                                    {(v.price_cents / 100).toFixed(2)}
                                    {outOfStock && " — Out of stock"}
                                  </div>
                                </div>
                                <input
                                  type="checkbox"
                                  className="h-3 w-3"
                                  checked={checked}
                                  disabled={outOfStock}
                                  onChange={() => {
                                    if (outOfStock) return;
                                    toggleSingleVariant(p, v);
                                  }}
                                />
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>

          {/* RIGHT: selected list */}
          <div className="w-1/3 p-4">
            <h3 className="mb-2 text-[11px] font-semibold text-gray-700">
              Selected items
            </h3>
            {selected.length === 0 && (
              <p className="text-[11px] text-gray-500">
                Nothing selected yet.
              </p>
            )}
            <ul className="space-y-1">
              {selected.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-2 py-1.5 text-[11px]"
                >
                  <span className="line-clamp-1">{s.name}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setSelected((prev) =>
                        prev.filter((x) => x.id !== s.id)
                      )
                    }
                    className="ml-2 text-gray-500 hover:text-black"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t px-5 py-3 text-xs">
          <span className="text-gray-500">
            {selected.length} item{selected.length === 1 ? "" : "s"} selected
          </span>
          <button
            type="button"
            onClick={() => onContinue(selected)}
            className="rounded-full bg-black px-5 py-2 text-[11px] font-semibold text-white hover:bg-gray-900"
          >
            Add to bundle
          </button>
        </div>
      </div>
    </div>
  );
}