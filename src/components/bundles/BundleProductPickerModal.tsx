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
  id: string;           // product_variants.id
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

  useEffect(() => {
    setSelected(initialSelected || []);
  }, [initialSelected]);

  useEffect(() => {
    if (!open) return;

    let mounted = true;

    async function load() {
      try {
        setLoading(true);

        // ✅ Logged-in vendor
        const { data: auth } = await supabase.auth.getUser();
        const user = auth?.user;
        if (!user) {
          if (mounted) {
            setProducts([]);
            setVariants([]);
          }
          return;
        }

        // ✅ Load only this vendor's products
        const { data: prodRows, error: prodErr } = await supabase
          .from("products")
          .select("id,name,is_variant,price_cents,inventory_qty")
          .eq("vendor_id", user.id)
          .order("name", { ascending: true });

        if (prodErr) {
          console.error("Error loading products", prodErr);
        }

        const productList = (prodRows || []) as ProductRow[];
        const productIds = productList.map((p) => p.id);

        if (productIds.length === 0) {
          if (mounted) {
            setProducts([]);
            setVariants([]);
          }
          return;
        }

        // ✅ Load variants only for those products
        const { data: varRows, error: varErr } = await supabase
          .from("product_variants")
          .select("id,product_id,price_cents,inventory_qty,options_json")
          .in("product_id", productIds)
          .order("product_id", { ascending: true });

        if (varErr) {
          console.error("Error loading product_variants", varErr);
        }

        if (!mounted) return;
        setProducts(productList);
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

  /* ------------------------ Helpers ------------------------ */

  // Build a human label for a variant from options_json (e.g. {Color: "Black", Size: "L"} → "Black / L")
  function getVariantLabel(v: VariantRow): string {
    try {
      if (!v.options_json) return "Variant";
      const values = Object.values(v.options_json).filter(Boolean);
      if (!values.length) return "Variant";
      return values.join(" / ");
    } catch {
      return "Variant";
    }
  }

  const toggleVariant = (product: ProductRow, variant: VariantRow) => {
    const stock = variant.inventory_qty ?? 0;
    // 🔒 Out of stock: do nothing
    if (stock <= 0) return;

    const id = variant.id; // unique bundle item id
    const exists = selected.find((s) => s.id === id);

    if (exists) {
      setSelected((prev) => prev.filter((s) => s.id !== id));
      return;
    }

    const label = getVariantLabel(variant);

    const item: BundleCandidateItem = {
      id,
      productId: product.id,
      variantId: variant.id,
      inventoryId: variant.id, // 👈 used for stock deduction later
      name: `${product.name} — ${label}`,
      kind: "single", // fixed inventory item (e.g. "Black towel")
      stock: stock,
      priceCents: variant.price_cents,
      variantCount: null,
    };

    setSelected((prev) => [...prev, item]);
  };

  // For "I don't care which colour, choose any 3 towels"
  const addAsVariantGroup = (product: ProductRow) => {
    if (!product.is_variant) return; // multi-choice only makes sense for variant products

    const productVariants = variants.filter((v) => v.product_id === product.id);
    const variantCount = productVariants.length;
    const totalStock = productVariants.reduce(
      (acc, v) => acc + (v.inventory_qty ?? 0),
      0
    );

    // 🔒 If no variants or no stock across them, don't allow
    if (variantCount === 0 || totalStock <= 0) return;

    const id = `prod-${product.id}-variants`;

    const exists = selected.find((s) => s.id === id);
    if (exists) {
      setSelected((prev) => prev.filter((s) => s.id !== id));
      return;
    }

    const priceCents =
      variantCount > 0 ? productVariants[0].price_cents : product.price_cents ?? 0;

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

  const isVariantSelected = (id: string) =>
    !!selected.find((s) => s.id === id);

  const isProductVariantGroupSelected = (productId: string) =>
    !!selected.find((s) => s.kind === "variant" && s.productId === productId);

  /* ------------------------ UI ------------------------ */

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
          {/* Products + variants list */}
          <div className="w-2/3 overflow-y-auto border-r p-4">
            {loading && <p className="text-gray-500">Loading products…</p>}

            {!loading && products.length === 0 && (
              <p className="text-gray-500">No products found.</p>
            )}

            {!loading &&
              products.map((p) => {
                // For variant products → real variants
                // For single products → treat the product itself as a "single variant" row
                const productVariants: VariantRow[] = p.is_variant
                  ? variants.filter((v) => v.product_id === p.id)
                  : [
                      {
                        id: p.id,
                        product_id: p.id,
                        price_cents: p.price_cents ?? 0,
                        inventory_qty: p.inventory_qty ?? 0,
                        options_json: {}, // label built from product name instead
                      },
                    ];

                const variantCount = productVariants.length;
                const totalStock = productVariants.reduce(
                  (acc, v) => acc + (v.inventory_qty ?? 0),
                  0
                );

                const multiDisabled =
                  !p.is_variant || variantCount === 0 || totalStock <= 0;

                return (
                  <div
                    key={p.id}
                    className="mb-3 rounded-xl border border-gray-200 bg-gray-50 p-3"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <div>
                        <div className="text-xs font-semibold text-gray-900">
                          {p.name}
                        </div>
                        <div className="text-[11px] text-gray-500">
                          {p.is_variant
                            ? `${variantCount} variants · Total stock: ${totalStock}`
                            : `Single product · Stock: ${
                                productVariants[0]?.inventory_qty ?? 0
                              }`}
                        </div>
                      </div>

                      {p.is_variant && (
                        <button
                          type="button"
                          onClick={() => !multiDisabled && addAsVariantGroup(p)}
                          disabled={multiDisabled}
                          className={clsx(
                            "rounded-full border px-3 py-1 text-[11px]",
                            multiDisabled
                              ? "cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400"
                              : isProductVariantGroupSelected(p.id)
                              ? "border-purple-600 bg-purple-50 text-purple-700"
                              : "border-gray-300 bg-white text-gray-700 hover:border-purple-400"
                          )}
                        >
                          {multiDisabled
                            ? "No stock for choices"
                            : isProductVariantGroupSelected(p.id)
                            ? "Remove multi-choice"
                            : "Add as multi-choice"}
                        </button>
                      )}
                    </div>

                    {/* Variants or single row */}
                    <div className="space-y-1">
                      {productVariants.map((v) => {
                        const vid = v.id;
                        const checked = isVariantSelected(vid);
                        const stock = v.inventory_qty ?? 0;
                        const outOfStock = stock <= 0;

                        // Label:
                        const label = p.is_variant
                          ? getVariantLabel(v)
                          : p.name; // single product → just use product name

                        return (
                          <label
                            key={vid}
                            className={clsx(
                              "flex cursor-pointer items-center justify-between rounded-lg border px-2 py-1.5",
                              outOfStock
                                ? "cursor-not-allowed border-gray-200 bg-gray-100 opacity-60"
                                : checked
                                ? "border-purple-600 bg-purple-50"
                                : "border-gray-200 bg-white hover:border-purple-300"
                            )}
                          >
                            <div>
                              <div className="text-[11px] font-medium text-gray-900">
                                {p.is_variant ? label : "Single product"}
                              </div>
                              <div className="text-[10px] text-gray-500">
                                {outOfStock ? (
                                  <span className="font-semibold text-red-500">
                                    Out of stock – cannot add
                                  </span>
                                ) : (
                                  <>
                                    Stock: {stock} · $
                                    {(v.price_cents / 100).toFixed(2)}
                                  </>
                                )}
                              </div>
                            </div>
                            <input
                              type="checkbox"
                              className="h-3 w-3"
                              checked={checked}
                              disabled={outOfStock}
                              onChange={() => toggleVariant(p, v)}
                            />
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
          </div>

          {/* Selected list */}
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
                      setSelected((prev) => prev.filter((x) => x.id !== s.id))
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